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

export type Session = { name: string };

export async function getSession(): Promise<Session | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;

  const [payload, sig] = raw.split(".");
  if (!payload || !sig || !safeEqual(sign(payload), sig)) return null;

  try {
    const { name, exp } = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof exp !== "number" || Date.now() > exp) return null;
    return { name: String(name) };
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

export async function createSession(name: string) {
  const payload = Buffer.from(
    JSON.stringify({ name, exp: Date.now() + MAX_AGE * 1000 })
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

/** 팀 공용 비밀번호 확인 */
export function checkTeamPassword(input: string) {
  const expected = process.env.TEAM_PASSWORD;
  if (!expected) throw new Error("TEAM_PASSWORD 환경변수가 없습니다.");
  return safeEqual(sign(input), sign(expected));
}
