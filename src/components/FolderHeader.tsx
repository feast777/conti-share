"use client";

import Link from "next/link";
import { deleteFolder, renameFolder } from "@/app/actions";
import DebouncedField from "./DebouncedField";

export default function FolderHeader({
  id,
  name,
  parentId,
}: {
  id: string;
  name: string;
  parentId: string | null;
}) {
  return (
    <header className="mb-4 flex items-center gap-2">
      <Link
        href={parentId ? `/folder/${parentId}` : "/"}
        className="text-lg text-ink-400 hover:text-ink-200"
        aria-label="위로"
      >
        ‹
      </Link>
      <span className="text-lg">📁</span>
      <DebouncedField
        value={name}
        onSave={(v) => renameFolder(id, v)}
        placeholder="폴더 이름"
        className="min-w-0 flex-1 text-lg font-semibold"
      />
      <button
        onClick={() => {
          if (confirm("이 폴더를 삭제할까요? 안의 콘티는 지워지지 않고 폴더 밖으로 나옵니다.")) {
            void deleteFolder(id);
          }
        }}
        className="shrink-0 rounded-lg border border-ink-700 px-3 py-1.5 text-sm text-red-400 hover:text-red-300"
      >
        폴더 삭제
      </button>
    </header>
  );
}
