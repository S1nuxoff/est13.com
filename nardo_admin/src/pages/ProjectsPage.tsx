import { FolderKanban, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { AdminMe } from "../api/auth";
import { apiRequest } from "../api/http";
import type { ProjectListItem } from "../api/types";
import { Badge, Button, Card, Divider, Input, Spinner } from "../components/ui";
import { useConfirm } from "../lib/confirm";
import { useHashRoute } from "../lib/router";
import { useToast } from "../lib/toast";

function fmtDate(value: string | null | undefined): string {
  if (!value) return "—";
  try {
    const d = new Date(value);
    return d.toLocaleString();
  } catch {
    return String(value);
  }
}

function formatUserName(
  first: string | null,
  last: string | null,
  username: string | null,
): string {
  const n = [first, last].filter(Boolean).join(" ").trim();
  if (n) return n;
  if (username) return `@${username}`;
  return "Клієнт";
}

export function ProjectsPage(props: { currentAdmin?: AdminMe | null }) {
  const toast = useToast();
  const confirm = useConfirm();
  const { navigate } = useHashRoute();

  const [items, setItems] = useState<ProjectListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const canDelete = Boolean(props.currentAdmin?.is_super);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest<{ items: ProjectListItem[] }>("GET", "/api/projects?limit=200");
      setItems(res.items ?? []);
    } catch (e: any) {
      toast.push({
        title: "Помилка",
        message: e?.message ?? "Не вдалося завантажити проєкти",
        tone: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => void load(), [load]);

  const removeProject = async (project: ProjectListItem) => {
    if (!canDelete) return;
    const ok = await confirm({
      title: "Видалити проект?",
      message: `Проект #${project.id} буде видалений разом із файлами та нотатками. Дію не можна скасувати.`,
      confirmText: "Видалити",
      cancelText: "Скасувати",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await apiRequest("DELETE", `/api/projects/${project.id}`);
      setItems((prev) => prev.filter((x) => x.id !== project.id));
      toast.push({ title: "Проект видалено", tone: "success" });
    } catch (e: any) {
      toast.push({
        title: "Помилка видалення",
        message: e?.message ?? "Не вдалося видалити",
        tone: "error",
      });
    }
  };

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((x) => {
      const name = formatUserName(x.user.first_name, x.user.last_name, x.user.username).toLowerCase();
      const hay = [
        String(x.id),
        String(x.lead_id),
        x.title,
        x.service_title,
        name,
        x.user.username ? `@${x.user.username}` : "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(s);
    });
  }, [items, q]);

  return (
    <div className="h-full w-full p-5 sm:p-6">
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-100 bg-zinc-50 px-5 py-4 sm:px-6">
          <div className="flex items-center gap-2">
            <FolderKanban className="h-5 w-5 text-zinc-700" />
            <div className="text-sm font-bold text-zinc-900">Проєкти</div>
            <Badge tone="gray" className="rounded-full px-3 py-1 text-[11px] font-semibold">
              {filtered.length}
            </Badge>
          </div>
          <div className="w-full sm:w-[360px]">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
                <Search className="h-4 w-4" />
              </span>
              <Input className="pl-10" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Пошук…" />
            </div>
          </div>
        </div>

        <div className="p-3 sm:p-4">
          {loading ? (
            <div className="p-4 text-sm text-zinc-500 flex items-center gap-2">
              <Spinner /> Завантаження…
            </div>
          ) : filtered.length ? (
            <div className="overflow-auto rounded-3xl ring-1 ring-black/5">
              <table className="min-w-[900px] w-full text-left text-sm">
                <thead className="bg-zinc-50">
                  <tr className="text-[11px] uppercase tracking-wider text-zinc-500">
                    <th className="px-4 py-3 font-bold">Проєкт</th>
                    <th className="px-4 py-3 font-bold">Клієнт</th>
                    <th className="px-4 py-3 font-bold">Послуга</th>
                    <th className="px-4 py-3 font-bold">Лід</th>
                    <th className="px-4 py-3 font-bold">Нотатки</th>
                    <th className="px-4 py-3 font-bold">Файли</th>
                    <th className="px-4 py-3 font-bold">Оновлено</th>
                    <th className="px-4 py-3 font-bold" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 bg-white">
                  {filtered.map((x) => (
                    <tr key={x.id} className="hover:bg-zinc-50">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-zinc-900 truncate max-w-[320px]">
                          {x.title || `Проєкт #${x.id}`}
                        </div>
                        <div className="text-xs text-zinc-500">#{x.id}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-zinc-900 truncate max-w-[220px]">
                          {formatUserName(x.user.first_name, x.user.last_name, x.user.username)}
                        </div>
                        <div className="text-xs text-zinc-500 truncate max-w-[220px]">
                          {x.user.username ? `@${x.user.username}` : `tg:${x.user.tg_id}`}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="truncate max-w-[260px] text-zinc-900">{x.service_title}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-zinc-900 font-medium">#{x.lead_id}</div>
                        <div className="text-xs text-zinc-500">{x.lead_status}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-zinc-900 font-semibold">{x.notes_count}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-zinc-900 font-semibold">{x.files_count}</span>
                      </td>
                      <td className="px-4 py-3 text-zinc-700">{fmtDate(x.updated_at)}</td>
                      <td className="px-4 py-3">
                        <Button
                          variant="secondary"
                          size="sm"
                          className="rounded-xl"
                          onClick={() => navigate("project", { params: { projectId: x.id } })}
                        >
                          Відкрити
                        </Button>
                        {canDelete ? (
                          <Button
                            variant="danger"
                            size="sm"
                            className="ml-2 rounded-xl"
                            onClick={() => void removeProject(x)}
                          >
                            ????????
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-3xl bg-zinc-50 p-6 ring-1 ring-black/5">
              <div className="text-sm font-semibold text-zinc-900">Поки що немає проєктів</div>
              <div className="mt-1 text-xs text-zinc-600">
                Створіть проєкт з карточки ліда, коли берете його в роботу.
              </div>
            </div>
          )}
        </div>
      </Card>
      <Divider className="mt-6" />
    </div>
  );
}
