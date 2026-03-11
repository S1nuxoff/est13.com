import { Save, Volume2, VolumeX } from "lucide-react";
import { useEffect, useState } from "react";

import { apiRequest } from "../api/http";
import { Button, Card, CardBody, Input, PageTitle, Spinner } from "../components/ui";
import {
  getAdminToken,
  getApiBase,
  getNotificationSoundEnabled,
  setAdminToken,
  setApiBase,
  setNotificationSoundEnabled,
} from "../lib/storage";
import { useToast } from "../lib/toast";

export function SettingsPage() {
  const toast = useToast();
  const [apiBase, setApiBaseState] = useState(getApiBase());
  const [token, setTokenState] = useState(getAdminToken());
  const [soundEnabled, setSoundEnabled] = useState(getNotificationSoundEnabled());

  const [supportAutoDisableMinutes, setSupportAutoDisableMinutes] = useState<string>("");
  const [savingServer, setSavingServer] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const onStorage = () => {
      setApiBaseState(getApiBase());
      setTokenState(getAdminToken());
      setSoundEnabled(getNotificationSoundEnabled());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    apiRequest<{ support_auto_disable_minutes: number }>("GET", "/api/settings")
      .then((res) => setSupportAutoDisableMinutes(String(res.support_auto_disable_minutes ?? "")))
      .catch(() => {});
  }, []);

  const save = async () => {
    setApiBase(apiBase.trim());
    setAdminToken(token.trim());
    setNotificationSoundEnabled(soundEnabled);

    const v = Number(supportAutoDisableMinutes);
    if (Number.isFinite(v) && v > 0) {
      setSavingServer(true);
      try {
        const res = await apiRequest<{ support_auto_disable_minutes: number }>("PATCH", "/api/settings", {
          support_auto_disable_minutes: Math.trunc(v),
        });
        setSupportAutoDisableMinutes(String(res.support_auto_disable_minutes ?? Math.trunc(v)));
      } catch (e: any) {
        toast.push({
          title: "Не вдалося зберегти на сервері",
          message: e?.message ?? String(e),
          tone: "error",
        });
      } finally {
        setSavingServer(false);
      }
    }

    toast.push({ title: "Збережено", tone: "success" });
  };

  const check = async () => {
    setChecking(true);
    try {
      await apiRequest<{ ok: boolean }>("GET", "/api/health");
      toast.push({ title: "API доступний", tone: "success" });
    } catch (e: any) {
      toast.push({ title: "Помилка API", message: e?.message ?? String(e), tone: "error" });
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="lg:hidden">
        <PageTitle
          title="Налаштування"
          subtitle="API та опції"
          right={
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={check} disabled={checking}>
                {checking ? <Spinner /> : null}
                Перевірити API
              </Button>
              <Button onClick={() => void save()} disabled={savingServer}>
                {savingServer ? <Spinner /> : <Save className="h-4 w-4" />}
                Зберегти
              </Button>
            </div>
          }
        />
      </div>

      <Card>
        <CardBody className="space-y-4">
          <div>
            <div className="text-sm font-medium">Адреса API</div>
            <div className="mt-1 text-sm text-zinc-500">
              Залиште порожнім, щоб використовувати Vite proxy на <code>/api</code>.
            </div>
            <div className="mt-2">
              <Input value={apiBase} onChange={(e) => setApiBaseState(e.target.value)} placeholder="http://localhost:8000" />
            </div>
          </div>

          <div>
            <div className="text-sm font-medium">Токен доступу</div>
            <div className="mt-1 text-sm text-zinc-500">
              Якщо на backend задано <code>ADMIN_API_TOKEN</code>, вкажіть його тут.
            </div>
            <div className="mt-2">
              <Input value={token} onChange={(e) => setTokenState(e.target.value)} placeholder="token" />
            </div>
          </div>

          <div className="hidden items-center justify-end gap-2 lg:flex">
            <Button variant="secondary" onClick={check} disabled={checking}>
              {checking ? <Spinner /> : null}
              Перевірити API
            </Button>
            <Button onClick={() => void save()} disabled={savingServer}>
              {savingServer ? <Spinner /> : <Save className="h-4 w-4" />}
              Зберегти
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold tracking-tight">Сповіщення</div>
              <div className="text-sm text-zinc-500">Звук при появі нових непрочитаних повідомлень у чатах.</div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                const next = !soundEnabled;
                setSoundEnabled(next);
                setNotificationSoundEnabled(next);
              }}
            >
              {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              {soundEnabled ? "Звук увімкнено" : "Звук вимкнено"}
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-3">
          <div>
            <div className="text-sm font-semibold tracking-tight">Підтримка</div>
            <div className="text-sm text-zinc-500">
              Автоматичне вимкнення підтримки, якщо оператор забув завершити чат.
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr,auto] sm:items-end">
            <div>
              <div className="text-sm font-medium">Таймаут неактивності (хв)</div>
              <div className="mt-2">
                <Input
                  inputMode="numeric"
                  value={supportAutoDisableMinutes}
                  onChange={(e) => setSupportAutoDisableMinutes(e.target.value)}
                  placeholder="180"
                />
              </div>
              <div className="mt-2 text-xs text-zinc-500">Діапазон: 1…10080 хв.</div>
            </div>
            <Button variant="secondary" onClick={() => void save()} disabled={savingServer} className="sm:mb-[2px]">
              {savingServer ? <Spinner /> : null}
              Зберегти
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

