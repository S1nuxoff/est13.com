import {
  ArrowLeft,
  Download,
  Eye,
  Pencil,
  FilePlus2,
  FolderKanban,
  Paperclip,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { apiRequest, apiRequestBlob, apiRequestForm } from "../api/http";
import type { LeadDetails, ProjectDetails } from "../api/types";
import { Badge, Button, Card, Divider, Input, Spinner, Textarea } from "../components/ui";
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

function fmtBytes(n: number | null | undefined): string {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v) || v <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let x = v;
  let i = 0;
  while (x >= 1024 && i < units.length - 1) {
    x /= 1024;
    i += 1;
  }
  return `${x.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
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

type LeadStatus = LeadDetails["status"];

const statusLabel: Record<string, string> = {
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
  client_not_confirmed: "Не підтверджено",
  closed: "Закрито",
};

const statusTone: Record<string, "gray" | "amber" | "green" | "red"> = {
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

export function ProjectPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const { params, navigate } = useHashRoute();

  const id = Number(params.get("projectId") ?? "");
  const projectId = Number.isFinite(id) && id > 0 ? id : null;

  const [tab, setTab] = useState<"overview" | "lead" | "notes" | "materials">(
    "overview",
  );
  const [details, setDetails] = useState<ProjectDetails | null>(null);
  const [leadDetails, setLeadDetails] = useState<LeadDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [noteBody, setNoteBody] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editingNoteBody, setEditingNoteBody] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [answerPhotos, setAnswerPhotos] = useState<Record<number, string>>({});

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [preview, setPreview] = useState<{
    open: boolean;
    fileId: number | null;
    filename: string;
    mimeType: string | null;
    url: string | null;
  }>({ open: false, fileId: null, filename: "", mimeType: null, url: null });

  const closePreview = () => {
    if (preview.url) URL.revokeObjectURL(preview.url);
    setPreview({ open: false, fileId: null, filename: "", mimeType: null, url: null });
  };

  const isPreviewable = (mimeType: string | null) => {
    const mt = (mimeType ?? "").toLowerCase();
    return mt.startsWith("image/") || mt === "application/pdf" || mt.startsWith("video/");
  };

  const downloadFile = async (fileId: number, filename: string) => {
    try {
      const blob = await apiRequestBlob(`/api/project_files/${fileId}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename || "file";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e: any) {
      toast.push({ title: "Помилка", message: e?.message ?? "Не вдалося завантажити файл", tone: "error" });
    }
  };

  const openPreview = async (fileId: number, filename: string, mimeType: string | null) => {
    try {
      const blob = await apiRequestBlob(`/api/project_files/${fileId}`);
      const url = URL.createObjectURL(blob);
      setPreview({ open: true, fileId, filename, mimeType, url });
    } catch (e: any) {
      toast.push({ title: "Помилка", message: e?.message ?? "Не вдалося відкрити файл", tone: "error" });
    }
  };

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const d = await apiRequest<ProjectDetails>("GET", `/api/projects/${projectId}`);
      setDetails(d);
      setEditingNoteId(null);
      setEditingNoteBody("");
      const leadId = Number(d.lead_id ?? 0);
      if (leadId > 0) {
        const ld = await apiRequest<LeadDetails>("GET", `/api/leads/${leadId}`);
        setLeadDetails(ld);
      } else {
        setLeadDetails(null);
      }
    } catch (e: any) {
      toast.push({ title: "Помилка", message: e?.message ?? "Не вдалося завантажити проєкт", tone: "error" });
      setDetails(null);
      setLeadDetails(null);
    } finally {
      setLoading(false);
    }
  }, [projectId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let urls: string[] = [];
    setAnswerPhotos({});
    if (!leadDetails?.answers?.length) return;
    for (const a of leadDetails.answers) {
      if (!a.has_photo) continue;
      apiRequestBlob(`/api/lead_answers/${a.id}/photo`).then((blob) => {
        const url = URL.createObjectURL(blob);
        urls.push(url);
        setAnswerPhotos((prev) => ({ ...prev, [a.id]: url }));
      });
    }
    return () => urls.forEach(URL.revokeObjectURL);
  }, [leadDetails?.id]);

  const saveProject = async () => {
    if (!details) return;
    setSaving(true);
    try {
      await apiRequest("PATCH", `/api/projects/${details.id}`, {
        title: details.title,
        description: details.description,
      });
      toast.push({ title: "Збережено", message: "Проєкт оновлено", tone: "success" });
      await load();
    } catch (e: any) {
      toast.push({ title: "Помилка", message: e?.message ?? "Не вдалося зберегти", tone: "error" });
    } finally {
      setSaving(false);
    }
  };

  const addNote = async () => {
    if (!details) return;
    const body = noteBody.trim();
    if (!body) return;
    try {
      await apiRequest("POST", `/api/projects/${details.id}/notes`, { body });
      setNoteBody("");
      await load();
    } catch (e: any) {
      toast.push({ title: "Помилка", message: e?.message ?? "Не вдалося додати нотатку", tone: "error" });
    }
  };

  const deleteNote = async (noteId: number) => {
    const ok = await confirm({
      title: "Видалити нотатку?",
      message: "Цю дію неможливо скасувати.",
      confirmText: "Видалити",
      cancelText: "Скасувати",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await apiRequest("DELETE", `/api/project_notes/${noteId}`);
      await load();
    } catch (e: any) {
      toast.push({ title: "Помилка", message: e?.message ?? "Не вдалося видалити", tone: "error" });
    }
  };

  const startEditNote = (id: number, body: string) => {
    setEditingNoteId(id);
    setEditingNoteBody(body);
  };

  const cancelEditNote = () => {
    setEditingNoteId(null);
    setEditingNoteBody("");
  };

  const saveEditedNote = async () => {
    if (!editingNoteId) return;
    const body = editingNoteBody.trim();
    if (!body) return;
    setSavingNote(true);
    try {
      await apiRequest("PATCH", `/api/project_notes/${editingNoteId}`, { body });
      cancelEditNote();
      await load();
    } catch (e: any) {
      toast.push({ title: "Помилка", message: e?.message ?? "Не вдалося зберегти нотатку", tone: "error" });
    } finally {
      setSavingNote(false);
    }
  };

  const uploadFile = async (f: File) => {
    if (!details) return;
    const form = new FormData();
    form.append("file", f);
    try {
      await apiRequestForm("POST", `/api/projects/${details.id}/files`, form);
      await load();
    } catch (e: any) {
      toast.push({ title: "Помилка", message: e?.message ?? "Не вдалося завантажити файл", tone: "error" });
    }
  };

  const deleteFile = async (fileId: number) => {
    const ok = await confirm({
      title: "Видалити файл?",
      message: "Файл буде видалено з проєкту.",
      confirmText: "Видалити",
      cancelText: "Скасувати",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await apiRequest("DELETE", `/api/project_files/${fileId}`);
      await load();
    } catch (e: any) {
      toast.push({ title: "Помилка", message: e?.message ?? "Не вдалося видалити файл", tone: "error" });
    }
  };

  const currentStatus = (leadDetails?.status ?? "filling") as LeadStatus;
  const nextOptions = useMemo(() => allowedNext[currentStatus] ?? [], [currentStatus]);

  const setStatus = async (next: LeadStatus) => {
    if (!leadDetails?.id) return;
    const ok = await confirm({
      title: "Підтвердити дію",
      message: `Змінити статус на “${statusLabel[next] ?? next}”?`,
      confirmText: "Підтвердити",
      cancelText: "Скасувати",
      tone: ["rejected", "lost", "studio_cancelled"].includes(next) ? "danger" : "primary",
    });
    if (!ok) return;
    try {
      await apiRequest("PATCH", `/api/leads/${leadDetails.id}/status`, { status: next });
      await load();
    } catch (e: any) {
      toast.push({ title: "Помилка", message: e?.message ?? "Не вдалося змінити статус", tone: "error" });
    }
  };

  if (!projectId) {
    return (
      <div className="h-full w-full p-5 sm:p-6">
        <Card className="p-6">
          <div className="text-sm font-semibold text-zinc-900">Проєкт не знайдено</div>
          <div className="mt-1 text-xs text-zinc-600">Відкрийте проєкт зі списку.</div>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full w-full p-5 sm:p-6">
      {preview.open && preview.url ? (
        <div className="fixed inset-0 z-[110]">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={closePreview} />
          <div className="absolute inset-0 grid place-items-center p-4">
            <div className="w-full max-w-[980px] rounded-[28px] bg-white shadow-[0_40px_120px_rgba(0,0,0,0.35)] ring-1 ring-black/10 overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-zinc-100 bg-zinc-50 px-5 py-4">
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-zinc-900">{preview.filename}</div>
                  <div className="mt-0.5 text-xs text-zinc-500">{preview.mimeType || "—"}</div>
                </div>
                <div className="flex items-center gap-2">
                  {preview.fileId ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="rounded-xl"
                      onClick={() => void downloadFile(preview.fileId as number, preview.filename)}
                    >
                      <Download className="h-4 w-4" /> Завантажити
                    </Button>
                  ) : null}
                  <Button variant="ghost" size="sm" className="rounded-xl" onClick={closePreview}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="max-h-[80vh] overflow-auto bg-white p-4">
                {String(preview.mimeType ?? "").toLowerCase().startsWith("image/") ? (
                  <img src={preview.url} className="mx-auto max-h-[72vh] max-w-full rounded-2xl ring-1 ring-black/5" />
                ) : String(preview.mimeType ?? "").toLowerCase() === "application/pdf" ? (
                  <iframe src={preview.url} className="h-[72vh] w-full rounded-2xl ring-1 ring-black/5" />
                ) : String(preview.mimeType ?? "").toLowerCase().startsWith("video/") ? (
                  <video src={preview.url} className="mx-auto max-h-[72vh] w-full rounded-2xl ring-1 ring-black/5" controls />
                ) : (
                  <div className="text-sm text-zinc-600">Попередній перегляд недоступний.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-100 bg-zinc-50 px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              className="rounded-xl"
              onClick={() => navigate("projects")}
            >
              <ArrowLeft className="h-4 w-4" /> Назад
            </Button>
            <Divider orientation="vertical" className="h-6" />
            <div className="min-w-0">
              <div className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Проєкт #{projectId}
              </div>
              <div className="mt-0.5 truncate text-sm font-bold text-zinc-900">
                {details?.title || "—"}
              </div>
              <div className="mt-0.5 truncate text-xs text-zinc-500">
                {details?.lead?.service_title ? `${details.lead.service_title} • ` : ""}
                заявка #{details?.lead_id}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone={statusTone[currentStatus]} className="rounded-full px-3 py-1 text-[11px] font-semibold">
              {statusLabel[currentStatus] ?? currentStatus}
            </Badge>
            <Button
              variant="secondary"
              className="rounded-2xl"
              disabled={!details || saving}
              onClick={() => void saveProject()}
            >
              {saving ? <Spinner /> : <Save className="h-4 w-4" />}
              Зберегти
            </Button>
          </div>
        </div>

        <div className="px-5 py-3 sm:px-6">
          <div className="inline-flex flex-wrap gap-2 rounded-2xl bg-zinc-50 p-1 ring-1 ring-black/5">
            {[
              { key: "overview", label: "Огляд" },
              { key: "lead", label: "Лід" },
              { key: "notes", label: "Нотатки" },
              { key: "materials", label: "Матеріали" },
            ].map((x) => (
              <button
                key={x.key}
                onClick={() => setTab(x.key as any)}
                className={[
                  "px-3 py-2 text-xs font-semibold rounded-2xl transition",
                  tab === x.key ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-white",
                ].join(" ")}
              >
                {x.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-5 sm:p-6">
          {loading ? (
            <div className="text-sm text-zinc-500 flex items-center gap-2">
              <Spinner /> Завантаження…
            </div>
          ) : !details ? (
            <div className="text-sm text-zinc-600">Не вдалося завантажити проєкт.</div>
          ) : tab === "overview" ? (
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="md:col-span-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                    Назва
                  </div>
                  <Input
                    className="mt-2"
                    value={details.title}
                    onChange={(e) => setDetails({ ...details, title: e.target.value })}
                    placeholder="Назва проєкту"
                  />
                  <div className="mt-4 text-xs font-bold uppercase tracking-wider text-zinc-400">
                    Опис
                  </div>
                  <Textarea
                    className="mt-2"
                    rows={5}
                    value={details.description ?? ""}
                    onChange={(e) => setDetails({ ...details, description: e.target.value })}
                    placeholder="Коротко: що робимо, дедлайни, важливі нюанси…"
                  />
                </div>
                <div className="rounded-3xl bg-zinc-50 p-4 ring-1 ring-black/5">
                  <div className="text-xs font-bold uppercase tracking-wider text-zinc-400">Клієнт</div>
                  <div className="mt-1 text-sm font-semibold text-zinc-900">
                    {details.lead?.user
                      ? formatUserName(
                          details.lead.user.first_name,
                          details.lead.user.last_name,
                          details.lead.user.username,
                        )
                      : "—"}
                  </div>
                  <div className="mt-3 text-xs font-bold uppercase tracking-wider text-zinc-400">Оновлено</div>
                  <div className="mt-1 text-sm font-semibold text-zinc-900">{fmtDate(details.updated_at)}</div>
                  <div className="mt-3 text-xs text-zinc-500">Створено: {fmtDate(details.created_at)}</div>
                  <Divider className="my-4" />
                  <div className="flex items-center justify-between text-xs text-zinc-600">
                    <span className="inline-flex items-center gap-2">
                      <Plus className="h-4 w-4 text-zinc-500" /> Нотатки
                    </span>
                    <span className="font-semibold text-zinc-900">{details.notes.length}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-zinc-600">
                    <span className="inline-flex items-center gap-2">
                      <Paperclip className="h-4 w-4 text-zinc-500" /> Файли
                    </span>
                    <span className="font-semibold text-zinc-900">{details.files.length}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : tab === "lead" ? (
            <div className="space-y-5">
              <div className="rounded-3xl bg-white p-4 ring-1 ring-black/5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <FolderKanban className="h-4 w-4 text-zinc-700" />
                    <div className="text-sm font-bold text-zinc-900">Статус</div>
                  </div>
                  <Badge tone={statusTone[currentStatus]} className="rounded-full px-3 py-1 text-[11px] font-semibold">
                    {statusLabel[currentStatus] ?? currentStatus}
                  </Badge>
                </div>
                <div className="mt-3 text-xs text-zinc-600">
                  Доступні переходи:
                </div>
                {nextOptions.length ? (
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {nextOptions.map((next) => (
                      <Button
                        key={next}
                        variant={["rejected", "lost", "studio_cancelled"].includes(next) ? "danger" : "secondary"}
                        className="rounded-xl justify-start"
                        onClick={() => void setStatus(next)}
                      >
                        {statusLabel[next] ?? next}
                      </Button>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 text-xs text-zinc-500">Немає доступних переходів.</div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-2xl bg-zinc-50 p-4 ring-1 ring-black/5">
                  <div className="text-[10px] font-bold uppercase text-zinc-400">Створено</div>
                  <div className="mt-1 text-sm font-semibold text-zinc-900">{fmtDate(leadDetails?.started_at)}</div>
                </div>
                <div className="rounded-2xl bg-zinc-50 p-4 ring-1 ring-black/5">
                  <div className="text-[10px] font-bold uppercase text-zinc-400">Надіслано</div>
                  <div className="mt-1 text-sm font-semibold text-zinc-900">{fmtDate(leadDetails?.submitted_at)}</div>
                </div>
                <div className="rounded-2xl bg-zinc-50 p-4 ring-1 ring-black/5">
                  <div className="text-[10px] font-bold uppercase text-zinc-400">Прийнято</div>
                  <div className="mt-1 text-sm font-semibold text-zinc-900">{fmtDate(leadDetails?.accepted_at ?? null)}</div>
                  {leadDetails?.accepted_by_admin ? (
                    <div className="mt-1 text-[11px] text-zinc-500">
                      {leadDetails.accepted_by_admin.display_name || leadDetails.accepted_by_admin.username}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="rounded-3xl bg-zinc-50 p-4 ring-1 ring-black/5">
                <div className="text-xs font-bold uppercase tracking-wider text-zinc-400">Відповіді</div>
                <div className="mt-3 space-y-2">
                  {leadDetails?.answers?.length ? (
                    leadDetails.answers.map((a) => (
                      <div key={a.id} className="rounded-2xl bg-white p-3 ring-1 ring-black/5">
                        <div className="text-xs font-semibold text-zinc-900">{a.question}</div>
                        <div className="mt-1 text-sm text-zinc-800 whitespace-pre-wrap">{a.answer}</div>
                        {a.has_photo && answerPhotos[a.id] ? (
                          <img
                            src={answerPhotos[a.id]}
                            className="mt-3 max-h-[240px] rounded-2xl ring-1 ring-black/5"
                          />
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-zinc-600">Немає відповідей.</div>
                  )}
                </div>
              </div>

              {leadDetails?.events?.length ? (
                <div className="rounded-3xl bg-zinc-50 p-4 ring-1 ring-black/5">
                  <div className="text-xs font-bold uppercase tracking-wider text-zinc-400">Таймлайн</div>
                  <div className="mt-3 space-y-2">
                    {leadDetails.events.map((ev) => (
                      <div key={ev.id} className="rounded-2xl bg-white p-3 ring-1 ring-black/5">
                        <div className="text-xs text-zinc-500">{fmtDate(ev.created_at)}</div>
                        <div className="mt-1 text-sm font-semibold text-zinc-900">
                          {ev.from_status ? `${ev.from_status} → ` : ""}{ev.to_status ?? "—"}
                        </div>
                        {ev.admin ? (
                          <div className="mt-1 text-[11px] text-zinc-500">
                            {ev.admin.display_name || ev.admin.username}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : tab === "notes" ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="rounded-3xl bg-white ring-1 ring-black/5">
                <div className="p-4 flex items-center justify-between gap-3">
                  <div className="text-sm font-bold text-zinc-900">Нова нотатка</div>
                </div>
                <Divider />
                <div className="p-4 space-y-3">
                  <Textarea
                    rows={4}
                    value={noteBody}
                    onChange={(e) => setNoteBody(e.target.value)}
                    placeholder="Додати нотатку…"
                  />
                  <Button className="w-full rounded-2xl" onClick={() => void addNote()}>
                    <Plus className="h-4 w-4" /> Додати
                  </Button>
                </div>
              </div>
              <div className="rounded-3xl bg-white ring-1 ring-black/5">
                <div className="p-4 flex items-center justify-between gap-3">
                  <div className="text-sm font-bold text-zinc-900">Нотатки</div>
                  <Badge tone="gray" className="rounded-full px-3 py-1 text-[11px] font-semibold">
                    {details.notes.length}
                  </Badge>
                </div>
                <Divider />
                <div className="p-4 space-y-2 max-h-[560px] overflow-auto">
                  {details.notes.length ? (
                    details.notes.map((n) => (
                      <div key={n.id} className="rounded-2xl bg-zinc-50 p-3 ring-1 ring-black/5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            {editingNoteId === n.id ? (
                              <>
                                <Textarea
                                  rows={4}
                                  value={editingNoteBody}
                                  onChange={(e) => setEditingNoteBody(e.target.value)}
                                />
                                <div className="mt-2 flex flex-wrap gap-2">
                                  <Button
                                    size="sm"
                                    className="rounded-xl"
                                    disabled={savingNote}
                                    onClick={() => void saveEditedNote()}
                                  >
                                    {savingNote ? <Spinner /> : <Save className="h-4 w-4" />}
                                    Зберегти
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    className="rounded-xl"
                                    disabled={savingNote}
                                    onClick={() => cancelEditNote()}
                                  >
                                    Скасувати
                                  </Button>
                                </div>
                              </>
                            ) : (
                              <div className="whitespace-pre-wrap text-sm text-zinc-900">{n.body}</div>
                            )}
                            <div className="mt-2 text-[11px] text-zinc-500">
                              {fmtDate(n.created_at)}
                              {n.admin ? ` • ${n.admin.display_name || n.admin.username}` : ""}
                            </div>
                          </div>
                          {editingNoteId !== n.id ? (
                            <div className="shrink-0 flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="rounded-xl"
                                onClick={() => startEditNote(n.id, n.body)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="rounded-xl"
                                onClick={() => void deleteNote(n.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-zinc-600">Нотаток поки немає.</div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-3xl bg-white ring-1 ring-black/5">
              <div className="p-4 flex items-center justify-between gap-3">
                <div className="text-sm font-bold text-zinc-900">Матеріали</div>
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void uploadFile(f);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    className="rounded-xl"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <FilePlus2 className="h-4 w-4" /> Додати файл
                  </Button>
                </div>
              </div>
              <Divider />
              <div className="p-4">
                {details.files.length ? (
                  <div className="space-y-2">
                    {details.files.map((f) => (
                      <div
                        key={f.id}
                        className="flex items-center justify-between gap-3 rounded-2xl bg-zinc-50 p-3 ring-1 ring-black/5"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-zinc-900 flex items-center gap-2">
                            <Paperclip className="h-4 w-4 text-zinc-500" />
                            {f.filename}
                          </div>
                          <div className="mt-1 text-[11px] text-zinc-500">
                            {fmtBytes(f.size_bytes)} • {fmtDate(f.created_at)}
                            {f.admin ? ` • ${f.admin.display_name || f.admin.username}` : ""}
                          </div>
                        </div>
                        <div className="shrink-0 flex items-center gap-2">
                          {isPreviewable(f.mime_type) ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              className="rounded-xl"
                              onClick={() => void openPreview(f.id, f.filename, f.mime_type)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          ) : null}
                          <Button
                            variant="secondary"
                            size="sm"
                            className="rounded-xl"
                            onClick={() => void downloadFile(f.id, f.filename)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="rounded-xl"
                            onClick={() => void deleteFile(f.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl bg-zinc-50 p-4 ring-1 ring-black/5">
                    <div className="text-sm font-semibold text-zinc-900">Немає файлів</div>
                    <div className="mt-1 text-xs text-zinc-600">Додайте матеріали: логотипи, тексти, ТЗ.</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
