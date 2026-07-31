"use client";

/** 데이터를 불러오다 오류가 나면(예: 일시적 연결·서버 장애) 보여주는 화면.
 *  '폴더가 사라진 것처럼' 빈 화면이 아니라, 다시 시도할 수 있게 안내한다. */
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="grid min-h-dvh place-items-center p-6 text-center">
      <div className="space-y-4">
        <p className="text-2xl">😥</p>
        <div className="space-y-1">
          <p className="font-medium text-white">잠시 불러오지 못했어요</p>
          <p className="text-sm text-ink-400">
            연결이 일시적으로 불안정할 수 있어요. 데이터는 그대로 있으니 다시 시도해 주세요.
          </p>
        </div>
        <div className="flex justify-center gap-2">
          <button
            onClick={reset}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-ink-950"
          >
            다시 시도
          </button>
          <button
            onClick={() => location.reload()}
            className="rounded-lg border border-ink-700 px-4 py-2 text-sm text-ink-400 hover:text-white"
          >
            새로고침
          </button>
        </div>
      </div>
    </main>
  );
}
