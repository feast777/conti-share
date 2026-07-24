// 이번 주 콘티를 한 번에 집어넣는 스크립트.
//
//   node --env-file=.env.local scripts/seed-conti.mjs
//
// SHEET_DIR 안의 이미지 파일을 Supabase Storage 에 올리고
// 콘티 · 곡 · 악보 · 레퍼런스를 모두 만든다.
import { readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const SHEET_DIR = process.env.SHEET_DIR ?? join(process.env.USERPROFILE ?? "", "Downloads");
const BUCKET = "sheets";

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ─────────────────────────────────────────────
// 이번 주 콘티
// ─────────────────────────────────────────────
const CONTI = {
  title: "주일 찬양 콘티",
  service_date: "2026-07-26",
  created_by: "인도자",
  note: "예상 송폼입니다. 연습 때 한번 맞춰 봅니다. 감사합니다.",
  songs: [
    {
      title: "주의 임재 앞에 잠잠해 (+ 주 품에)",
      song_key: "C",
      bpm: "",
      memo: [
        "Intro",
        "1절 전체 - 2절 전체 - 3절 전체",
        "3절 후렴 (온전히 목소리로만)",
        "악기 포함 전체 3절 후렴 후 → 다음 곡",
        "",
        "[1-1. 주 품에 (후렴부)]",
        "Chor - Chor",
        "1Ver - 2Ver - Chor - Chor Ending",
      ].join("\n"),
      sheets: [
        // 받은 악보는 A 키 버전입니다 (콘티 표기는 C).
        { file: "KakaoTalk_20260716_114412746.jpg", label: "주의 임재 앞에 잠잠해" },
        { file: "KakaoTalk_20260716_114412746_01.jpg", label: "주 품에" },
      ],
      references: [{ url: "https://youtu.be/dGmFX4k4SEs", label: "레퍼런스" }],
    },
    {
      title: "주님은 나의 힘이요",
      song_key: "A",
      bpm: "135",
      memo: [
        "Intro",
        "Ver - Chor - Intro",
        "Ver (드럼 Break! 살리면 좋겠습니다!) - Chor - Interlude",
        "Chor (목소리로 1/2, 나머지 악기 투입 후 함께) - Chor - 영원히",
        "→ 다음 곡 이어서 진행",
      ].join("\n"),
      sheets: [{ file: "KakaoTalk_20260716_114412746_02.jpg", label: "주님은 나의 힘이요" }],
      references: [{ url: "https://youtu.be/3qechBep8YY", label: "레퍼런스" }],
    },
    {
      title: "내 안에 부어주소서",
      song_key: "A",
      bpm: "130",
      memo: "전체 2번 진행",
      sheets: [{ file: "KakaoTalk_20260716_114412746_03.jpg", label: "내 안에 부어주소서" }],
      references: [{ url: "https://youtu.be/M08weuEpVD4", label: "레퍼런스" }],
    },
    {
      title: "약할 때 강함 되시네 + 그 사랑",
      song_key: "F → G",
      bpm: "",
      memo: [
        "Intro",
        "1Ver - Chor",
        "(키업 G) 2Ver - Chor - Chor",
        "+ 그 사랑 x 2",
        "Ending",
        "",
        "※ 악보 1장 = F, 2장 = G (키업 후)",
      ].join("\n"),
      sheets: [
        { file: "KakaoTalk_20260716_114412746_04.jpg", label: "약할때 강함되시네 + 그 사랑 (F)" },
        { file: "KakaoTalk_20260716_114412746_05.jpg", label: "약할때 강함되시네 + 그 사랑 (G)" },
      ],
      references: [{ url: "https://youtu.be/6ZLaChORt7o", label: "레퍼런스" }],
    },
  ],
};

// ─────────────────────────────────────────────

const MIME = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

async function main() {
  const { data: conti, error: contiErr } = await db
    .from("conti")
    .insert({
      title: CONTI.title,
      service_date: CONTI.service_date,
      note: CONTI.note,
      created_by: CONTI.created_by,
    })
    .select("id")
    .single();
  if (contiErr) throw contiErr;
  console.log(`콘티 생성: ${CONTI.title} (${conti.id})`);

  for (const [i, s] of CONTI.songs.entries()) {
    const { data: song, error: songErr } = await db
      .from("song")
      .insert({
        conti_id: conti.id,
        order_index: i,
        title: s.title,
        song_key: s.song_key,
        bpm: s.bpm,
        memo: s.memo,
      })
      .select("id")
      .single();
    if (songErr) throw songErr;
    console.log(`  ${i + 1}. ${s.title}`);

    for (const [j, sheet] of s.sheets.entries()) {
      const path = join(SHEET_DIR, sheet.file);
      const bytes = readFileSync(path);
      const ext = sheet.file.split(".").pop().toLowerCase();
      const storagePath = `${song.id}/${j}-${basename(sheet.file)}`;

      const { error: upErr } = await db.storage
        .from(BUCKET)
        .upload(storagePath, bytes, { contentType: MIME[ext] ?? "image/jpeg", upsert: true });
      if (upErr) throw upErr;

      const { error: sheetErr } = await db.from("sheet").insert({
        song_id: song.id,
        order_index: j,
        storage_path: storagePath,
        file_name: sheet.label,
        kind: ext === "pdf" ? "pdf" : "image",
        page_count: 1,
      });
      if (sheetErr) throw sheetErr;
      console.log(`     악보: ${sheet.label} (${(bytes.length / 1024).toFixed(0)}KB)`);
    }

    for (const [j, ref] of s.references.entries()) {
      const { error } = await db
        .from("reference")
        .insert({ song_id: song.id, order_index: j, url: ref.url, label: ref.label });
      if (error) throw error;
      console.log(`     레퍼런스: ${ref.url}`);
    }
  }

  console.log(`\n완료. /conti/${conti.id} 에서 확인하세요.`);
}

main().catch((err) => {
  console.error("실패:", err.message ?? err);
  process.exit(1);
});
