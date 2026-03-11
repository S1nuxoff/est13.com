import { ImagePlus, Megaphone, RefreshCcw, Send, Trash2, Wand2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { apiRequest, apiRequestForm } from "../api/http";
import type { Service } from "../api/types";
import { Button, Card, CardBody, Divider, Input, Select, Spinner, Textarea } from "../components/ui";
import { useToast } from "../lib/toast";

type BroadcastPayload = {
  text: string;
  photo_path?: string | null;
  support_enabled?: boolean | null;
  has_active_lead?: boolean | null;
  last_lead_statuses?: string[] | null;
  service_ids?: number[] | null;
  language_codes?: string[] | null;
  last_active_days?: number | null;
  tg_ids?: number[] | null;
};

const LEAD_STATUSES: { value: string; label: string }[] = [
  { value: "filling", label: "Заповнює (бриф)" },
  { value: "awaiting_review", label: "Очікує перевірки" },
  { value: "in_review", label: "На перевірці" },
  { value: "confirmed", label: "Підтверджено" },
  { value: "in_work", label: "В роботі" },
  { value: "paused", label: "Пауза" },
  { value: "done", label: "Завершено" },
  { value: "delivered", label: "Передано клієнту" },
  { value: "client_not_confirmed", label: "Клієнт не підтвердив" },
  { value: "closed", label: "Закрито" },
  { value: "rejected", label: "Відхилено" },
  { value: "lost", label: "Втрачено" },
  { value: "abandoned", label: "Скасовано (клієнт)" },
  { value: "studio_cancelled", label: "Скасовано (студія)" },
];

function parseTgIds(raw: string): number[] {
  const out: number[] = [];
  for (const part of raw.split(/[,\n\s]+/g)) {
    const t = part.trim();
    if (!t) continue;
    if (!/^\d+$/.test(t)) continue;
    out.push(Number(t));
  }
  return Array.from(new Set(out));
}

export function BroadcastPage() {
  const toast = useToast();
  const [services, setServices] = useState<Service[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);

  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [localPhotoUrl, setLocalPhotoUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [audienceMode, setAudienceMode] = useState<
    "all" | "support_on" | "support_off" | "active_brief" | "lead_status" | "tg_ids"
  >("all");
  const [leadStatuses, setLeadStatuses] = useState<string[]>([]);
  const [serviceId, setServiceId] = useState<string>("");
  const [languageCodes, setLanguageCodes] = useState<string>("");
  const [lastActiveDays, setLastActiveDays] = useState<string>("");
  const [tgIdsRaw, setTgIdsRaw] = useState<string>("");

  const [estimating, setEstimating] = useState(false);
  const [estimatedTotal, setEstimatedTotal] = useState<number | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadingServices(true);
    apiRequest<Service[]>("GET", "/api/services")
      .then((res) => {
        if (cancelled) return;
        setServices(res.sort((a, b) => a.sort - b.sort || a.id - b.id));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingServices(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (localPhotoUrl) URL.revokeObjectURL(localPhotoUrl);
    };
  }, [localPhotoUrl]);

  const payload: BroadcastPayload = useMemo(() => {
    const p: BroadcastPayload = { text: text.trim() };
    if (photoPath) p.photo_path = photoPath;

    const svcId = Number(serviceId);
    const svcIds = Number.isFinite(svcId) && svcId > 0 ? [svcId] : null;
    const langs = languageCodes
      .split(/[,\s]+/g)
      .map((x) => x.trim())
      .filter(Boolean);
    const days = Number(lastActiveDays);

    if (langs.length) p.language_codes = langs;
    if (Number.isFinite(days) && days > 0) p.last_active_days = Math.trunc(days);
    if (svcIds) p.service_ids = svcIds;

    if (audienceMode === "support_on") p.support_enabled = true;
    if (audienceMode === "support_off") p.support_enabled = false;
    if (audienceMode === "active_brief") p.has_active_lead = true;
    if (audienceMode === "lead_status") p.last_lead_statuses = leadStatuses.length ? leadStatuses : null;
    if (audienceMode === "tg_ids") p.tg_ids = parseTgIds(tgIdsRaw);

    return p;
  }, [text, photoPath, serviceId, languageCodes, lastActiveDays, audienceMode, leadStatuses, tgIdsRaw]);

  const insertTag = (open: string, close: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const before = text.slice(0, start);
    const sel = text.slice(start, end);
    const after = text.slice(end);
    const next = before + open + sel + close + after;
    setText(next);
    setTimeout(() => {
      el.focus();
      const caret = start + open.length + sel.length + close.length;
      el.setSelectionRange(caret, caret);
    }, 0);
  };

  const uploadPhoto = async (file: File) => {
    setUploadingPhoto(true);
    try {
      if (localPhotoUrl) URL.revokeObjectURL(localPhotoUrl);
      setLocalPhotoUrl(URL.createObjectURL(file));
      const form = new FormData();
      form.append("file", file);
      const res = await apiRequestForm<{ photo_path: string }>("POST", "/api/broadcast/photo", form);
      setPhotoPath(res.photo_path);
      toast.push({ title: "Фото додано", tone: "success" });
    } catch (e: any) {
      toast.push({ title: "Не вдалося завантажити фото", message: e?.message ?? String(e), tone: "error" });
      setPhotoPath(null);
      if (localPhotoUrl) URL.revokeObjectURL(localPhotoUrl);
      setLocalPhotoUrl(null);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const estimate = async () => {
    if (!payload.text) {
      toast.push({ title: "Додайте текст", tone: "info" });
      return;
    }
    setEstimating(true);
    try {
      const res = await apiRequest<{ total: number }>("POST", "/api/broadcast/estimate", payload);
      setEstimatedTotal(Number(res.total ?? 0));
    } catch (e: any) {
      toast.push({ title: "Не вдалося оцінити", message: e?.message ?? String(e), tone: "error" });
      setEstimatedTotal(null);
    } finally {
      setEstimating(false);
    }
  };

  const send = async () => {
    if (!payload.text) {
      toast.push({ title: "Додайте текст", tone: "info" });
      return;
    }
    if (estimatedTotal === null) {
      await estimate();
    }
    if (!confirm("Надіслати розсилку?")) return;

    setSending(true);
    try {
      const res = await apiRequest<{ ok: boolean; total: number; sent: number; failed: number }>(
        "POST",
        "/api/broadcast",
        payload,
      );
      toast.push({
        title: `Надіслано: ${res.sent} • помилки: ${res.failed}`,
        tone: res.failed ? "info" : "success",
      });
    } catch (e: any) {
      toast.push({ title: "Не вдалося надіслати", message: e?.message ?? String(e), tone: "error" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardBody className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold tracking-tight">Розсилка</div>
              <div className="text-sm text-zinc-500">
                Підтримується Telegram HTML-форматування: <code>&lt;b&gt;</code>, <code>&lt;i&gt;</code>,{" "}
                <code>&lt;code&gt;</code>, <code>&lt;a href=&quot;...&quot;&gt;</code>.
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={estimate} disabled={estimating || sending}>
                {estimating ? <Spinner /> : <RefreshCcw className="h-4 w-4" />}
                Оцінити
              </Button>
              <Button onClick={send} disabled={sending}>
                {sending ? <Spinner /> : <Send className="h-4 w-4" />}
                Надіслати
              </Button>
            </div>
          </div>

          <Divider />

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => insertTag("<b>", "</b>")}>
              <Wand2 className="h-4 w-4" /> B
            </Button>
            <Button variant="secondary" size="sm" onClick={() => insertTag("<i>", "</i>")}>
              <Wand2 className="h-4 w-4" /> I
            </Button>
            <Button variant="secondary" size="sm" onClick={() => insertTag("<code>", "</code>")}>
              <Wand2 className="h-4 w-4" /> Code
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => insertTag('<a href=\"https://\">', "</a>")}
            >
              <Wand2 className="h-4 w-4" /> Link
            </Button>
          </div>

          <Textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            placeholder="Текст розсилки…"
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-zinc-500">
              {estimatedTotal !== null ? (
                <span className="font-semibold text-zinc-700">Отримувачів: {estimatedTotal}</span>
              ) : (
                "Натисніть “Оцінити”, щоб побачити кількість отримувачів."
              )}
            </div>
            <div className="flex items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-white px-3 py-2 text-sm text-zinc-800 ring-1 ring-black/10 hover:bg-zinc-50">
                {uploadingPhoto ? <Spinner /> : <ImagePlus className="h-4 w-4" />}
                Додати фото
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void uploadPhoto(f);
                  }}
                />
              </label>
              {photoPath ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setPhotoPath(null);
                    if (localPhotoUrl) URL.revokeObjectURL(localPhotoUrl);
                    setLocalPhotoUrl(null);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  Прибрати фото
                </Button>
              ) : null}
            </div>
          </div>

          {localPhotoUrl ? (
            <div className="rounded-2xl bg-zinc-50 p-3 ring-1 ring-black/5">
              <div className="flex items-center gap-3">
                <img src={localPhotoUrl} alt="" className="h-20 w-20 rounded-xl object-cover ring-1 ring-black/10" />
                <div className="text-sm">
                  <div className="font-semibold text-zinc-900">Фото прикріплено</div>
                  <div className="text-xs text-zinc-500">
                    Надішлеться як зображення (caption до 1024 символів).
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-4">
          <div>
            <div className="text-sm font-semibold tracking-tight">Аудиторія</div>
            <div className="text-sm text-zinc-500">
              Налаштуйте, кому відправляється розсилка. Фільтри комбінуються.
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div>
              <div className="text-sm font-medium">Режим</div>
              <div className="mt-2">
                <Select value={audienceMode} onChange={(e) => setAudienceMode(e.target.value as any)}>
                  <option value="all">Усі користувачі</option>
                  <option value="support_on">Тільки з увімкненою підтримкою</option>
                  <option value="support_off">Тільки з вимкненою підтримкою</option>
                  <option value="active_brief">Тільки з активним брифом (filling)</option>
                  <option value="lead_status">За статусом останнього ліда</option>
                  <option value="tg_ids">За списком TG ID</option>
                </Select>
              </div>
            </div>

            <div>
              <div className="text-sm font-medium">Остання активність (дні)</div>
              <div className="mt-2">
                <Input
                  inputMode="numeric"
                  value={lastActiveDays}
                  onChange={(e) => setLastActiveDays(e.target.value)}
                  placeholder="Напр. 30"
                />
              </div>
            </div>

            <div>
              <div className="text-sm font-medium">Мова (через кому)</div>
              <div className="mt-2">
                <Input
                  value={languageCodes}
                  onChange={(e) => setLanguageCodes(e.target.value)}
                  placeholder="uk, ru, en"
                />
              </div>
            </div>

            <div>
              <div className="text-sm font-medium">Сервіс (останній лід)</div>
              <div className="mt-2">
                <Select value={serviceId} onChange={(e) => setServiceId(e.target.value)} disabled={loadingServices}>
                  <option value="">{loadingServices ? "Завантаження..." : "Будь-який"}</option>
                  {services.map((s) => (
                    <option key={s.id} value={String(s.id)}>
                      {s.title}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </div>

          {audienceMode === "lead_status" ? (
            <div>
              <div className="text-sm font-medium">Статуси (останній лід)</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {LEAD_STATUSES.map((s) => {
                  const active = leadStatuses.includes(s.value);
                  return (
                    <button
                      key={s.value}
                      onClick={() =>
                        setLeadStatuses((prev) =>
                          prev.includes(s.value) ? prev.filter((x) => x !== s.value) : [...prev, s.value],
                        )
                      }
                      className={[
                        "rounded-full px-3 py-1 text-xs font-bold ring-1 transition-colors",
                        active
                          ? "bg-zinc-900 text-white ring-zinc-900"
                          : "bg-white text-zinc-700 ring-black/10 hover:bg-zinc-50",
                      ].join(" ")}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {audienceMode === "tg_ids" ? (
            <div>
              <div className="text-sm font-medium">TG ID (через кому/пробіл/рядки)</div>
              <div className="mt-2">
                <Textarea
                  value={tgIdsRaw}
                  onChange={(e) => setTgIdsRaw(e.target.value)}
                  rows={3}
                  placeholder="123456789\n987654321"
                />
              </div>
              <div className="mt-2 text-xs text-zinc-500">
                Розпізнано ID: <span className="font-semibold text-zinc-700">{parseTgIds(tgIdsRaw).length}</span>
              </div>
            </div>
          ) : null}

          <div className="rounded-2xl bg-zinc-50 p-3 text-xs text-zinc-600 ring-1 ring-black/5">
            <div className="flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-zinc-500" />
              <span>
                Порада: спочатку натисніть “Оцінити”, потім “Надіслати”, щоб уникнути випадкових масових розсилок.
              </span>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
