"use client";

import { useEffect, useState } from "react";
import { MoonIcon, SunIcon } from "./icons";

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
      className="grid h-9 w-9 place-items-center rounded-lg text-ink-400 transition hover:bg-ink-800 hover:text-ink-200"
      title={dark ? "밝은 테마로" : "어두운 테마로"}
      aria-label="테마 전환"
    >
      {dark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
