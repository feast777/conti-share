export type YoutubeRef = { id: string; start: number };

/**
 * 유튜브 링크에서 영상 ID 와 시작 시간을 뽑아낸다.
 * youtu.be / watch?v= / embed / shorts / live 형태를 모두 받는다.
 */
export function parseYoutube(raw: string): YoutubeRef | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let url: URL;
  try {
    url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "");
  let id: string | null = null;

  if (host === "youtu.be") {
    id = url.pathname.slice(1);
  } else if (host.endsWith("youtube.com")) {
    id = url.searchParams.get("v");
    if (!id) {
      const m = url.pathname.match(/\/(embed|shorts|live|v)\/([^/?]+)/);
      id = m?.[2] ?? null;
    }
  }

  if (!id || !/^[\w-]{6,}$/.test(id)) return null;

  const t = url.searchParams.get("t") ?? url.searchParams.get("start") ?? "";
  const m = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(\d+)s?$/);
  const start = m
    ? Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0)
    : Number(t) || 0;

  return { id, start };
}

export const thumbnailUrl = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

export const embedUrl = ({ id, start }: YoutubeRef) =>
  `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0${start ? `&start=${start}` : ""}`;
