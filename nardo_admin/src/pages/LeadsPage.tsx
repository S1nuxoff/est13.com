import {
  Calendar,
  Archive,
  Ban,
  BadgeCheck,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileSearch,
  Hammer,
  PauseCircle,
  Send,
  Slash,
  Smartphone,
  Timer,
  UserX,
  XCircle,
  RefreshCcw,
  Search,
  FolderKanban,
} from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { apiRequest, apiRequestBlob } from "../api/http";
import type { AdminMe } from "../api/auth";
import type { LeadDetails, LeadsListItem, LeadSource } from "../api/types";
import {
  Badge,
  Button,
  Card,
  Divider,
  Select,
  Spinner,
} from "../components/ui";
import { useToast } from "../lib/toast";
import { useConfirm } from "../lib/confirm";
import { useHashRoute } from "../lib/router";

type LeadStatus = LeadsListItem["status"];

type LeadGroup = {
  user_id: number;
  user_tg_id: number;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  photo_file_id: string | null;
  leads: LeadsListItem[];
  last_started_at: string;
};

const statusLabel: Record<LeadStatus, string> = {
  filling: "Заповнює",
  abandoned: "Скасовано (клієнт)",
  awaiting_review: "Очікує перевірки",
  in_review: "На перевірці",
  confirmed: "Підтверджено",
  in_work: "В роботі",
  paused: "Пауза",
  rejected: "Відхилено",
  lost: "Втрачено",
  studio_cancelled: "Скасовано (студія)",
  done: "Завершено",
  delivered: "Передано клієнту",
  client_not_confirmed: "Клієнт не підтвердив",
  closed: "Закрито",
};

const statusTone: Record<LeadStatus, "gray" | "amber" | "green" | "red"> = {
  filling: "amber",
  awaiting_review: "amber",
  in_review: "amber",
  confirmed: "green",
  in_work: "green",
  done: "green",
  delivered: "green",
  client_not_confirmed: "amber",
  paused: "gray",
  closed: "gray",
  abandoned: "red",
  rejected: "red",
  lost: "red",
  studio_cancelled: "red",
};

const statusIcon: Record<LeadStatus, ReactNode> = {
  filling: <Timer className="h-3.5 w-3.5" />,
  abandoned: <UserX className="h-3.5 w-3.5" />,
  awaiting_review: <ClipboardList className="h-3.5 w-3.5" />,
  in_review: <FileSearch className="h-3.5 w-3.5" />,
  confirmed: <BadgeCheck className="h-3.5 w-3.5" />,
  in_work: <Hammer className="h-3.5 w-3.5" />,
  paused: <PauseCircle className="h-3.5 w-3.5" />,
  rejected: <Ban className="h-3.5 w-3.5" />,
  lost: <XCircle className="h-3.5 w-3.5" />,
  studio_cancelled: <Slash className="h-3.5 w-3.5" />,
  done: <CheckCircle2 className="h-3.5 w-3.5" />,
  delivered: <Send className="h-3.5 w-3.5" />,
  client_not_confirmed: <XCircle className="h-3.5 w-3.5" />,
  closed: <Archive className="h-3.5 w-3.5" />,
};

const statusActionVariant: Partial<
  Record<LeadStatus, "primary" | "secondary" | "danger" | "ghost">
> = {
  confirmed: "primary",
  in_work: "primary",
  delivered: "secondary",
  client_not_confirmed: "secondary",
  done: "secondary",
  closed: "secondary",
  paused: "secondary",
  rejected: "danger",
  lost: "danger",
  studio_cancelled: "danger",
};

const FLOW_STEPS: { key: LeadStatus; title: string; hint: string }[] = [
  {
    key: "awaiting_review",
    title: "Очікує перевірки",
    hint: "Анкета надіслана",
  },
  { key: "in_review", title: "На перевірці", hint: "Менеджер переглядає" },
  { key: "confirmed", title: "Підтверджено", hint: "Можна брати в роботу" },
  { key: "in_work", title: "В роботі", hint: "Йде виконання" },
  { key: "done", title: "Завершено", hint: "Робота готова" },
  {
    key: "delivered",
    title: "Передано клієнту",
    hint: "Очікуємо підтвердження",
  },
  {
    key: "client_not_confirmed",
    title: "Не підтверджено",
    hint: "Потрібні правки / повторна робота",
  },
  { key: "closed", title: "Закрито", hint: "Лід закрито" },
];

function FlowStepper(props: { status: LeadStatus }) {
  const isNegative = [
    "rejected",
    "lost",
    "studio_cancelled",
    "abandoned",
  ].includes(props.status);
  const currentIdx = FLOW_STEPS.findIndex((s) => s.key === props.status);
  const reachedIdx = currentIdx >= 0 ? currentIdx : 0;

  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-black/5">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-bold uppercase tracking-wider text-zinc-400">
          Етапи
        </div>
        {isNegative ? (
          <Badge
            tone="red"
            className="rounded-full px-3 py-1 text-[11px] font-semibold gap-2"
          >
            <span className="text-zinc-700">{statusIcon[props.status]}</span>
            {statusLabel[props.status]}
          </Badge>
        ) : null}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2">
        {FLOW_STEPS.map((s, idx) => {
          const isDone = !isNegative && idx < reachedIdx;
          const isCurrent = !isNegative && idx === reachedIdx;
          const cls = isCurrent
            ? "bg-zinc-900 text-white ring-1 ring-black/10"
            : isDone
              ? "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-100"
              : "bg-zinc-50 text-zinc-700 ring-1 ring-black/5";
          return (
            <div
              key={s.key}
              className={[
                "flex items-center justify-between gap-3 rounded-2xl px-3 py-2",
                cls,
              ].join(" ")}
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className={isCurrent ? "text-white" : "text-zinc-600"}>
                  {statusIcon[s.key]}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-xs font-semibold">
                    {s.title}
                  </div>
                  <div
                    className={[
                      "truncate text-[11px]",
                      isCurrent ? "text-white/70" : "text-zinc-500",
                    ].join(" ")}
                  >
                    {s.hint}
                  </div>
                </div>
              </div>
              <div className="text-[11px] font-semibold">
                {isCurrent ? "Зараз" : isDone ? "Готово" : ""}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function LeadsPage(props: { currentAdmin?: AdminMe | null }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [items, setItems] = useState<LeadsListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<LeadStatus | "all">("all");

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [details, setDetails] = useState<LeadDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [accepting, setAccepting] = useState(false);

  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});
  const [avatars, setAvatars] = useState<Record<number, string>>({});
  const canDelete = Boolean(props.currentAdmin?.is_super);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest<{ items: LeadsListItem[] }>(
        "GET",
        "/api/leads?limit=200",
      );
      setItems(res.items);
    } catch (e: any) {
      toast.push({
        title: "Помилка завантаження",
        message: e?.message ?? "Не вдалося отримати заявки",
        tone: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const groups = useMemo<LeadGroup[]>(() => {
    const q = search.trim().toLowerCase();
    const filtered = items.filter((x) => {
      if (status !== "all" && x.status !== status) return false;
      if (!q) return true;
      const fullName = [x.first_name, x.last_name].filter(Boolean).join(" ");
      const hay = [
        fullName,
        x.username ? `@${x.username}` : "",
        x.service_title,
        statusLabel[x.status],
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });

    const map = new Map<number, LeadGroup>();
    for (const lead of filtered) {
      const existing = map.get(lead.user_id);
      if (!existing) {
        map.set(lead.user_id, {
          user_id: lead.user_id,
          user_tg_id: lead.user_tg_id,
          username: lead.username,
          first_name: lead.first_name,
          last_name: lead.last_name,
          photo_file_id: lead.photo_file_id,
          leads: [lead],
          last_started_at: lead.started_at,
        });
      } else {
        existing.leads.push(lead);
        if (lead.started_at > existing.last_started_at) {
          existing.last_started_at = lead.started_at;
        }
      }
    }

    const out = Array.from(map.values());
    for (const g of out) {
      g.leads.sort((a, b) => (b.started_at > a.started_at ? 1 : -1));
    }
    out.sort((a, b) => (b.last_started_at > a.last_started_at ? 1 : -1));
    return out;
  }, [items, search, status]);

  const ensureAvatar = async (userId: number, photoFileId: string | null) => {
    if (!photoFileId) return;
    if (avatars[userId]) return;
    try {
      const blob = await apiRequestBlob(`/api/users/${userId}/photo`);
      const url = URL.createObjectURL(blob);
      setAvatars((prev) => ({ ...prev, [userId]: url }));
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    const top = groups.slice(0, 10);
    for (const g of top) void ensureAvatar(g.user_id, g.photo_file_id);
  }, [groups.map((g) => g.user_id).join("|")]);

  const openDetails = async (id: number) => {
    setSelectedId(id);
    setLoadingDetails(true);
    setDetails(null);
    try {
      const res = await apiRequest<LeadDetails>("GET", `/api/leads/${id}`);
      setDetails(res);
      if (res.user?.id) {
        void ensureAvatar(res.user.id, res.user.photo_file_id ?? null);
      }
    } catch (e: any) {
      toast.push({
        title: "Не вдалося завантажити деталі",
        message: e?.message ?? "Спробуйте ще раз",
        tone: "error",
      });
      setSelectedId(null);
    } finally {
      setLoadingDetails(false);
    }
  };

  const updateStatus = async (id: number, next: LeadStatus) => {
    try {
      await apiRequest("PATCH", `/api/leads/${id}/status`, { status: next });
      toast.push({ title: "Статус оновлено", tone: "success" });
      setItems((prev) =>
        prev.map((x) => (x.id === id ? { ...x, status: next } : x)),
      );
      if (details?.id === id) setDetails({ ...details, status: next });
    } catch (e: any) {
      toast.push({
        title: "Помилка оновлення",
        message: e?.message ?? "Не вдалося зберегти",
        tone: "error",
      });
    }
  };

  const acceptLead = async (id: number) => {
    const ok = await confirm({
      title: "Прийняти лід на перевірку",
      message: `Прийняти лід #${id} на перевірку?`,
      details: ["Після цього лід перейде в статус «На перевірці»."],
      confirmText: "Так, прийняти",
      cancelText: "Ні",
      tone: "primary",
    });
    if (!ok) return;
    setAccepting(true);
    try {
      const res = await apiRequest<any>("POST", `/api/leads/${id}/accept`);
      toast.push({ title: "Лід прийнято", tone: "success" });

      const patch = {
        status: (res?.status ?? "in_work") as LeadStatus,
        accepted_at: res?.accepted_at ?? new Date().toISOString(),
        accepted_by_admin: res?.accepted_by_admin ?? null,
      };

      setItems((prev) =>
        prev.map((x) => (x.id === id ? { ...x, ...patch } : x)),
      );
      if (details?.id === id) setDetails({ ...details, ...patch });
    } catch (e: any) {
      toast.push({
        title: "Не вдалося прийняти лід",
        message: e?.message ?? String(e),
        tone: "error",
      });
    } finally {
      setAccepting(false);
    }
  };

  const deleteLead = async (id: number) => {
    if (!canDelete) return;
    const ok = await confirm({
      title: "Видалити лід?",
      message: `Лід #${id} буде видалений разом із матеріалами. Дію не можна скасувати.`,
      confirmText: "Видалити",
      cancelText: "Скасувати",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await apiRequest("DELETE", `/api/leads/${id}`);
      setItems((prev) => prev.filter((x) => x.id !== id));
      if (selectedId === id) {
        setSelectedId(null);
        setDetails(null);
      }
      toast.push({ title: "Лід видалено", tone: "success" });
    } catch (e: any) {
      toast.push({
        title: "Помилка видалення",
        message: e?.message ?? "Не вдалося видалити",
        tone: "error",
      });
    }
  };

  const collapseAll = () => {
    const next: Record<number, boolean> = {};
    for (const g of groups) next[g.user_id] = true;
    setCollapsed(next);
  };

  const expandAll = () => setCollapsed({});

  const selectedLead = selectedId
    ? (items.find((x) => x.id === selectedId) ?? null)
    : null;

  return (
    <div className="w-full">
      {selectedId ? (
        /* РЕЖИМ ДЕТАЛЕЙ (НА ВЕСЬ ЭКРАН) */
        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
          <LeadDetailsPanel
            selectedId={selectedId}
            lead={selectedLead}
            details={details}
            loading={loadingDetails}
            avatarUrl={
              details?.user?.id ? (avatars[details.user.id] ?? null) : null
            }
            onClose={() => setSelectedId(null)}
            onUpdateStatus={(next) =>
              selectedId && void updateStatus(selectedId, next)
            }
            onAccept={() => selectedId && void acceptLead(selectedId)}
            accepting={accepting}
            canDelete={canDelete}
            onDelete={() => selectedId && void deleteLead(selectedId)}
          />
        </div>
      ) : (
        /* РЕЖИМ СПИСКА */
        <Card className="rounded-2xl bg-white shadow-sm border-zinc-100">
          <div className="px-5 py-4 sm:px-6 sm:py-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-lg font-semibold tracking-tight text-zinc-900">
                Заявки
                <span className="ml-2 text-sm font-medium text-zinc-500">
                  ({items.length})
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="secondary"
                  className="rounded-xl px-3 py-2"
                  onClick={() => void load()}
                  disabled={loading}
                >
                  <RefreshCcw
                    className={[
                      "h-4 w-4 mr-2",
                      loading ? "animate-spin" : "",
                    ].join(" ")}
                  />
                  Оновити
                </Button>
                <Button
                  variant="ghost"
                  className="rounded-xl px-3"
                  onClick={expandAll}
                >
                  Розгорнути
                </Button>
                <Button
                  variant="ghost"
                  className="rounded-xl px-3"
                  onClick={collapseAll}
                >
                  Згорнути
                </Button>
              </div>
            </div>
          </div>

          <Divider />

          <div className="px-5 py-4 sm:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Пошук за клієнтом, послугою або статусом…"
                  className="h-10 w-full rounded-xl bg-zinc-50 pl-10 pr-3 text-sm text-zinc-900 outline-none ring-1 ring-black/5 focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <Select
                className="h-10 w-full rounded-xl bg-white sm:w-[240px]"
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
              >
                <option value="all">Усі статуси</option>
                <option value="awaiting_review">
                  {statusLabel.awaiting_review}
                </option>
                <option value="in_review">{statusLabel.in_review}</option>
                <option value="confirmed">{statusLabel.confirmed}</option>
                <option value="in_work">{statusLabel.in_work}</option>
                <option value="paused">{statusLabel.paused}</option>
                <option value="filling">{statusLabel.filling}</option>
                <option value="done">{statusLabel.done}</option>
                <option value="delivered">{statusLabel.delivered}</option>
                <option value="closed">{statusLabel.closed}</option>
                <option value="rejected">{statusLabel.rejected}</option>
                <option value="lost">{statusLabel.lost}</option>
                <option value="abandoned">{statusLabel.abandoned}</option>
                <option value="studio_cancelled">
                  {statusLabel.studio_cancelled}
                </option>
              </Select>
            </div>
          </div>

          <div className="px-3 pb-5">
            {loading && items.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-20 text-sm text-zinc-500">
                <Spinner />
                Завантаження…
              </div>
            ) : groups.length === 0 ? (
              <div className="py-20 text-center">
                <div className="text-sm font-medium text-zinc-700">
                  Немає результатів
                </div>
                <div className="mt-1 text-sm text-zinc-500">
                  Спробуйте інші фільтри
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {groups.map((g) => (
                  <LeadGroupCard
                    key={g.user_id}
                    group={g}
                    avatarUrl={avatars[g.user_id] ?? null}
                    collapsed={Boolean(collapsed[g.user_id])}
                    onToggle={() =>
                      setCollapsed((prev) => ({
                        ...prev,
                        [g.user_id]: !prev[g.user_id],
                      }))
                    }
                    onRowClick={(leadId) => void openDetails(leadId)}
                    selectedId={selectedId}
                    onVisible={() =>
                      void ensureAvatar(g.user_id, g.photo_file_id)
                    }
                  />
                ))}
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

// Вспомогательные компоненты (LeadGroupCard, LeadStatusBadge, LeadDetailsPanel и т.д.)
// остаются почти такими же, но LeadDetailsPanel теперь имеет кнопку "Назад"

function LeadGroupCard(props: {
  group: LeadGroup;
  avatarUrl: string | null;
  collapsed: boolean;
  onToggle: () => void;
  onRowClick: (leadId: number) => void;
  selectedId: number | null;
  onVisible: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) props.onVisible();
      },
      { rootMargin: "200px" },
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [props.onVisible]);

  const name = formatUserName(
    props.group.first_name,
    props.group.last_name,
    props.group.username,
  );

  return (
    <div
      ref={ref}
      className="rounded-2xl bg-zinc-50/50 ring-1 ring-black/5 overflow-hidden transition-all"
    >
      <button
        type="button"
        onClick={props.onToggle}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-zinc-100/50 transition-colors"
      >
        <div className="flex min-w-0 items-center gap-3">
          <UserAvatar
            url={props.avatarUrl}
            firstName={props.group.first_name}
            lastName={props.group.last_name}
          />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-zinc-900">
              {name}
            </div>
            <div className="truncate text-xs text-zinc-500">
              {props.group.username
                ? `@${props.group.username}`
                : `ID ${props.group.user_tg_id}`}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-xs text-zinc-500 bg-white px-2 py-1 rounded-lg ring-1 ring-black/5">
            <Calendar className="h-3.5 w-3.5" />
            {formatDate(props.group.last_started_at, { dateOnly: true })}
          </div>
          <Badge className="rounded-full px-2.5 min-w-[24px] text-center">
            {props.group.leads.length}
          </Badge>
          <ChevronDown
            className={[
              "h-4 w-4 text-zinc-400 transition-transform",
              props.collapsed ? "-rotate-90" : "",
            ].join(" ")}
          />
        </div>
      </button>

      {!props.collapsed && (
        <div className="px-2 pb-2">
          <div className="rounded-xl bg-white ring-1 ring-black/5 divide-y divide-zinc-50">
            {props.group.leads.map((lead) => (
              <button
                key={lead.id}
                onClick={() => props.onRowClick(lead.id)}
                className="grid w-full grid-cols-12 gap-3 px-4 py-3 text-left text-sm hover:bg-zinc-50 first:rounded-t-xl last:rounded-b-xl transition-colors"
              >
                <div className="col-span-6 truncate font-medium text-zinc-900">
                  {lead.service_title}
                </div>
                <div className="col-span-3 flex flex-wrap items-center gap-2">
                  <LeadStatusBadge status={lead.status} />
                  <LeadSourceBadge source={lead.source ?? null} />
                  {lead.status === "awaiting_review" && !lead.accepted_at ? (
                    <Badge
                      tone="amber"
                      className="rounded-full px-2.5 py-1 text-[11px] font-medium"
                    >
                      Потрібно прийняти
                    </Badge>
                  ) : null}
                </div>
                <div className="col-span-3 flex items-center justify-end gap-2 text-xs text-zinc-400">
                  {formatDate(lead.started_at, { dateOnly: true })}
                  <ChevronRight className="h-4 w-4" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LeadDetailsPanel(props: {
  selectedId: number | null;
  lead: LeadsListItem | null;
  details: LeadDetails | null;
  loading: boolean;
  avatarUrl: string | null;
  onClose: () => void;
  onUpdateStatus: (next: LeadStatus) => void;
  onAccept: () => void;
  accepting: boolean;
  canDelete: boolean;
  onDelete: () => void;
}) {
  const [answerPhotos, setAnswerPhotos] = useState<Record<number, string>>({});
  const toast = useToast();
  const confirm = useConfirm();
  const { navigate } = useHashRoute();
  const currentStatus = (props.details?.status ??
    props.lead?.status ??
    "filling") as LeadStatus;
  const leadSource = props.details?.source ?? props.lead?.source ?? null;
  const acceptedAt =
    props.details?.accepted_at ?? props.lead?.accepted_at ?? null;
  const needsAccept = currentStatus === "awaiting_review" && !acceptedAt;
  const events = props.details?.events ?? [];
  const statusText = (s: string | null | undefined) => {
    if (!s) return "—";
    const m = statusLabel as any;
    return (m[s] as string | undefined) ?? s;
  };
  const statusIconFor = (s: string | null | undefined) => {
    if (!s) return null;
    const m = statusIcon as any;
    return (m[s] as ReactNode | undefined) ?? null;
  };
  const allowedNext: Partial<Record<LeadStatus, LeadStatus[]>> = {
    in_review: ["confirmed", "studio_cancelled"],
    confirmed: ["in_work", "rejected", "lost"],
    in_work: ["paused", "rejected", "lost", "done"],
    paused: ["in_work", "rejected", "lost", "done"],
    done: ["delivered"],
    delivered: ["closed", "client_not_confirmed"],
    client_not_confirmed: ["in_work", "rejected", "lost"],
    rejected: ["closed"],
    lost: ["closed"],
    studio_cancelled: ["closed"],
    closed: [],
  };
  const clientStage = ["filling", "abandoned", "awaiting_review"].includes(
    currentStatus,
  );
  const requiresConfirm = (next: LeadStatus) =>
    ["rejected", "lost", "studio_cancelled"].includes(next);
  const actionLabelFor = (next: LeadStatus) => {
    const overrides: Partial<
      Record<LeadStatus, Partial<Record<LeadStatus, string>>>
    > = {
      in_review: {
        confirmed: "Підтвердити",
        studio_cancelled: "Скасувати",
      },
      confirmed: {
        in_work: "Взяти в роботу",
        rejected: "Відмовити",
        lost: "Втрачено",
      },
      in_work: {
        paused: "Пауза",
        rejected: "Відмовити",
        lost: "Втрачено",
        done: "Завершено",
      },
      paused: {
        in_work: "Повернути в роботу",
        rejected: "Відмовити",
        lost: "Втрачено",
        done: "Завершено",
      },
      done: {
        delivered: "Передано клієнту",
      },
      delivered: {
        closed: "Клієнт підтвердив",
        client_not_confirmed: "Клієнт не підтвердив",
      },
      client_not_confirmed: {
        in_work: "Повернути в роботу",
        rejected: "Відмовити",
        lost: "Втрачено",
      },
      rejected: { closed: "Закрити" },
      lost: { closed: "Закрити" },
      studio_cancelled: { closed: "Закрити" },
    };
    return overrides[currentStatus]?.[next] ?? statusLabel[next];
  };
  const runTransition = async (next: LeadStatus) => {
    const action = actionLabelFor(next);
    const ok = await confirm({
      title: requiresConfirm(next)
        ? "Підтвердити критичну дію"
        : "Підтвердити дію",
      message: action,
      details: [
        `Поточний статус: ${statusLabel[currentStatus]}`,
        `Новий статус: ${statusLabel[next]}`,
      ],
      confirmText: "Підтвердити",
      cancelText: "Скасувати",
      tone: requiresConfirm(next) ? "danger" : "primary",
    });
    if (!ok) return;
    props.onUpdateStatus(next as any);
  };

  const projectId = props.details?.project_id ?? null;
  const canCreateProject = [
    "confirmed",
    "in_work",
    "paused",
    "done",
    "delivered",
    "client_not_confirmed",
  ].includes(currentStatus);

  const openProject = () => {
    if (!projectId) return;
    navigate("project", { params: { projectId } });
  };

  const createProject = async () => {
    const leadId = props.details?.id ?? props.lead?.id ?? null;
    if (!leadId) return;

    const ok = await confirm({
      title: "Створити проєкт?",
      message: "Проєкт потрібен для матеріалів та нотаток по цьому лідові.",
      confirmText: "Створити",
      cancelText: "Скасувати",
      tone: "primary",
    });
    if (!ok) return;

    try {
      const res = await apiRequest<any>("POST", "/api/projects", { lead_id: leadId });
      const pid = Number(res?.id ?? 0);
      if (pid > 0) navigate("project", { params: { projectId: pid } });
    } catch (e: any) {
      toast.push({
        title: "Помилка",
        message: e?.message ?? "Не вдалося створити проєкт",
        tone: "error",
      });
    }
  };

  useEffect(() => {
    let urls: string[] = [];
    setAnswerPhotos({});
    if (!props.details?.answers?.length) return;

    for (const a of props.details.answers) {
      if (!a.has_photo) continue;
      apiRequestBlob(`/api/lead_answers/${a.id}/photo`).then((blob) => {
        const url = URL.createObjectURL(blob);
        urls.push(url);
        setAnswerPhotos((prev) => ({ ...prev, [a.id]: url }));
      });
    }
    return () => urls.forEach(URL.revokeObjectURL);
  }, [props.details?.id]);

  const titleUser = props.lead
    ? formatUserName(
        props.lead.first_name,
        props.lead.last_name,
        props.lead.username,
      )
    : "Клієнт";

  return (
    <Card className="rounded-2xl bg-white shadow-lg border-none overflow-hidden">
      {/* HEADER С КНОПКОЙ НАЗАД */}
      <div className="flex items-center gap-4 px-5 py-4 sm:px-6 bg-zinc-50/50 border-b border-zinc-100">
        <Button
          variant="secondary"
          size="sm"
          onClick={props.onClose}
          className="rounded-xl"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Назад до списку
        </Button>
        <Divider orientation="vertical" className="h-6" />
        <div className="flex items-center gap-3 min-w-0">
          <UserAvatar
            url={props.avatarUrl}
            firstName={
              props.lead?.first_name ?? props.details?.user?.first_name ?? null
            }
            lastName={
              props.lead?.last_name ?? props.details?.user?.last_name ?? null
            }
            size="sm"
          />
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-zinc-900">
              {titleUser}
            </div>
            <div className="truncate text-xs text-zinc-500">
              {props.lead?.service_title ?? props.details?.service_title}
            </div>
          </div>
        </div>
        {props.canDelete ? (
          <div className="ml-auto">
            <Button
              variant="danger"
              size="sm"
              className="rounded-xl"
              onClick={props.onDelete}
            >
              Видалити лід
            </Button>
          </div>
        ) : null}
      </div>

      <div className="p-5 sm:p-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* ЛЕВАЯ КОЛОНКА: ИНФО */}
          <div className="space-y-6">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Статус заявки
              </label>
              <div className="mt-2 rounded-2xl bg-white p-4 ring-1 ring-black/5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    tone={statusTone[currentStatus]}
                    className="rounded-full px-3 py-1 text-[12px] font-semibold gap-2"
                  >
                    <span className="text-zinc-700">
                      {statusIcon[currentStatus]}
                    </span>
                    {statusLabel[currentStatus]}
                  </Badge>
                  <LeadSourceBadge source={leadSource} />
                  <div className="ml-auto text-[11px] text-zinc-500">
                    {needsAccept
                      ? "Очікує прийняття на перевірку"
                      : clientStage
                        ? "Клієнтський етап"
                        : `Доступні дії: ${allowedNext[currentStatus]?.length ?? 0}`}
                  </div>
                </div>

                {needsAccept ? (
                  <div className="mt-3 rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-100">
                    <div className="text-sm font-semibold text-amber-900">
                      Потрібно прийняти лід на перевірку
                    </div>
                    <div className="mt-1 text-xs text-amber-900/70">
                      Поки лід не прийнято, він буде показуватись у сповіщеннях.
                    </div>
                    <Button
                      className="mt-3 w-full rounded-xl"
                      onClick={props.onAccept}
                      disabled={props.accepting}
                    >
                      {props.accepting ? <Spinner /> : null}
                      Прийняти на перевірку
                    </Button>
                  </div>
                ) : clientStage ? (
                  <div className="mt-3 rounded-2xl bg-zinc-50 p-4 ring-1 ring-zinc-100">
                    <div className="text-sm font-semibold text-zinc-900">
                      Клієнтський етап
                    </div>
                    <div className="mt-1 text-xs text-zinc-600">
                      Ці статуси виставляє клієнт. Перехід на перевірку
                      з’явиться після відправки анкети.
                    </div>
                  </div>
                ) : (
                  <>
                    {(allowedNext[currentStatus] ?? []).length ? (
                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {(allowedNext[currentStatus] ?? []).map((next) => (
                          <Button
                            key={next}
                            variant={statusActionVariant[next] ?? "secondary"}
                            className="rounded-xl justify-start"
                            onClick={() => void runTransition(next)}
                          >
                            <span className="text-current">
                              {statusIcon[next]}
                            </span>
                            {actionLabelFor(next)}
                          </Button>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-3 text-xs text-zinc-500">
                        Немає доступних переходів.
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="rounded-2xl bg-white p-4 ring-1 ring-black/5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <FolderKanban className="h-4 w-4 text-zinc-700" />
                  <div className="text-sm font-semibold text-zinc-900">
                    Проєкт
                  </div>
                </div>
                {projectId ? (
                  <Badge
                    tone="green"
                    className="rounded-full px-3 py-1 text-[11px] font-semibold"
                  >
                    є
                  </Badge>
                ) : (
                  <Badge
                    tone="gray"
                    className="rounded-full px-3 py-1 text-[11px] font-semibold"
                  >
                    немає
                  </Badge>
                )}
              </div>
              <div className="mt-2 text-xs text-zinc-600">
                Матеріали, файли, нотатки та прогрес по роботі.
              </div>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Button
                  variant="secondary"
                  className="rounded-xl justify-start"
                  disabled={!projectId}
                  onClick={() => openProject()}
                >
                  <FolderKanban className="h-4 w-4" />
                  Відкрити
                </Button>
                <Button
                  className="rounded-xl justify-start"
                  disabled={Boolean(projectId) || !canCreateProject}
                  onClick={() => void createProject()}
                >
                  <FolderKanban className="h-4 w-4" />
                  Створити
                </Button>
              </div>
              {!canCreateProject && !projectId ? (
                <div className="mt-2 text-[11px] text-zinc-500">
                  Проєкт можна створити після підтвердження / взяття в роботу.
                </div>
              ) : null}
            </div>

            {!clientStage ? <FlowStepper status={currentStatus} /> : null}

            <div className="grid grid-cols-2 gap-4 p-4 rounded-2xl bg-zinc-50">
              <div>
                <div className="text-[10px] font-bold uppercase text-zinc-400">
                  Створено
                </div>
                <div className="mt-1 text-sm font-semibold text-zinc-900">
                  {props.details?.started_at
                    ? formatDate(props.details.started_at, { dateOnly: false })
                    : "—"}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase text-zinc-400">
                  Надіслано
                </div>
                <div className="mt-1 text-sm font-semibold text-zinc-900">
                  {props.details?.submitted_at
                    ? formatDate(props.details.submitted_at, {
                        dateOnly: false,
                      })
                    : "—"}
                </div>
              </div>
            </div>

            {events.length ? (
              <div className="rounded-2xl bg-white p-4 ring-1 ring-black/5">
                <div className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Таймлайн
                </div>
                <div className="mt-3 space-y-2">
                  {events.map((ev) => (
                    <div
                      key={ev.id}
                      className="flex items-start justify-between gap-3 rounded-xl bg-zinc-50 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-zinc-900 flex flex-wrap items-center gap-1.5">
                          <span className="inline-flex items-center gap-1">
                            {statusIconFor(ev.from_status)}
                            {statusText(ev.from_status)}
                          </span>
                          <span className="text-zinc-400">→</span>
                          <span className="inline-flex items-center gap-1">
                            {statusIconFor(ev.to_status)}
                            {statusText(ev.to_status)}
                          </span>
                        </div>
                        {ev.admin ? (
                          <div className="mt-0.5 text-[11px] text-zinc-500">
                            {ev.admin.avatar_emoji
                              ? `${ev.admin.avatar_emoji} `
                              : ""}
                            {ev.admin.display_name || ev.admin.username}
                          </div>
                        ) : null}
                      </div>
                      <div className="shrink-0 text-[11px] text-zinc-400">
                        {ev.created_at
                          ? formatDate(ev.created_at, { dateOnly: false })
                          : "—"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {/* ЦЕНТРАЛЬНАЯ/ПРАВАЯ: ОТВЕТЫ */}
          <div className="md:col-span-2">
            <h3 className="text-sm font-bold text-zinc-900 mb-4">
              Відповіді на питання
            </h3>
            {props.loading ? (
              <div className="flex items-center gap-2 py-10 text-zinc-400">
                <Spinner /> Завантаження...
              </div>
            ) : (
              <div className="space-y-4">
                {(props.details?.answers ?? []).map((a) => (
                  <div
                    key={a.id}
                    className="p-4 rounded-2xl ring-1 ring-black/[0.03] bg-white shadow-sm border border-zinc-100"
                  >
                    <div className="text-xs font-bold text-zinc-500 mb-1">
                      {a.question}
                    </div>
                    <div className="text-sm text-zinc-800 whitespace-pre-wrap leading-relaxed">
                      {a.answer || (
                        <span className="text-zinc-300">Немає відповіді</span>
                      )}
                    </div>
                    {a.has_photo && (
                      <div className="mt-4">
                        {answerPhotos[a.id] ? (
                          <img
                            src={answerPhotos[a.id]}
                            className="max-h-80 w-auto rounded-xl ring-1 ring-black/5"
                            alt="Ans"
                          />
                        ) : (
                          <div className="h-20 w-40 bg-zinc-50 animate-pulse rounded-xl" />
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

// Вспомогательные функции (Avatar, formatters и т.д. остаются без изменений)
function UserAvatar(props: {
  url: string | null;
  firstName: string | null;
  lastName: string | null;
  size?: "sm" | "md";
}) {
  const initials = getInitials(props.firstName, props.lastName);
  const sizeCls =
    props.size === "sm" ? "h-10 w-10 rounded-xl" : "h-11 w-11 rounded-2xl";
  return props.url ? (
    <img
      src={props.url}
      className={[sizeCls, "shrink-0 object-cover ring-1 ring-black/10"].join(
        " ",
      )}
      alt=""
    />
  ) : (
    <div
      className={[
        sizeCls,
        "shrink-0 bg-zinc-100 text-zinc-600 flex items-center justify-center font-bold text-xs ring-1 ring-black/5",
      ].join(" ")}
    >
      {initials}
    </div>
  );
}

function LeadStatusBadge(props: { status: LeadStatus }) {
  const s = props.status;
  return (
    <Badge
      tone={statusTone[s]}
      className="gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium"
    >
      <span className="text-zinc-600/90">{statusIcon[s]}</span>
      {statusLabel[s]}
    </Badge>
  );
}

function LeadSourceBadge(props: { source?: LeadSource | null }) {
  const src = props.source ?? null;
  if (!src) return null;
  const label = src === "bot" ? "Бот" : "Міні-апка";
  const icon =
    src === "bot" ? (
      <Bot className="h-3.5 w-3.5" />
    ) : (
      <Smartphone className="h-3.5 w-3.5" />
    );
  return (
    <Badge className="gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium">
      <span className="text-zinc-600/90">{icon}</span>
      {label}
    </Badge>
  );
}

function getInitials(f: string | null, l: string | null) {
  return ((f?.[0] || "") + (l?.[0] || "")).toUpperCase() || "•";
}

function formatUserName(f: string | null, l: string | null, u: string | null) {
  const full = [f, l].filter(Boolean).join(" ").trim();
  return full || (u ? `@${u}` : "Клієнт");
}

function formatDate(iso: string, opts: { dateOnly: boolean }): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("uk-UA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(!opts.dateOnly && { hour: "2-digit", minute: "2-digit" }),
  }).format(d);
}
