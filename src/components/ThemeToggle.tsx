"use client";

import { useEffect, useState } from "react";

/** 라이트 ↔ 다크 전환 버튼. 선택은 localStorage 에 저장하고 <html data-theme> 를 바꾼다. */
export default function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.dataset.theme === "dark");
  }, []);

  const toggle = () => {
    const next = dark ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* noop */
    }
    setDark(!dark);
  };

  return (
    <button
      onClick={toggle}
      className="rounded-lg border border-ink-700 px-3 py-1.5 text-sm text-ink-400 hover:text-ink-200"
      title={dark ? "밝은 테마로" : "어두운 테마로"}
      aria-label="테마 전환"
    >
      {dark ? "☀️" : "🌙"}
    </button>
  );
}
