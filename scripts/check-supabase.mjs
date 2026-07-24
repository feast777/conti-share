// 연결 점검용. node --env-file=.env.local scripts/check-supabase.mjs
import { createClient } from "@supabase/supabase-js";

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

for (const table of ["conti", "song", "reference", "sheet", "annotation"]) {
  const { count, error } = await db.from(table).select("id", { count: "exact", head: true });
  console.log(error ? `  ✗ ${table}: ${error.message}` : `  ✓ ${table}: ${count}행`);
}

const { data: buckets, error } = await db.storage.listBuckets();
console.log(
  error
    ? `  ✗ 스토리지: ${error.message}`
    : `  ✓ 버킷: ${buckets.map((b) => `${b.name} (public=${b.public})`).join(", ")}`
);
