import "server-only";
import { type SupabaseClient, createClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수가 없습니다. .env.local 을 확인하세요."
    );
  }

  client = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

/**
 * service role 키를 쓰는 서버 전용 클라이언트.
 * 빌드 중에는 환경변수가 없을 수 있어서 실제로 쓸 때 만든다.
 * RLS 를 통과하므로 절대 클라이언트 번들에 들어가면 안 된다.
 */
export const db = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const c = getClient() as unknown as Record<string | symbol, unknown>;
    const value = c[prop];
    return typeof value === "function" ? value.bind(c) : value;
  },
});

export const SHEET_BUCKET = "sheets";

/** 악보 열람용 임시 URL (기본 2시간) */
export async function signSheetUrl(path: string, expiresIn = 60 * 60 * 2) {
  const { data } = await db.storage.from(SHEET_BUCKET).createSignedUrl(path, expiresIn);
  return data?.signedUrl ?? "";
}
