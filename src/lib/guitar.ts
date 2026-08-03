/**
 * 기타 운지(보이싱) 만들기.
 * 코드 구성음을 받아 실제로 잡을 수 있는 폼을 찾아 점수를 매기고, 좋은 순으로 몇 개 돌려준다.
 * (코드마다 오픈·바레 등 여러 폼이 나온다)
 */

/** 6번줄(저음 E)부터 1번줄까지 개방현 음높이 (MIDI) */
const OPEN = [40, 45, 50, 55, 59, 64];
const MAX_FRET = 12;
const MAX_SPAN = 4; // 손가락이 닿는 폭
const MAX_FINGERS = 4;

/** 한 폼 — 줄마다 프렛 번호, -1 은 뮤트(치지 않음), 0 은 개방현 */
export type Voicing = {
  frets: number[]; // 6개 (6번줄 → 1번줄)
  /** 바레하는 프렛 (없으면 0) */
  barre: number;
  /** 다이어그램 시작 프렛 (1이면 0프렛부터) */
  baseFret: number;
  fingers: number;
};

type Spec = {
  /** 코드 구성음 (반음 값 0~11) */
  pcs: number[];
  /** 루트 반음 값 */
  rootPc: number;
  /** 5도(완전5도)의 반음 값 — 생략 가능한 음 */
  fifthPc: number | null;
  /** 분수코드 베이스 */
  bassPc: number | null;
};

/** 이 폼이 필요한 음을 모두 담고 있는지 (완전5도는 생략 허용) */
function coversChord(pitches: number[], spec: Spec) {
  const have = new Set(pitches.map((p) => ((p % 12) + 12) % 12));
  for (const pc of spec.pcs) {
    if (have.has(pc)) continue;
    // 음이 4개 이상인 코드에서는 완전5도를 빼도 코드가 성립한다
    if (spec.fifthPc !== null && pc === spec.fifthPc && spec.pcs.length >= 4) continue;
    return false;
  }
  return true;
}

/** 손가락 수 — 같은 프렛에 여러 개면 바레 한 손가락으로 본다 */
function fingerCount(frets: number[]) {
  const fretted = frets.filter((f) => f > 0);
  if (fretted.length === 0) return { fingers: 0, barre: 0 };
  const min = Math.min(...fretted);
  const atMin = fretted.filter((f) => f === min).length;
  if (atMin >= 2) {
    return { fingers: 1 + fretted.filter((f) => f > min).length, barre: min };
  }
  return { fingers: fretted.length, barre: 0 };
}

/** 폼 하나에 점수를 매긴다 (낮을수록 좋음) */
function score(frets: number[], spec: Spec, fingers: number, barre: number) {
  const sounding = frets.filter((f) => f >= 0);
  const fretted = frets.filter((f) => f > 0);
  const lowestIdx = frets.findIndex((f) => f >= 0);
  const lowestPc = ((OPEN[lowestIdx] + frets[lowestIdx]) % 12 + 12) % 12;

  let s = 0;
  // 저음 줄을 안 치는 건 흔한 연주법이라 가볍게만 감점 (x32010, x02210 …)
  s += (6 - sounding.length) * 1.2;
  s += fingers * 1.2; // 손가락 적을수록 좋다
  s += fretted.length ? Math.min(...fretted) * 0.9 : 0; // 낮은 포지션 선호
  if (barre) s += 1; // 바레는 살짝 감점
  // 개방현과 먼 프렛을 함께 잡는 폼은 어색하다
  if (fretted.length && frets.some((f) => f === 0) && Math.max(...fretted) > 4) s += 6;

  // 베이스음: 분수코드면 그 음, 아니면 루트가 가장 낮게 (아니면 크게 감점)
  const wantBass = spec.bassPc ?? spec.rootPc;
  if (lowestPc !== wantBass) s += 14;

  // 중간에 뮤트가 끼면 잡기 어렵다
  const first = frets.findIndex((f) => f >= 0);
  const last = 5 - [...frets].reverse().findIndex((f) => f >= 0);
  for (let i = first; i <= last; i++) if (frets[i] < 0) s += 5;

  return s;
}

/** 두 폼이 사실상 같은지 */
const sameShape = (a: number[], b: number[]) => a.every((v, i) => v === b[i]);

/**
 * 코드 구성음(음이름 → 반음 값)으로 운지 후보를 찾는다.
 * @param pcs 구성음 반음 값들, @param rootPc 루트, @param fifthPc 완전5도(없으면 null), @param bassPc 분수코드 베이스
 */
export function findVoicings(
  pcs: number[],
  rootPc: number,
  fifthPc: number | null,
  bassPc: number | null,
  limit = 4
): Voicing[] {
  const spec: Spec = { pcs: [...new Set(pcs)], rootPc, fifthPc, bassPc };
  const results: { v: Voicing; s: number }[] = [];

  for (let base = 0; base <= MAX_FRET; base++) {
    // 이 구간에서 각 줄이 낼 수 있는 선택지 (뮤트 / 개방 / 구간 안의 프렛)
    // 울리는 줄은 코드 구성음이어야 한다 (분수코드의 베이스음도 허용)
    const allowed = spec.bassPc !== null ? [...spec.pcs, spec.bassPc] : spec.pcs;
    const options: number[][] = OPEN.map((open) => {
      const opts: number[] = [-1];
      const inChord = (f: number) => allowed.includes(((open + f) % 12 + 12) % 12);
      for (let f = base; f < base + MAX_SPAN; f++) {
        if (f > MAX_FRET + MAX_SPAN) break;
        if (inChord(f)) opts.push(f);
      }
      if (base > 0 && inChord(0)) opts.push(0); // 개방현은 어느 포지션에서든 쓸 수 있다
      return [...new Set(opts)];
    });

    // 조합 탐색 (6줄 × 최대 5선택지)
    const cur: number[] = [];
    const walk = (i: number) => {
      if (results.length > 4000) return; // 안전장치
      if (i === 6) {
        const frets = [...cur];
        const sounding = frets.filter((f) => f >= 0);
        if (sounding.length < 4) return;

        const fretted = frets.filter((f) => f > 0);
        if (fretted.length) {
          const span = Math.max(...fretted) - Math.min(...fretted);
          if (span >= MAX_SPAN) return;
          // 개방현과 높은 포지션을 섞으면 소리가 어색하고 잡기도 이상하다
          if (Math.min(...fretted) > 4 && frets.some((f) => f === 0)) return;
        }

        const pitches = frets.map((f, si) => (f >= 0 ? OPEN[si] + f : -1)).filter((p) => p >= 0);
        if (!coversChord(pitches, spec)) return;

        const { fingers, barre } = fingerCount(frets);
        if (fingers > MAX_FINGERS) return;

        const s = score(frets, spec, fingers, barre);
        const baseFret = fretted.length ? Math.max(1, Math.min(...fretted)) : 1;
        results.push({ v: { frets, barre, baseFret, fingers }, s });
        return;
      }
      for (const f of options[i]) {
        cur.push(f);
        walk(i + 1);
        cur.pop();
      }
    };
    walk(0);
  }

  results.sort((a, b) => a.s - b.s);

  // 비슷한 폼은 하나만 남긴다
  const picked: Voicing[] = [];
  for (const r of results) {
    if (picked.some((p) => sameShape(p.frets, r.v.frets))) continue;
    // 이미 고른 폼과 포지션이 겹치면 건너뛴다 (다양한 폼을 보여주기 위해)
    const pos = r.v.frets.filter((f) => f > 0);
    const posMin = pos.length ? Math.min(...pos) : 0;
    if (picked.some((p) => {
      const q = p.frets.filter((f) => f > 0);
      const qMin = q.length ? Math.min(...q) : 0;
      return Math.abs(qMin - posMin) < 2;
    })) {
      continue;
    }
    picked.push(r.v);
    if (picked.length >= limit) break;
  }

  // 다양성 조건 때문에 너무 적게 남으면 점수순으로 채운다
  if (picked.length < limit) {
    for (const r of results) {
      if (picked.some((p) => sameShape(p.frets, r.v.frets))) continue;
      picked.push(r.v);
      if (picked.length >= limit) break;
    }
  }

  return picked;
}
