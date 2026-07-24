// 테스트로 그린 손글씨를 지운다. node --env-file=.env.local scripts/clear-test-annotations.mjs [작성자명]
import { createClient } from "@supabase/supabase-js";

const author = process.argv[2] ?? "테스트";
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { error, count } = await db
  .from("annotation")
  .delete({ count: "exact" })
  .eq("author", author);

console.log(error ? `실패: ${error.message}` : `"${author}" 의 메모 ${count}건 삭제`);
