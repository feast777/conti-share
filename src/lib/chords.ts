/**
 * 코드 이름 → 구성음 계산.
 * 예: "D#m7(b5)" → D# F# A C# / "G#7(#11)" → G# B# D# F# D
 * 악보에 적히는 표기를 폭넓게 받아들이고, 형식에 맞지 않으면 null 을 돌려준다
 * (악보 OCR 결과에서 코드가 아닌 글자를 걸러내는 데도 쓴다).
 */

const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
const ROOT_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** 반음 간격 → 몇 도인지 (3음·5음·7음·텐션을 제 자리 글자로 적기 위해) */
const DEGREE: Record<number, number> = {
  0: 1,
  2: 2,
  3: 3,
  4: 3,
  5: 4,
  6: 5,
  7: 5,
  8: 5,
  9: 6,
  10: 7,
  11: 7,
  13: 2,
  14: 2,
  15: 2,
  17: 4,
  18: 4,
  20: 6,
  21: 6,
};

/** 임시표(♯/♭) 붙이기 — 최대 겹올림/겹내림까지 */
function accidental(diff: number) {
  if (diff === 0) return "";
  if (diff === 1) return "#";
  if (diff === 2) return "##";
  if (diff === -1) return "b";
  if (diff === -2) return "bb";
  return diff > 0 ? "#".repeat(diff) : "b".repeat(-diff);
}

/**
 * 코드음을 음악 표기대로 적는다.
 * 3도씩 쌓이므로 글자(C·D·E…)를 도수만큼 진행시키고, 음높이에 맞춰 ♯/♭ 을 붙인다.
 * (예: G#7 의 3음은 C 가 아니라 B#)
 */
function spell(rootLetter: string, rootPc: number, semi: number) {
  const degree = DEGREE[semi] ?? 1;
  const letterIdx = (LETTERS.indexOf(rootLetter) + (degree - 1)) % 7;
  const letter = LETTERS[letterIdx];
  const targetPc = ((rootPc + semi) % 12 + 12) % 12;
  let diff = targetPc - ROOT_PC[letter];
  // -6..+6 범위로 접어서 가장 가까운 임시표를 찾는다
  while (diff > 6) diff -= 12;
  while (diff < -6) diff += 12;

  const name = letter + accidental(diff);
  // 겹올림/겹내림(C## 등)은 읽기 어려우니 실제로 누르는 음으로 바꿔 적는다
  if (Math.abs(diff) >= 2) {
    const simple = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"][targetPc];
    return simple;
  }
  return name;
}

export type ChordInfo = {
  /** 정규화된 이름 (표시용) */
  name: string;
  root: string;
  /** 코드 성질 설명 (예: "마이너 7 플랫5 · 하프디미니시드") */
  quality: string;
  /** 구성음 (루트부터) */
  notes: string[];
  /** 루트 기준 반음 간격 */
  intervals: number[];
  /** 분수코드의 베이스음 (C#m7/B 의 B) */
  bass?: string;
};

/** 기본 3·4화음 골격 */
const QUALITIES: { re: RegExp; label: string; iv: number[] }[] = [
  { re: /^(maj7|M7|Maj7|△7|△)/, label: "메이저 7", iv: [0, 4, 7, 11] },
  { re: /^(m7b5|m7\(b5\)|ø7|ø|min7b5|-7b5)/, label: "마이너 7 ♭5 · 하프디미니시드", iv: [0, 3, 6, 10] },
  { re: /^(dim7|°7)/, label: "디미니시드 7", iv: [0, 3, 6, 9] },
  { re: /^(dim|°)/, label: "디미니시드", iv: [0, 3, 6] },
  { re: /^(m7|min7|-7)/, label: "마이너 7", iv: [0, 3, 7, 10] },
  { re: /^(mM7|mMaj7|m\(maj7\))/, label: "마이너 메이저 7", iv: [0, 3, 7, 11] },
  { re: /^(m6|min6)/, label: "마이너 6", iv: [0, 3, 7, 9] },
  { re: /^(m|min|-)(?![a-zA-Z])/, label: "마이너", iv: [0, 3, 7] },
  { re: /^(aug|\+)/, label: "오그멘티드", iv: [0, 4, 8] },
  { re: /^(sus2)/, label: "서스2", iv: [0, 2, 7] },
  { re: /^(sus4|sus)/, label: "서스4", iv: [0, 5, 7] },
  { re: /^(6\/9|69)/, label: "식스 나인", iv: [0, 4, 7, 9, 14] },
  { re: /^(6)/, label: "식스", iv: [0, 4, 7, 9] },
  { re: /^(9)/, label: "도미넌트 9", iv: [0, 4, 7, 10, 14] },
  { re: /^(13)/, label: "도미넌트 13", iv: [0, 4, 7, 10, 14, 21] },
  { re: /^(11)/, label: "도미넌트 11", iv: [0, 4, 7, 10, 14, 17] },
  { re: /^(7)/, label: "도미넌트 7", iv: [0, 4, 7, 10] },
];

/** 괄호/뒤에 붙는 텐션 (b5, #11, add9 …) */
const TENSIONS: { re: RegExp; label: string; semis: number }[] = [
  { re: /b5|♭5/, label: "♭5", semis: 6 },
  { re: /#5|♯5|\+5/, label: "♯5", semis: 8 },
  { re: /b9|♭9/, label: "♭9", semis: 13 },
  { re: /#9|♯9/, label: "♯9", semis: 15 },
  { re: /#11|♯11/, label: "♯11", semis: 18 },
  { re: /b13|♭13/, label: "♭13", semis: 20 },
  { re: /add9/, label: "add9", semis: 14 },
  { re: /add11/, label: "add11", semis: 17 },
];

/** 코드 이름을 해석한다. 코드가 아니면 null. */
export function parseChord(raw: string): ChordInfo | null {
  const s = raw.trim().replace(/\s+/g, "");
  if (!s) return null;

  // 루트 (A~G + #/b)
  const m = s.match(/^([A-G])([#b♯♭]?)(.*)$/);
  if (!m) return null;
  const [, letter, acc, restAll] = m;

  const preferFlat = acc === "b" || acc === "♭";
  const rootPc = ROOT_PC[letter] + (acc === "#" || acc === "♯" ? 1 : preferFlat ? -1 : 0);
  const root = letter + (acc ? (preferFlat ? "b" : "#") : "");

  // 분수코드
  const [body, bassRaw] = restAll.split("/");
  let bass: string | undefined;
  if (bassRaw) {
    const bm = bassRaw.match(/^([A-G])([#b♯♭]?)$/);
    if (!bm) return null;
    bass = bm[1] + (bm[2] ? (bm[2] === "b" || bm[2] === "♭" ? "b" : "#") : "");
  }

  // 성질
  let iv = [0, 4, 7];
  let label = "메이저";
  let rest = body;
  for (const q of QUALITIES) {
    const qm = rest.match(q.re);
    if (qm) {
      iv = [...q.iv];
      label = q.label;
      rest = rest.slice(qm[0].length);
      break;
    }
  }

  // 텐션 (괄호 안팎 모두)
  const tensionText = rest;
  const found: string[] = [];
  for (const t of TENSIONS) {
    if (t.re.test(tensionText)) {
      found.push(t.label);
      if (t.label === "♭5") {
        iv = iv.map((x) => (x === 7 ? 6 : x)); // 5도를 낮춘다
      } else if (t.label === "♯5") {
        iv = iv.map((x) => (x === 7 ? 8 : x));
      } else if (!iv.includes(t.semis)) {
        iv.push(t.semis);
      }
    }
  }

  // 남은 글자가 코드 표기로 볼 수 없으면 거부 (OCR 잡음 거르기)
  const leftover = tensionText.replace(/[()b#♭♯0-9addsu,\s\-+]/gi, "");
  if (leftover.length > 0) return null;

  const notes = iv.map((semi) => spell(letter, rootPc, semi));
  const quality = found.length ? `${label} · ${found.join(" ")}` : label;

  return {
    name: s,
    root,
    quality,
    notes,
    intervals: iv,
    bass,
  };
}

/** 텍스트에서 코드처럼 보이는 토큰만 뽑는다 (악보 OCR 결과 정리용) */
export function extractChords(text: string): string[] {
  // OCR 은 글자를 붙이거나 띄우므로 띄어쓰기에 기대지 않고
  // 코드 모양의 조각을 찾아 parseChord 로 한 번 더 검사한다.
  const re =
    /([A-G])\s?([#b\u266f\u266d])?\s?((?:maj|Maj|M|min|m|dim|aug|sus|add|\u00b0|\u00f8|\u25b3|\+)?\s?\d{0,2}(?:\s?\([^)]{1,6}\))?(?:\s?[#b\u266f\u266d]\d{1,2})?)(\s?\/\s?[A-G][#b\u266f\u266d]?)?/g;

  const out: string[] = [];
  const seen = new Set<string>();

  for (const m of text.matchAll(re)) {
    const candidate = m[0].replace(/\s+/g, "").replace(/\u266f/g, "#").replace(/\u266d/g, "b");
    // 루트 한 글자만 잡힌 건 가사 속 알파벳일 수 있어 제외
    if (candidate.length < 2 || candidate.length > 12) continue;
    const info = parseChord(candidate);
    if (!info) continue;
    const key = info.name.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(info.name);
  }
  return out;
}
