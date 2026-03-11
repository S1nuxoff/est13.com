import { ChevronDown, LogOut } from "lucide-react";

import type { Service } from "../api/types";
import type { NavItem } from "../app/nav";
import type { AdminMe } from "../api/auth";
import logo from "../assets/est13logo.svg";

export function Sidebar(props: {
  mobile?: boolean;
  navItems: NavItem[];
  services: Service[];
  route: string;
  selectedServiceId: number | null;
  unreadChats?: number;
  unacceptedLeads?: number;
  navigate: (
    next: string,
    opts?: { params?: Record<string, string | number | null | undefined> },
  ) => void;
  goToService: (id: number) => void;
  onCloseMobile?: () => void;
  onLogout?: () => void;
  currentAdmin?: AdminMe | null;
}) {
  const mobile = Boolean(props.mobile);
  const close = props.onCloseMobile;
  const unreadChats = Number(props.unreadChats ?? 0);
  const unacceptedLeads = Number(props.unacceptedLeads ?? 0);

  return (
    <div
      className={`flex h-full flex-col bg-[#121212] text-zinc-400 ${mobile ? "w-full p-6" : "w-full px-4 py-6"}`}
    >
      {/* Logo Section */}
      <div className="mb-8 flex items-center gap-3 px-3">
        <img src={logo} alt="Est13" className="h-6 w-auto" />
      </div>

      {/* User Account Section */}
      {props.currentAdmin && (
        <div className="mb-8 px-1">
          <div className="flex items-center gap-3 rounded-2xl bg-[#1a1a1e] p-3 ring-1 ring-white/5 shadow-2xl">
            {/* Круглая иконка с белым фоном */}
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-xl shadow-inner ring-4 ring-[#2d2d33]/30">
              <span className="drop-shadow-sm">
                {props.currentAdmin.avatar_emoji || "🧑‍💻"}
              </span>
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-bold tracking-tight text-white">
                {props.currentAdmin.display_name || props.currentAdmin.username}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex-1 space-y-1.5 overflow-y-auto custom-scrollbar">
        {props.navItems.map((item) => {
          const isActive = props.route === item.key;
          const isServices = item.key === "services";
          const chatsUnread = item.key === "chats" && unreadChats > 0;
          const leadsUnaccepted = item.key === "leads" && unacceptedLeads > 0;

          return (
            <div key={item.key} className="space-y-1">
              <button
                onClick={() => {
                  props.navigate(item.key);
                  if (!isServices) close?.();
                }}
                className={`group flex w-full items-center justify-between rounded-xl px-3 py-2.5 transition-all duration-200 ${
                  isActive
                    ? "bg-[#212126] text-white shadow-lg ring-1 ring-white/10"
                    : "hover:bg-[#1a1a1e] hover:text-zinc-200"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={
                      isActive
                        ? "text-white"
                        : chatsUnread
                          ? "text-yellow-300 group-hover:text-yellow-200"
                          : leadsUnaccepted
                            ? "text-sky-300 group-hover:text-sky-200"
                          : "text-zinc-500 group-hover:text-zinc-300"
                    }
                  >
                    <span className="relative inline-flex">
                      {item.icon}
                      {chatsUnread || leadsUnaccepted ? (
                        <span
                          className={[
                            "absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full",
                            chatsUnread ? "bg-yellow-300" : "bg-sky-300",
                            "ring-2",
                            isActive ? "ring-[#212126]" : "ring-[#121212]",
                            chatsUnread
                              ? "shadow-[0_0_16px_rgba(253,224,71,0.35)]"
                              : "shadow-[0_0_16px_rgba(125,211,252,0.35)]",
                            "animate-pulse",
                          ].join(" ")}
                        />
                      ) : null}
                    </span>
                  </div>
                  <span className="text-sm font-semibold">{item.label}</span>
                </div>
                {item.key === "chats" && unreadChats > 0 ? (
                  <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-yellow-400 px-1 text-[10px] font-black text-black">
                    {unreadChats > 99 ? "99+" : unreadChats}
                  </span>
                ) : null}
                {item.key === "leads" && unacceptedLeads > 0 ? (
                  <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-sky-300 px-1 text-[10px] font-black text-black">
                    {unacceptedLeads > 99 ? "99+" : unacceptedLeads}
                  </span>
                ) : null}
                {isServices && (
                  <ChevronDown
                    className={`h-4 w-4 transition-transform duration-300 ${isActive ? "rotate-180" : ""}`}
                  />
                )}
              </button>

              {/* Nested Services (Tree) */}
              {isServices && (isActive || props.selectedServiceId) && (
                <div className="relative ml-4 mt-2 space-y-1 border-l border-zinc-800/60 pl-4">
                  {props.services.map((s) => {
                    const isServiceActive = props.selectedServiceId === s.id;
                    return (
                      <button
                        key={s.id}
                        onClick={() => {
                          props.goToService(s.id);
                          close?.();
                        }}
                        className={`group relative flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-all ${
                          isServiceActive
                            ? "bg-[#2d2d33] text-white"
                            : "text-zinc-500 hover:text-zinc-200 hover:bg-white/5"
                        }`}
                      >
                        <span className="truncate font-medium">{s.title}</span>
                        <div
                          className={`absolute -left-[17px] top-1/2 h-[1px] w-3 ${isServiceActive ? "bg-zinc-500" : "bg-zinc-800"}`}
                        />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom Toggler & Logout */}
      <div className="mt-auto pt-6 space-y-4">
        {props.onLogout && (
          <button
            onClick={props.onLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-xs font-bold text-zinc-500 hover:bg-red-500/10 hover:text-red-400 group transition-all"
          >
            <LogOut className="h-4 w-4 transition-colors" />
            <span className=" tracking-widest">Вийти</span>
          </button>
        )}
      </div>
    </div>
  );
}
