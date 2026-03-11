import {
  ArrowDown,
  Bot,
  Check,
  CheckCheck,
  Lock,
  RefreshCcw,
  Send,
  Shield,
  ShieldOff,
  Search,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";

import { apiRequest, apiRequestBlob } from "../api/http";
import type { AdminMe } from "../api/auth";
import { fetchMe } from "../api/auth";
import type { ChatMessage, UserItem } from "../api/types";
import {
  Button,
  Input,
  Textarea,
} from "../components/ui";
import { useConfirm } from "../lib/confirm";
import { useToast } from "../lib/toast";

// --- Helpers ---
const displayName = (u: UserItem) => {
  const parts = [u.first_name, u.last_name].filter(Boolean);
  if (parts.length) return parts.join(" ");
  if (u.username) return `@${u.username}`;
  return String(u.tg_id);
};

const initials = (u: UserItem) => {
  const s =
    `${(u.first_name || "").charAt(0)}${(u.last_name || "").charAt(0)}`.trim();
  return s || (u.username ? u.username.slice(0, 2).toUpperCase() : "U");
};

const formatTs = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" });
};

const adminLabel = (a: { username: string; display_name: string | null } | null | undefined) => {
  if (!a) return null;
  return a.display_name || a.username || null;
};

const adminPretty = (
  a:
    | { username: string; display_name: string | null; avatar_emoji?: string | null }
    | null
    | undefined,
) => {
  if (!a) return null;
  const name = (a.display_name || a.username || "").trim();
  const emoji = (a.avatar_emoji || "").trim();
  return (emoji ? `${emoji} ` : "") + name;
};

export function ChatsPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [me, setMe] = useState<AdminMe | null>(null);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [q, setQ] = useState("");
  const [qDraft, setQDraft] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [polling, setPolling] = useState(false);
  const [text, setText] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [stickToBottom, setStickToBottom] = useState(true);
  const [newWhileUp, setNewWhileUp] = useState(0);

  const pollRef = useRef<number | null>(null);
  const lastIdRef = useRef<number>(0);
  const msgWrapRef = useRef<HTMLDivElement | null>(null);

  const selectedUser = useMemo(
    () => users.find((u) => u.id === selectedId) ?? null,
    [users, selectedId],
  );

  const supportLocked = useMemo(() => {
    if (!selectedUser) return false;
    if (!selectedUser.support_enabled) return false;
    if (!selectedUser.support_admin) return false;
    if (!me) return false;
    if (me.id === 0) return false; // "super" token override
    return selectedUser.support_admin.id !== me.id;
  }, [selectedUser, me]);

  const lockedBy = useMemo(() => {
    if (!selectedUser?.support_admin) return null;
    return adminPretty(selectedUser.support_admin) || adminLabel(selectedUser.support_admin);
  }, [selectedUser]);

  const unreadTotal = useMemo(
    () => users.reduce((acc, u) => acc + (u.unread_count ? Number(u.unread_count) : 0), 0),
    [users],
  );

  const canClearHistory = Boolean(me?.is_super);

  // --- API Actions ---
  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await apiRequest<{ items: UserItem[] }>(
        "GET",
        `/api/users?limit=80&q=${encodeURIComponent(q)}`,
      );
      setUsers(res.items);
    } catch (e: any) {
      toast.push({
        title: "Помилка завантаження",
        message: e?.message,
        tone: "error",
      });
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadMessages = async (userId: number) => {
    try {
      const res = await apiRequest<{ items: ChatMessage[] }>(
        "GET",
        `/api/users/${userId}/messages?limit=100`,
      );
      setMessages(res.items);
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, unread_count: 0 } : u)));
      lastIdRef.current = res.items.length
        ? res.items[res.items.length - 1].id
        : 0;
      setNewWhileUp(0);
      setStickToBottom(true);
      setTimeout(() => jumpBottom(), 50);
    } catch (e: any) {
      toast.push({
        title: "Помилка повідомлень",
        message: e?.message,
        tone: "error",
      });
    }
  };

  const pollMessages = useCallback(async () => {
    if (!selectedId || polling) return;
    const afterId = lastIdRef.current;
    if (!afterId) return;
    try {
      setPolling(true);
      const res = await apiRequest<{ items: ChatMessage[] }>(
        "GET",
        `/api/users/${selectedId}/messages?after_id=${afterId}&limit=50`,
      );
      if (res.items.length) {
        lastIdRef.current = res.items[res.items.length - 1].id;
        setMessages((prev) => [...prev, ...res.items]);
        // Chat is open -> consider inbound messages read
        setUsers((prev) => prev.map((u) => (u.id === selectedId ? { ...u, unread_count: 0 } : u)));
        if (stickToBottom) {
          setTimeout(jumpBottom, 50);
        } else {
          setNewWhileUp((prev) => prev + res.items.length);
        }
      }
    } finally {
      setPolling(false);
    }
  }, [selectedId, stickToBottom, polling]);

  // --- Effects ---
  useEffect(() => {
    fetchMe().then(setMe).catch(() => setMe(null));
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => setQ(qDraft), 400);
    return () => window.clearTimeout(t);
  }, [qDraft]);

  useEffect(() => {
    loadUsers();
  }, [q]);

  useEffect(() => {
    const t = window.setInterval(() => void loadUsers(), 5000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  useEffect(() => {
    if (selectedId) {
      pollRef.current = window.setInterval(pollMessages, 3000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [selectedId, pollMessages]);

  useEffect(() => {
    let url: string | null = null;
    if (selectedUser?.photo_file_id) {
      apiRequestBlob(`/api/users/${selectedUser.id}/photo`)
        .then((blob) => {
          url = URL.createObjectURL(blob);
          setAvatarUrl(url);
        })
        .catch(() => setAvatarUrl(null));
    } else {
      setAvatarUrl(null);
    }
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [selectedUser?.id]);

  const send = async () => {
    if (!selectedUser || !text.trim() || !selectedUser.support_enabled || supportLocked) return;
    try {
      const sent = await apiRequest<ChatMessage>(
        "POST",
        `/api/users/${selectedUser.id}/send`,
        { text: text.trim() },
      );
      setMessages((prev) => [...prev, sent]);
      lastIdRef.current = sent.id;
      setText("");
      setStickToBottom(true);
      setTimeout(jumpBottom, 50);
    } catch (e: any) {
      toast.push({ title: "Не надіслано", message: e.message, tone: "error" });
    }
  };

  const clearHistory = async () => {
    if (!selectedUser || !canClearHistory) return;
    const ok = await confirm({
      title: "Очистити історію чату?",
      message: `Всі повідомлення з ${displayName(selectedUser)} будуть видалені. Дію не можна скасувати.`,
      confirmText: "Очистити",
      cancelText: "Скасувати",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await apiRequest("DELETE", `/api/users/${selectedUser.id}/messages`);
      setMessages([]);
      lastIdRef.current = 0;
      setNewWhileUp(0);
      setStickToBottom(true);
      setUsers((prev) =>
        prev.map((u) => (u.id === selectedUser.id ? { ...u, unread_count: 0 } : u)),
      );
      toast.push({ title: "Історію очищено", tone: "success" });
    } catch (e: any) {
      toast.push({
        title: "Помилка очищення",
        message: e?.message ?? "Не вдалося очистити історію",
        tone: "error",
      });
    }
  };

  const jumpBottom = () => {
    if (msgWrapRef.current) {
      msgWrapRef.current.scrollTo({
        top: msgWrapRef.current.scrollHeight,
        behavior: "smooth",
      });
      setNewWhileUp(0);
      setStickToBottom(true);
    }
  };

  return (
    <div className="flex h-[calc(100vh-120px)] overflow-hidden rounded-[32px] bg-white shadow-2xl ring-1 ring-black/5">
      {/* --- SIDEBAR: Users List --- */}
      <div className="flex w-full flex-col border-r border-zinc-100 bg-zinc-50/50 lg:w-80 xl:w-96">
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between px-2">
            <h1 className="text-xl font-black tracking-tight text-zinc-900">
              Чати
            </h1>
            {unreadTotal > 0 ? (
              <span className="rounded-full bg-yellow-300 px-2 py-1 text-[10px] font-black text-black">
                {unreadTotal}
              </span>
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              onClick={loadUsers}
              className="rounded-full"
            >
              <RefreshCcw
                className={`h-4 w-4 ${loadingUsers ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <Input
              value={qDraft}
              onChange={(e) => setQDraft(e.target.value)}
              placeholder="Пошук клієнта..."
              className="rounded-2xl border-none bg-white pl-10 shadow-sm ring-1 ring-black/5 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar px-3 pb-4">
          <div className="space-y-1">
            {users.map((u) => (
              <button
                key={u.id}
                onClick={() => {
                  setSelectedId(u.id);
                  loadMessages(u.id);
                }}
                className={`group flex w-full items-center gap-3 rounded-2xl p-3 transition-all ${
                  selectedId === u.id
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200"
                    : "hover:bg-white hover:shadow-md"
                }`}
              >
                <div
                  className={`relative h-12 w-12 shrink-0 rounded-xl overflow-hidden font-bold flex items-center justify-center ${
                    selectedId === u.id
                      ? "bg-white/20 text-white"
                      : "bg-zinc-200 text-zinc-600"
                  }`}
                >
                  {initials(u)}
                  {u.support_enabled && (
                    <div className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-green-500" />
                  )}
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <div className="flex items-center justify-between">
                    <span className="truncate text-sm font-bold">
                      {displayName(u)}
                    </span>
                    {u.unread_count ? (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                          selectedId === u.id ? "bg-yellow-300 text-black" : "bg-zinc-900 text-white"
                        }`}
                      >
                        {u.unread_count}
                      </span>
                    ) : (
                      <span
                        className={`text-[10px] ${selectedId === u.id ? "text-indigo-100" : "text-zinc-400"}`}
                      >
                        {u.tg_id}
                      </span>
                    )}
                  </div>
                  <div
                    className={`truncate text-xs opacity-80 ${selectedId === u.id ? "text-white" : "text-zinc-500"}`}
                  >
                    {u.active_service_title || "Без активної послуги"}
                  </div>
                </div>
              </button>
            ))}
            {!loadingUsers && !users.length && (
              <div className="p-8 text-center text-zinc-400 text-sm italic">
                Нікого не знайдено
              </div>
            )}
          </div>
        </div>
      </div>

      {/* --- MAIN: Chat Window --- */}
      <div className="flex flex-1 flex-col bg-white">
        {selectedUser ? (
          <>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-100 p-4 px-6 backdrop-blur-md">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 overflow-hidden rounded-full bg-zinc-100 ring-2 ring-zinc-50">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-indigo-50 text-indigo-600 font-bold">
                      {initials(selectedUser)}
                    </div>
                  )}
                </div>
                <div>
                  <h2 className="text-sm font-black text-zinc-900">
                    {displayName(selectedUser)}
                  </h2>
                  <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                    {selectedUser.support_enabled && (lockedBy || adminLabel(selectedUser.support_admin)) ? (
                      supportLocked ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-800 ring-1 ring-amber-200">
                          <Lock className="h-3 w-3" />
                          {lockedBy || adminLabel(selectedUser.support_admin)}
                        </span>
                      ) : (
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold text-zinc-600">
                          {lockedBy || adminLabel(selectedUser.support_admin)}
                        </span>
                      )
                    ) : null}
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${selectedUser.support_enabled ? "bg-green-500" : "bg-zinc-300"}`}
                    />
                    {selectedUser.support_enabled
                      ? "Оператор на зв'язку"
                      : "Бот-режим"}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {canClearHistory ? (
                  <Button
                    variant="danger"
                    size="sm"
                    className="rounded-full text-xs font-bold"
                    onClick={clearHistory}
                  >
                    Очистити
                  </Button>
                ) : null}
                <Button
                  variant={
                    selectedUser.support_enabled ? "secondary" : "primary"
                  }
                  size="sm"
                  className="rounded-full text-xs font-bold"
                  disabled={supportLocked}
                  onClick={() => {
                    const next = !selectedUser.support_enabled;
                    apiRequest<UserItem>("PATCH", `/api/users/${selectedUser.id}`, {
                      support_enabled: next,
                    }).then((u) => {
                      setUsers((prev) =>
                        prev.map((x) => (x.id === u.id ? u : x)),
                      );
                      toast.push({
                        title: next ? "Підтримка ОN" : "Підтримка OFF",
                        tone: "success",
                      });
                    }).catch((e: any) => {
                      toast.push({
                        title: "Не вдалося",
                        message: e?.message ?? String(e),
                        tone: "error",
                      });
                    });
                  }}
                >
                  {selectedUser.support_enabled ? (
                    <ShieldOff className="mr-2 h-3.5 w-3.5" />
                  ) : (
                    <Shield className="mr-2 h-3.5 w-3.5" />
                  )}
                  {selectedUser.support_enabled ? "Завершити" : "Перехопити"}
                </Button>
              </div>
            </div>

            {supportLocked ? (
              <div className="mx-6 mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-amber-200/70 text-amber-900 ring-1 ring-amber-200">
                    <Lock className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-extrabold tracking-tight text-amber-950">
                      Чат у роботі іншого оператора
                    </div>
                    <div className="mt-0.5 text-xs font-medium text-amber-800">
                      Зараз веде: <span className="font-black">{lockedBy || "інший оператор"}</span>. Ви не можете
                      перехопити або писати в цей чат.
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Messages Area */}
            <div className="relative flex-1 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-zinc-50/30">
              <div
                ref={msgWrapRef}
                onScroll={(e) => {
                  const el = e.currentTarget;
                  const isAtBottom =
                    el.scrollHeight - el.scrollTop - el.clientHeight < 50;
                  setStickToBottom(isAtBottom);
                  if (isAtBottom) setNewWhileUp(0);
                }}
                className="absolute inset-0 overflow-y-auto p-6 space-y-4 no-scrollbar"
              >
                {messages.map((m) => {
                  const isOut = m.direction === "outbound";
                  const isSeen = Boolean(m.seen_at);
                  return (
                    <div
                      key={m.id}
                      className={`flex ${isOut ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2 duration-300`}
                    >
                      <div
                        className={`group relative max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm transition-all ${
                          isOut
                            ? "bg-zinc-900 text-white rounded-tr-none"
                            : "bg-white text-zinc-800 rounded-tl-none ring-1 ring-black/5"
                        }`}
                      >
                        <p className="whitespace-pre-wrap text-sm leading-relaxed">
                          {m.text}
                        </p>
                        <div
                          className={`mt-1 flex items-center gap-1 text-[9px] font-medium uppercase tracking-wider opacity-50 ${isOut ? "justify-end text-right" : "justify-start text-left"}`}
                        >
                          <span>{formatTs(m.created_at)}</span>
                          {isOut && adminLabel(m.admin) ? (
                            <span className="ml-1">{adminLabel(m.admin)}</span>
                          ) : null}
                          {isOut ? (
                            isSeen ? (
                              <CheckCheck className="h-3 w-3 opacity-80" />
                            ) : (
                              <Check className="h-3 w-3 opacity-80" />
                            )
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Jump Bottom Button */}
              {!stickToBottom && (
                <button
                  onClick={jumpBottom}
                  className="absolute bottom-6 right-8 flex h-10 items-center gap-2 rounded-full bg-white px-4 text-xs font-bold text-zinc-900 shadow-2xl ring-1 ring-black/10 hover:scale-105 transition-transform"
                >
                  <ArrowDown className="h-4 w-4" />
                  {newWhileUp > 0 && (
                    <span className="text-indigo-600">{newWhileUp} нових</span>
                  )}
                  {!newWhileUp && "Вниз"}
                </button>
              )}
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white border-t border-zinc-100">
              <div className="relative mx-auto max-w-4xl">
                {!selectedUser.support_enabled && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/80 backdrop-blur-[1px]">
                    <div className="w-full max-w-md rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-center shadow-sm">
                      <div className="mx-auto mb-2 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-amber-200/70 text-amber-900 ring-1 ring-amber-200">
                        <Shield className="h-4 w-4" />
                      </div>
                      <div className="text-sm font-extrabold text-amber-950">Підтримка вимкнена</div>
                      <div className="mt-1 text-xs font-medium text-amber-800">
                        Увімкніть підтримку, щоб написати клієнту.
                      </div>
                    </div>
                  </div>
                )}
                {supportLocked && (
                  <div className="absolute inset-0 z-10 grid place-items-center rounded-2xl bg-white/85 p-4 backdrop-blur-[1px]">
                    <div className="w-full max-w-md rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-center shadow-sm">
                      <div className="mx-auto mb-2 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-amber-200/70 text-amber-900 ring-1 ring-amber-200">
                        <Lock className="h-4 w-4" />
                      </div>
                      <div className="text-sm font-extrabold text-amber-950">Чат у роботі іншого оператора</div>
                      <div className="mt-1 text-xs font-medium text-amber-800">
                        Зараз веде: <span className="font-black">{lockedBy || "інший оператор"}</span>
                      </div>
                    </div>
                  </div>
                )}
                <div className="flex items-end gap-2 rounded-[24px] bg-zinc-100 p-2 ring-1 ring-black/5 focus-within:ring-indigo-500 focus-within:bg-white transition-all">
                  <Textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    disabled={supportLocked}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        send();
                      }
                    }}
                    placeholder="Ваше повідомлення..."
                    className="min-h-[44px] flex-1 border-none bg-transparent px-3 py-2 text-sm focus:ring-0"
                    rows={1}
                  />
                  <Button
                    onClick={send}
                    disabled={!text.trim() || supportLocked}
                    className="h-10 w-10 shrink-0 rounded-full p-0 shadow-indigo-200"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="mt-2 text-center text-[10px] text-zinc-400 uppercase font-black tracking-widest">
                Shift + Enter для переносу
              </p>
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center p-12 text-center">
            <div className="mb-6 rounded-full bg-zinc-50 p-8 ring-1 ring-zinc-100">
              <Bot className="h-12 w-12 text-zinc-300" />
            </div>
            <h3 className="text-lg font-black text-zinc-900">Оберіть чат</h3>
            <p className="max-w-xs text-sm text-zinc-500">
              Виберіть клієнта зі списку зліва, щоб переглянути історію
              повідомлень або надати підтримку.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
