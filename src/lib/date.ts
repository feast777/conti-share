/**
 * 날짜는 항상 서울 기준으로 다룬다.
 *
 * 서버(Vercel 함수)는 지역과 무관하게 UTC 로 돈다. 그래서 `new Date()` 를 그대로 쓰면
 * 한국 시간 자정~오전 9시 사이에는 아직 '어제'다. 주일 아침 7시에 콘티를 열면
 * 오늘 콘티가 "내일 예배" 로 뜨고, 그때 만든 콘티는 어제 날짜로 저장된다.
 */

/** 오늘 (서울 기준) — "YYYY-MM-DD" */
export function todaySeoul(): string {
  // en-CA 로케일이 YYYY-MM-DD 형식을 준다
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}

/** 두 날짜("YYYY-MM-DD") 사이의 일수. 문자열로만 계산해 시간대 영향을 받지 않는다. */
export function daysBetween(fromIso: string, toIso: string): number {
  const utc = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
  return Math.round((utc(toIso) - utc(fromIso)) / 86400000);
}
