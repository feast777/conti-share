import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const COOKIE = "conti_session";
const MAX_AGE = 60 * 60 * 24 * 90; // 90일 — 매주 로그인하게 만들지 않는다

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET 환경변수가 없습니다.");
  return s;
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** church = 교회 구분. 로그인한 비밀번호로 정해지고, 자기 교회 자료만 보인다. */
export type Session = { name: string; church: string };

export async function getSession(): Promise<Session | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;

  const [payload, sig] = raw.split(".");
  if (!payload || !sig || !safeEqual(sign(payload), sig)) return null;

  try {
    const { name, church, exp } = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof exp !== "number" || Date.now() > exp) return null;
    // 예전에 로그인한 사람은 church 가 없으니 기존 교회(main)로 본다
    return { name: String(name), church: String(church || "main") };
  } catch {
    return null;
  }
}

/** 로그인하지 않았으면 로그인 화면으로 보낸다. */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function createSession(name: string, church: string) {
  const payload = Buffer.from(
    JSON.stringify({ name, church, exp: Date.now() + MAX_AGE * 1000 })
  ).toString("base64url");

  (await cookies()).set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

/**
 * 비밀번호로 교회를 찾는다. 맞는 게 없으면 null.
 * TEAM_PASSWORD → 기존 교회(main), TEAM_PASSWORD_2·_3… → 교회 c2·c3…
 * (교회를 더 늘리려면 TEAM_PASSWORD_4 처럼 환경변수만 추가하면 된다)
 */
export function findChurchByPassword(input: string): string | null {
  const entries: [string, string | undefined][] = [["main", process.env.TEAM_PASSWORD]];
  for (const [key, value] of Object.entries(process.env)) {
    const m = key.match(/^TEAM_PASSWORD_(\d+)$/);
    if (m) entries.push([`c${m[1]}`, value]);
  }

  const configured = entries.filter(([, pw]) => pw);
  if (configured.length === 0) throw new Error("TEAM_PASSWORD 환경변수가 없습니다.");

  for (const [church, pw] of configured) {
    if (safeEqual(sign(input), sign(pw as string))) return church;
  }
  return null;
}
