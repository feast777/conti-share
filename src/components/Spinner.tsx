/** 화면 전환·불러오는 동안 보여주는 로딩 표시 */
export default function Spinner({ label = "불러오는 중…" }: { label?: string }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-ink-950">
      <div className="flex flex-col items-center gap-3">
        <span className="h-10 w-10 animate-spin rounded-full border-2 border-ink-700 border-t-accent-ink" />
        <p className="text-sm text-ink-400">{label}</p>
      </div>
    </div>
  );
}
