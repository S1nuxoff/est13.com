import { Bell, Menu } from "lucide-react";

export function MobileTopbar(props: {
  title: string;
  onOpenMenu: () => void;
  unreadChats?: number;
  onOpenChats?: () => void;
}) {
  const unread = Number(props.unreadChats ?? 0);
  return (
    <div className="sticky top-0 z-40 border-b border-zinc-200 bg-white lg:hidden">
      <div className="mx-auto flex w-full items-center justify-between gap-3 px-4 py-4">
        <div className="flex items-center gap-3">
          <button
            className="inline-flex items-center justify-center rounded-2xl bg-white p-2 text-zinc-700 ring-1 ring-black/10 hover:bg-zinc-50"
            onClick={props.onOpenMenu}
            aria-label="Меню"
          >
            <Menu className="h-4 w-4" />
          </button>
          <div>
            <div className="text-sm font-semibold tracking-tight">Est13 Admin</div>
            <div className="text-xs text-zinc-500">{props.title}</div>
          </div>
        </div>

        <button
          onClick={props.onOpenChats}
          className="relative inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-zinc-700 ring-1 ring-black/10 hover:bg-zinc-50"
          aria-label="Сповіщення"
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

