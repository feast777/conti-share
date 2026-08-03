import { createConti } from "@/app/actions";

/** 새 콘티 만들기 폼. folderId 를 주면 그 폴더 안에 만들어진다(홈에서는 폴더 밖). */
export default function NewContiForm({ folderId }: { folderId?: string }) {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <form
      action={createConti}
      className="mb-8 flex flex-col gap-2 rounded-xl border border-ink-700 bg-ink-900 p-4 sm:flex-row"
    >
      {folderId && <input type="hidden" name="folder_id" value={folderId} />}
      <input
        name="title"
        placeholder={folderId ? "이 폴더에 새 콘티 이름" : "콘티 이름 (예: 주일 1부 예배)"}
        className="flex-1"
        required
      />
      <input name="service_date" type="date" defaultValue={today} className="sm:w-44" />
      <button className="rounded-lg bg-accent px-4 py-2 font-medium text-on-accent">새 콘티</button>
    </form>
  );
}
