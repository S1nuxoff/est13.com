import { Eye, Image as ImageIcon, Plus, Save, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { apiRequest, apiRequestBlob, apiRequestForm } from "../api/http";
import type { BotText } from "../api/types";
import { Badge, Button, Card, CardBody, Divider, Input, PageTitle, Textarea } from "../components/ui";
import { useToast } from "../lib/toast";

type Row = BotText & { dirty?: boolean };

export function TextsPage() {
  const toast = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [photoBusyKey, setPhotoBusyKey] = useState<string | null>(null);

  const dirtyCount = useMemo(() => rows.filter((r) => r.dirty).length, [rows]);
  const photoInputId = (key: string) => `text_photo_${key.replace(/[^a-zA-Z0-9_-]/g, "_")}`;

  const load = async () => {
    setLoading(true);
    try {
      const items = await apiRequest<BotText[]>("GET", "/api/texts");
      setRows(items.map((x) => ({ ...x, dirty: false })));
    } catch (e: any) {
      toast.push({ title: "Не вдалося завантажити тексти", message: e?.message ?? String(e), tone: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateRow = (key: string, value: string) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, value, dirty: true } : r)));
  };

  const saveRow = async (key: string) => {
    const row = rows.find((r) => r.key === key);
    if (!row) return;
    try {
      await apiRequest<BotText>("PUT", `/api/texts/${encodeURIComponent(key)}`, { value: row.value });
      setRows((prev) => prev.map((r) => (r.key === key ? { ...r, dirty: false } : r)));
      toast.push({ title: "Збережено", tone: "success" });
    } catch (e: any) {
      toast.push({ title: "Помилка збереження", message: e?.message ?? String(e), tone: "error" });
    }
  };

  const saveAll = async () => {
    const keys = rows.filter((r) => r.dirty).map((r) => r.key);
    for (const key of keys) {
      await saveRow(key);
    }
  };

  const add = async () => {
    const key = newKey.trim();
    if (!key) {
      toast.push({ title: "Вкажіть ключ", tone: "error" });
      return;
    }
    try {
      const created = await apiRequest<BotText>("POST", "/api/texts", { key, value: newValue });
      setRows((prev) => [{ ...created, dirty: false }, ...prev]);
      setNewKey("");
      setNewValue("");
      toast.push({ title: "Додано", tone: "success" });
    } catch (e: any) {
      toast.push({ title: "Не вдалося додати", message: e?.message ?? String(e), tone: "error" });
    }
  };

  const remove = async (key: string) => {
    if (!confirm(`Видалити текст "${key}"?`)) return;
    try {
      await apiRequest<{ ok: boolean }>("DELETE", `/api/texts/${encodeURIComponent(key)}`);
      setRows((prev) => prev.filter((r) => r.key !== key));
      toast.push({ title: "Видалено", tone: "success" });
    } catch (e: any) {
      toast.push({ title: "Не вдалося видалити", message: e?.message ?? String(e), tone: "error" });
    }
  };

  const uploadPhoto = async (key: string, file: File) => {
    setPhotoBusyKey(key);
    try {
      const form = new FormData();
      form.append("file", file);
      const updated = await apiRequestForm<BotText>("POST", `/api/texts/${encodeURIComponent(key)}/photo`, form);
      setRows((prev) => prev.map((r) => (r.key === key ? { ...r, photo_path: updated.photo_path ?? null } : r)));
      toast.push({ title: "Фото збережено", tone: "success" });
    } catch (e: any) {
      toast.push({ title: "Не вдалося завантажити фото", message: e?.message ?? String(e), tone: "error" });
    } finally {
      setPhotoBusyKey(null);
    }
  };

  const clearPhoto = async (key: string) => {
    if (!confirm(`Видалити фото для "${key}"?`)) return;
    setPhotoBusyKey(key);
    try {
      const updated = await apiRequest<BotText>("DELETE", `/api/texts/${encodeURIComponent(key)}/photo`);
      setRows((prev) => prev.map((r) => (r.key === key ? { ...r, photo_path: updated.photo_path ?? null } : r)));
      toast.push({ title: "Фото видалено", tone: "success" });
    } catch (e: any) {
      toast.push({ title: "Не вдалося видалити фото", message: e?.message ?? String(e), tone: "error" });
    } finally {
      setPhotoBusyKey(null);
    }
  };

  const previewPhoto = async (key: string) => {
    setPhotoBusyKey(key);
    try {
      const blob = await apiRequestBlob(`/api/texts/${encodeURIComponent(key)}/photo`);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e: any) {
      toast.push({ title: "Не вдалося відкрити фото", message: e?.message ?? String(e), tone: "error" });
    } finally {
      setPhotoBusyKey(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="lg:hidden">
        <PageTitle
          title="Тексти"
          subtitle="Вітання, підказки та будь‑які повідомлення (ключ → значення)"
          right={
            <div className="flex items-center gap-2">
              {dirtyCount ? <Badge tone="amber">Не збережено: {dirtyCount}</Badge> : null}
              <Button variant="secondary" onClick={load} disabled={loading}>
                Оновити
              </Button>
              <Button onClick={saveAll} disabled={!dirtyCount}>
                <Save className="h-4 w-4" />
                Зберегти все
              </Button>
            </div>
          }
        />
      </div>

      <Card>
        <CardBody className="space-y-3">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <div>
              <div className="text-xs text-zinc-500">Ключ</div>
              <Input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="greeting" />
            </div>
            <div>
              <div className="text-xs text-zinc-500">Значення</div>
              <Input value={newValue} onChange={(e) => setNewValue(e.target.value)} placeholder="Вітаємо!" />
            </div>
          </div>
          <div className="flex items-center justify-end">
            <Button onClick={add}>
              <Plus className="h-4 w-4" />
              Додати
            </Button>
          </div>
        </CardBody>
      </Card>

      <div className="space-y-3">
        {rows.map((r) => (
          <Card key={r.key}>
            <CardBody className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="font-mono text-xs text-zinc-600">{r.key}</div>
                  {r.dirty ? <Badge tone="amber">змінено</Badge> : null}
                  {r.photo_path ? <Badge tone="gray">фото</Badge> : null}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id={photoInputId(r.key)}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.currentTarget.value = "";
                      if (f) void uploadPhoto(r.key, f);
                    }}
                  />
                  <Button
                    variant="secondary"
                    onClick={() => document.getElementById(photoInputId(r.key))?.click()}
                    disabled={photoBusyKey === r.key}
                  >
                    <ImageIcon className="h-4 w-4" />
                  </Button>
                  {r.photo_path ? (
                    <>
                      <Button
                        variant="secondary"
                        onClick={() => void previewPhoto(r.key)}
                        disabled={photoBusyKey === r.key}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => void clearPhoto(r.key)}
                        disabled={photoBusyKey === r.key}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  ) : null}
                  <Button variant="secondary" onClick={() => saveRow(r.key)} disabled={!r.dirty}>
                    <Save className="h-4 w-4" />
                    Зберегти
                  </Button>
                  <Button variant="ghost" onClick={() => remove(r.key)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <Divider />
              <Textarea
                value={r.value}
                onChange={(e) => updateRow(r.key, e.target.value)}
                rows={3}
                placeholder="Текст"
              />
            </CardBody>
          </Card>
        ))}
        {!rows.length && !loading ? (
          <div className="rounded-3xl bg-white/60 p-6 text-sm text-zinc-600 ring-1 ring-black/5">
            Поки немає текстів.
          </div>
        ) : null}
      </div>
    </div>
  );
}
