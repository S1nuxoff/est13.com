import {
  ArrowUpRight,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  RefreshCcw,
  TrendingUp,
  XCircle,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { apiRequest } from "../api/http";
import {
  Badge,
  Button,
  Card,
  CardBody,
  Divider,
  Spinner,
} from "../components/ui";
import { useToast } from "../lib/toast";
import { useConfirm } from "../lib/confirm";

type DashboardServiceItem = {
  service_id: number;
  title: string;
  total: number;
};
type DashboardDayItem = { day: string; total: number };

type LeadStatus =
  | "filling"
  | "abandoned"
  | "awaiting_review"
  | "in_review"
  | "confirmed"
  | "in_work"
  | "paused"
  | "rejected"
  | "lost"
  | "studio_cancelled"
  | "done"
  | "delivered"
  | "closed";

type DashboardLeadItem = {
  id: number;
  service_title: string;
  status: LeadStatus;
  user_tg_id: number;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  started_at: string;
  submitted_at: string | null;
};

type DashboardOut = {
  total_leads: number;
  in_progress: number;
  submitted: number;
  cancelled: number;
  review: number;
  contacted: number;
  in_work: number;
  done: number;
  lost: number;
  started_24h: number;
  submitted_24h: number;
  started_7d: number;
  submitted_7d: number;
  recent_leads: DashboardLeadItem[];
  work_leads: DashboardLeadItem[];
  days: number;
  per_day: DashboardDayItem[];
  top_services: DashboardServiceItem[];
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
  paused: "gray",
  closed: "gray",
  abandoned: "red",
  rejected: "red",
  lost: "red",
  studio_cancelled: "red",
};

function formatDayLabel(day: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return day;
  return `${m[3]}.${m[2]}`;
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function leadUserLabel(lead: DashboardLeadItem) {
  const fullName = [lead.first_name, lead.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  if (fullName) return fullName;
  if (lead.username) return `@${lead.username}`;
  return `tg:${lead.user_tg_id}`;
}

function Sparkline(props: { values: number[] }) {
  const w = 140;
  const h = 42;
  const vals = props.values.length ? props.values : [0];
  const max = Math.max(...vals, 1);
  const pts = vals.map((v, i) => {
    const x = (i / Math.max(vals.length - 1, 1)) * (w - 2) + 1;
    const y = h - 1 - (v / max) * (h - 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className="text-emerald-300"
    >
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MetricCard(props: {
  title: string;
  value: string;
  hint?: string;
  icon: ReactNode;
  tone?: "mint" | "peach" | "blue" | "zinc";
}) {
  const tone = props.tone ?? "zinc";
  const bg =
    tone === "mint"
      ? "bg-emerald-100/35"
      : tone === "peach"
        ? "bg-orange-100/40"
        : tone === "blue"
          ? "bg-sky-100/35"
          : "bg-zinc-100/40";
  const iconBg =
    tone === "mint"
      ? "bg-emerald-200/50 text-emerald-700"
      : tone === "peach"
        ? "bg-orange-200/50 text-orange-700"
        : tone === "blue"
          ? "bg-sky-200/50 text-sky-700"
          : "bg-zinc-200/60 text-zinc-700";

  return (
    <Card
      className={["shadow-[0_18px_60px_rgba(15,23,42,0.08)]", bg].join(" ")}
    >
      <CardBody className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm text-zinc-500">{props.title}</div>
          <div className="mt-1 text-2xl font-semibold tracking-tight">
            {props.value}
          </div>
          {props.hint ? (
            <div className="mt-1 text-xs text-zinc-500">{props.hint}</div>
          ) : null}
        </div>
        <div
          className={[
            "grid h-10 w-10 place-items-center rounded-2xl",
            iconBg,
          ].join(" ")}
        >
          {props.icon}
        </div>
      </CardBody>
    </Card>
  );
}

function LineChart(props: { points: { day: string; total: number }[] }) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const w = 720;
  const h = 220;
  const padX = 18;
  const padY = 18;
  const innerW = w - padX * 2;
  const innerH = h - padY * 2;

  const values = props.points.length ? props.points : [{ day: "", total: 0 }];
  const max = Math.max(...values.map((x) => x.total), 1);

  const pts = values.map((p, i) => {
    const x = padX + (i / Math.max(values.length - 1, 1)) * innerW;
    const y = padY + innerH - (p.total / max) * innerH;
    return { x, y, day: p.day, total: p.total };
  });

  let path = "";
  if (pts.length) {
    if (pts.length === 1) {
      path = `M ${pts[0].x} ${pts[0].y}`;
    } else {
      path = `M ${pts[0].x} ${pts[0].y}`;
      for (let i = 0; i < pts.length - 1; i += 1) {
        const p0 = pts[i];
        const p1 = pts[i + 1];
        const mx = (p0.x + p1.x) / 2;
        path += ` C ${mx} ${p0.y} ${mx} ${p1.y} ${p1.x} ${p1.y}`;
      }
    }
  }

  const onMove = (e: React.MouseEvent) => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = e.clientX - r.left;
    const t = Math.min(
      Math.max((x / r.width) * (pts.length - 1), 0),
      pts.length - 1,
    );
    setHoverIdx(Math.round(t));
  };
  const onLeave = () => setHoverIdx(null);

  const hover =
    hoverIdx === null
      ? null
      : pts[Math.max(0, Math.min(pts.length - 1, hoverIdx))];

  return (
    <div
      ref={wrapRef}
      className="relative"
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      <svg viewBox={`0 0 ${w} ${h}`} className="h-[220px] w-full">
        {[0.2, 0.5, 0.8].map((k) => (
          <line
            key={k}
            x1={padX}
            x2={w - padX}
            y1={padY + innerH * k}
            y2={padY + innerH * k}
            stroke="rgba(0,0,0,0.06)"
            strokeWidth="1"
          />
        ))}

        <path
          d={path}
          fill="none"
          stroke="#10b981"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d={`${path} L ${w - padX} ${h - padY} L ${padX} ${h - padY} Z`}
          fill="url(#grad)"
          opacity="0.25"
        />
        <defs>
          <linearGradient id="grad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
        </defs>

        {pts.map((p, idx) => (
          <circle
            key={idx}
            cx={p.x}
            cy={p.y}
            r={2.5}
            fill="#10b981"
            opacity={0.75}
          />
        ))}

        {/* x labels */}
        {values.map((p, idx) => {
          const showEvery = Math.ceil(values.length / 8);
          if (idx % showEvery !== 0 && idx !== values.length - 1) return null;
          const x = padX + (idx / Math.max(values.length - 1, 1)) * innerW;
          return (
            <text
              key={idx}
              x={x}
              y={h - 4}
              textAnchor="middle"
              fontSize="10"
              fill="rgba(0,0,0,0.45)"
            >
              {formatDayLabel(p.day)}
            </text>
          );
        })}

        {hover ? (
          <line
            x1={hover.x}
            x2={hover.x}
            y1={padY}
            y2={h - padY}
            stroke="rgba(0,0,0,0.12)"
            strokeWidth="1"
          />
        ) : null}
      </svg>

      {hover ? (
        <div
          className="pointer-events-none absolute top-3 rounded-2xl bg-black/85 px-3 py-2 text-xs text-white shadow-lg"
          style={{
            left: Math.min(Math.max(hover.x / 720, 0.05), 0.7) * 100 + "%",
          }}
        >
          <div className="font-medium">{formatDayLabel(hover.day)}</div>
          <div className="text-white/80">{hover.total} заявок</div>
        </div>
      ) : null}
    </div>
  );
}

function TopServicesCard(props: { items: DashboardServiceItem[] }) {
  const items = props.items ?? [];
  const max = Math.max(...items.map((x) => x.total), 1);
  return (
    <Card>
      <CardBody className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold tracking-tight">
              Топ послуг
            </div>
            <div className="text-xs text-zinc-500">За весь час</div>
          </div>
          <Badge tone="gray">{items.length}</Badge>
        </div>
        <div className="space-y-2">
          {items.length ? (
            items.map((s) => (
              <div key={s.service_id} className="space-y-1">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <div className="truncate text-zinc-800">{s.title}</div>
                  <div className="shrink-0 text-xs text-zinc-500">
                    {s.total}
                  </div>
                </div>
                <div className="h-2 w-full rounded-full bg-zinc-100 ring-1 ring-black/5">
                  <div
                    className="h-2 rounded-full bg-zinc-900"
                    style={{ width: `${Math.round((s.total / max) * 100)}%` }}
                  />
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl bg-white/60 p-4 text-sm text-zinc-600 ring-1 ring-black/5">
              Немає даних.
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

function LeadsCard(props: {
  title: string;
  items: DashboardLeadItem[];
  showOpenAll?: boolean;
}) {
  const items = props.items ?? [];
  return (
    <Card>
      <CardBody className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold tracking-tight">
            {props.title}
          </div>
          {props.showOpenAll ? (
            <Button
              variant="secondary"
              onClick={() => (window.location.hash = "leads")}
            >
              Відкрити всі
            </Button>
          ) : null}
        </div>
        {items.length ? (
          <div className="divide-y divide-black/5 rounded-3xl bg-white/60 ring-1 ring-black/5">
            {items.map((x) => (
              <div key={x.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-mono text-xs text-zinc-600">
                        #{x.id}
                      </div>
                      <Badge tone={statusTone[x.status]}>
                        {statusLabel[x.status]}
                      </Badge>
                    </div>
                    <div className="mt-1 truncate text-sm font-medium text-zinc-900">
                      {x.service_title}
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">
                      {leadUserLabel(x)}
                    </div>
                  </div>
                  <div className="shrink-0 text-right text-xs text-zinc-500">
                    <div title={x.started_at}>
                      Старт: {formatDateTime(x.started_at)}
                    </div>
                    <div title={x.submitted_at ?? ""}>
                      Надіслано: {formatDateTime(x.submitted_at)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-3xl bg-white/60 p-6 text-sm text-zinc-600 ring-1 ring-black/5">
            Поки немає заявок.
          </div>
        )}
      </CardBody>
    </Card>
  );
}

export function DashboardPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardOut | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiRequest<DashboardOut>(
        "GET",
        `/api/dashboard?days=${days}`,
      );
      setData(res);
    } catch (e: any) {
      toast.push({
        title: "Помилка завантаження дашборду",
        message: e?.message ?? String(e),
        tone: "error",
      });
    } finally {
      setLoading(false);
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
    try {
      await apiRequest("POST", `/api/leads/${id}/accept`);
      toast.push({ title: "Лід прийнято", tone: "success" });
      void load();
    } catch (e: any) {
      toast.push({
        title: "Не вдалося прийняти лід",
        message: e?.message ?? String(e),
        tone: "error",
      });
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  const spark = useMemo(
    () => (data?.per_day ?? []).map((x) => x.total),
    [data],
  );
  const conversion = useMemo(() => {
    if (!data || !data.total_leads) return 0;
    return Math.round((data.submitted / data.total_leads) * 100);
  }, [data]);
  const inWork = useMemo(() => {
    if (!data) return 0;
    return (data.review ?? 0) + (data.contacted ?? 0) + (data.in_work ?? 0);
  }, [data]);
  const unaccepted = Number((data as any)?.unaccepted ?? 0);
  const unacceptedLeads = ((data as any)?.unaccepted_leads ?? []) as any[];

  return (
    <div className="space-y-5">
      {data && unaccepted > 0 ? (
        <Card className="rounded-3xl border-sky-100 bg-sky-50/60 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
          <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-sky-900">
                Є ліди, які потрібно прийняти на перевірку
              </div>
              <div className="mt-1 text-xs text-sky-900/70">
                Очікують: <span className="font-semibold">{unaccepted}</span>
              </div>
              {unacceptedLeads.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {unacceptedLeads.slice(0, 6).map((l) => (
                    <button
                      key={String(l.id)}
                      className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-sky-900 ring-1 ring-sky-200 hover:bg-white"
                      onClick={() => void acceptLead(Number(l.id))}
                      title="Прийняти лід у роботу"
                    >
                      Прийняти #{l.id}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="flex gap-2">
              <Button
                variant="secondary"
                className="rounded-2xl"
                onClick={() => (window.location.hash = "leads")}
              >
                Відкрити ліди
              </Button>
            </div>
          </CardBody>
        </Card>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {[7, 14, 30, 90].map((d) => (
            <button
              key={d}
              className={[
                "inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium ring-1 ring-black/5",
                days === d
                  ? "bg-zinc-900 text-white"
                  : "bg-white/70 text-zinc-800 hover:bg-white",
              ].join(" ")}
              onClick={() => setDays(d)}
            >
              {d} днів
            </button>
          ))}
        </div>
        <Button
          variant="secondary"
          onClick={() => void load()}
          disabled={loading}
        >
          <RefreshCcw className="h-4 w-4" />
          Оновити
        </Button>
      </div>

      {loading && !data ? (
        <Card>
          <CardBody className="flex items-center gap-2 text-sm text-zinc-600">
            <Spinner /> Завантаження…
          </CardBody>
        </Card>
      ) : null}

      {data ? (
        <div className="space-y-5">
          <div className="grid grid-cols-12 gap-5">
            <div className="col-span-12 lg:col-span-7">
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-800 p-6 text-white shadow-[0_30px_90px_rgba(15,23,42,0.30)] ring-1 ring-white/10">
                <div className="pointer-events-none absolute inset-0">
                  <div className="absolute -left-24 -top-24 h-64 w-64 rounded-full bg-emerald-500/15 blur-3xl" />
                  <div className="absolute -right-24 -bottom-24 h-64 w-64 rounded-full bg-indigo-500/15 blur-3xl" />
                </div>
                <div className="relative flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm text-white/70">Усього заявок</div>
                    <div className="mt-2 text-3xl font-semibold tracking-tight">
                      {data.total_leads}
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-xs text-white/70">
                      <ArrowUpRight className="h-4 w-4" />
                      Конверсія в “Надіслано”: {conversion}%
                    </div>
                  </div>
                  <div className="rounded-2xl bg-white/10 px-3 py-2 text-xs text-white/70 ring-1 ring-white/10">
                    останні {data.days} днів
                  </div>
                </div>

                <div className="relative mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <div className="rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
                    <div className="text-xs text-white/60">Старт (24h)</div>
                    <div className="mt-1 text-lg font-semibold tracking-tight text-white">
                      {data.started_24h}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
                    <div className="text-xs text-white/60">Надіслано (24h)</div>
                    <div className="mt-1 text-lg font-semibold tracking-tight text-white">
                      {data.submitted_24h}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
                    <div className="text-xs text-white/60">Надіслано (7d)</div>
                    <div className="mt-1 text-lg font-semibold tracking-tight text-white">
                      {data.submitted_7d}
                    </div>
                  </div>
                </div>

                <div className="relative mt-6 flex items-end justify-between gap-4">
                  <Sparkline
                    values={spark.slice(-Math.min(spark.length, 24))}
                  />
                  <div className="text-right text-xs text-white/70">
                    <div className="text-white/60">Надіслано (всього)</div>
                    <div className="mt-1 text-lg font-semibold tracking-tight text-white">
                      {data.submitted}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-span-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-5 lg:grid-cols-1">
              <MetricCard
                title="В роботі (загалом)"
                value={String(inWork)}
                hint={`Перевірка: ${data.review} • Зв’язались: ${data.contacted} • В роботі: ${data.in_work}`}
                icon={<BriefcaseBusiness className="h-5 w-5" />}
                tone="peach"
              />
              <div className="grid grid-cols-2 gap-4">
                <MetricCard
                  title="Заповнює"
                  value={String(data.in_progress)}
                  icon={<Clock3 className="h-5 w-5" />}
                  tone="blue"
                />
                <MetricCard
                  title="Надіслано"
                  value={String(data.submitted)}
                  icon={<CheckCircle2 className="h-5 w-5" />}
                  tone="mint"
                />
                <MetricCard
                  title="Завершено"
                  value={String(data.done)}
                  icon={<TrendingUp className="h-5 w-5" />}
                  tone="mint"
                />
                <MetricCard
                  title="Скасовано"
                  value={String(data.cancelled)}
                  icon={<XCircle className="h-5 w-5" />}
                  tone="zinc"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-5">
            <div className="col-span-12 lg:col-span-7">
              <Card>
                <CardBody className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold tracking-tight">
                        Динаміка заявок
                      </div>
                      <div className="text-xs text-zinc-500">
                        Кількість стартів по днях
                      </div>
                    </div>
                    <Badge tone="gray">{data.days} днів</Badge>
                  </div>
                  <LineChart points={data.per_day} />
                </CardBody>
              </Card>

              <div className="mt-5">
                <TopServicesCard items={data.top_services} />
              </div>
            </div>

            <div className="col-span-12 space-y-5 lg:col-span-5">
              <LeadsCard title="В роботі (останні)" items={data.work_leads} />
              <Divider />
              <LeadsCard
                title="Останні заявки"
                items={data.recent_leads}
                showOpenAll
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
