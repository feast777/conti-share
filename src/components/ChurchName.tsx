"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveChurchName } from "@/app/actions";

/**
 * 교회(찬양팀) 이름 — 앱 이름 위에 작게 보여주고, 눌러서 바로 고칠 수 있다.
 * 아직 안 정했으면 '이름 설정' 안내가 뜬다.
 */
export default function ChurchName({ name }: { name: string }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await saveChurchName(value);
      setEditing(false);
      startTransition(() => router.refresh());
    } catch {
      alert("이름을 저장하지 못했어요.");
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void save();
            if (e.key === "Escape") {
              setValue(name);
              setEditing(false);
            }
          }}
          placeholder="예: 참빛교회 찬양팀"
          maxLength={40}
          className="w-44 px-2 py-1 text-xs"
        />
        <button
          onClick={() => void save()}
          disabled={saving}
          className="rounded-md bg-accent px-2 py-1 text-xs font-medium text-on-accent disabled:opacity-50"
        >
          {saving ? "저장 중" : "저장"}
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="text-xs text-ink-600 transition hover:text-ink-400"
      title="교회·찬양팀 이름 바꾸기"
    >
      {name || "+ 교회 이름 설정"}
    </button>
  );
}
