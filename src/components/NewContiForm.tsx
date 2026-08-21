import { createConti } from "@/app/actions";
import { todaySeoul } from "@/lib/date";
import { PlusIcon } from "./icons";

/** 새 콘티 만들기 폼. folderId 를 주면 그 폴더 안에 만들어진다(홈에서는 폴더 밖). */
export default function NewContiForm({ folderId }: { folderId?: string }) {
  const today = todaySeoul();
  return (
    <form
      action={createConti}
      className="card mb-10 flex flex-col gap-2 p-2.5 sm:flex-row sm:items-center"
    >
      {folderId && <input type="hidden" name="folder_id" value={folderId} />}
      <input
        name="title"
        placeholder={folderId ? "이 폴더에 새 콘티 이름" : "새 콘티 이름 (예: 주일 1부 예배)"}
        className="flex-1 border-transparent bg-transparent shadow-none focus:border-transparent focus:shadow-none"
        required
      />
      <input
        name="service_date"
        type="date"
        defaultValue={today}
        className="border-transparent bg-transparent text-sm text-ink-400 shadow-none focus:border-transparent focus:shadow-none sm:w-40"
      />
      <button className="flex items-center justify-center gap-1.5 rounded-[0.625rem] bg-accent px-4 py-2 text-sm font-medium text-on-accent transition hover:opacity-90">
        <PlusIcon />
        만들기
      </button>
    </form>
  );
}
