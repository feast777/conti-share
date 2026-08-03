"use client";

import { useActionState } from "react";
import { login } from "../actions";

export default function LoginPage() {
  const [error, formAction, pending] = useActionState(login, null);

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <form action={formAction} className="w-full max-w-sm space-y-5">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight text-ink-200">Cadence</h1>
          <p className="text-xs tracking-wide text-ink-600">WORSHIP SETLIST</p>
          <p className="pt-2 text-sm text-ink-400">이름과 팀 비밀번호를 입력하세요.</p>
        </div>

        <div className="space-y-3">
          <input
            name="name"
            placeholder="이름 (예: 김찬양)"
            autoComplete="nickname"
            className="w-full"
            required
          />
          <input
            name="password"
            type="password"
            placeholder="팀 비밀번호"
            autoComplete="current-password"
            className="w-full"
            required
          />
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-accent px-4 py-2.5 font-medium text-on-accent disabled:opacity-50"
        >
          {pending ? "확인 중…" : "들어가기"}
        </button>

        <p className="text-xs leading-relaxed text-ink-600">
          이름은 악보 메모에 누가 썼는지 표시하는 데 쓰입니다.
        </p>
      </form>
    </main>
  );
}
