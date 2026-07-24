"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  value: string;
  onSave: (value: string) => Promise<void> | void;
  placeholder?: string;
  className?: string;
  multiline?: boolean;
  rows?: number;
  delay?: number;
};

/** 입력이 멈추면 알아서 저장하는 입력칸. 저장 버튼을 없애기 위한 것. */
export default function DebouncedField({
  value,
  onSave,
  placeholder,
  className = "",
  multiline = false,
  rows = 3,
  delay = 700,
}: Props) {
  const [local, setLocal] = useState(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedRef = useRef(value);

  // 서버 값이 바뀌었고 내가 편집 중이 아니면 따라간다
  useEffect(() => {
    if (value !== savedRef.current) {
      savedRef.current = value;
      setLocal(value);
    }
  }, [value]);

  const handle = (v: string) => {
    setLocal(v);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      savedRef.current = v;
      void onSave(v);
    }, delay);
  };

  const props = {
    value: local,
    placeholder,
    className,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      handle(e.target.value),
    onBlur: () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (local !== savedRef.current) {
        savedRef.current = local;
        void onSave(local);
      }
    },
  };

  return multiline ? <textarea {...props} rows={rows} /> : <input {...props} />;
}
