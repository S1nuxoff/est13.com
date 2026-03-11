import { Bell } from "lucide-react";

export function PageHeader(props: {
  title: string;
  search: string;
  onSearchChange: (next: string) => void;
  unreadChats?: number;
  onOpenChats?: () => void;
}) {
  const unread = Number(props.unreadChats ?? 0);
  return (
    <div className="mb-6 hidden items-center justify-between gap-3 lg:flex">
      <div>
        <div className="text-2xl font-semibold tracking-tight">{props.title}</div>
        <div className="text-sm text-zinc-500">Керуйте контентом і заявками</div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={props.onOpenChats}
          className="relative inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-zinc-800 ring-1 ring-black/10 hover:bg-zinc-50"
          aria-label="Сповіщення"
          title="Сповіщення"
        >
          <Bell className="h-4 w-4" />
          {unread > 0 ? (
            <span className="absolute -right-1 -top-1 grid h-5 min-w-[20px] place-items-center rounded-full bg-yellow-300 px-1 text-[10px] font-black text-black ring-2 ring-white">
              {unread > 99 ? "99+" : unread}
            </span>
          ) : null}
        </button>
      </div>
    </div>
  );
}

