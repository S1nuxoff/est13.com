import {
  ChevronRight,
  MoreVertical,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserCog,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { AdminMe } from "../api/auth";
import { apiRequest } from "../api/http";
import { Badge, Button, Card, CardBody, Input, Select } from "../components/ui";
import { useConfirm } from "../lib/confirm";
import { useToast } from "../lib/toast";

type AdminAccount = {
  id: number;
  username: string;
  display_name: string | null;
  avatar_emoji: string | null;
  is_active: boolean;
  is_super: boolean;
  created_at: string;
  last_login_at: string | null;
};

const EMOJI_OPTIONS = [
  "🧑‍💻",
  "🧑‍💼",
  "🛡️",
  "⚡",
  "🧠",
  "🎯",
  "🧩",
  "📣",
  "💬",
  "🧾",
  "📊",
  "🧪",
  "🪄",
];

function defaultEmoji() {
  return EMOJI_OPTIONS[Math.floor(Math.random() * EMOJI_OPTIONS.length)];
}

export function AccountsPage(props: { currentAdmin?: AdminMe | null }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [items, setItems] = useState<AdminAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const [newOpen, setNewOpen] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newEmoji, setNewEmoji] = useState<string>(defaultEmoji());
  const [newPassword, setNewPassword] = useState("");
  const [newIsSuper, setNewIsSuper] = useState(false);

  const canManageSupers = Boolean(props.currentAdmin?.is_super);

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiRequest<AdminAccount[]>("GET", "/api/admins");
      setItems(res);
    } catch (e: any) {
      toast.push({
        title: "Помилка завантаження",
        message: e?.message ?? "Не вдалося отримати дані",
        tone: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetNewForm = () => {
    setNewUsername("");
    setNewDisplayName("");
    setNewPassword("");
    setNewEmoji(defaultEmoji());
    setNewIsSuper(false);
    setNewOpen(false);
  };

  const create = async () => {
    if (!newUsername.trim() || !newPassword) {
      toast.push({ title: "Введіть логін та пароль", tone: "info" });
      return;
    }
    try {
      const created = await apiRequest<AdminAccount>("POST", "/api/admins", {
        username: newUsername.trim().toLowerCase(),
        display_name: newDisplayName.trim() || null,
        avatar_emoji: newEmoji,
        password: newPassword,
        is_super: canManageSupers ? newIsSuper : undefined,
      });
      setItems((prev) => [created, ...prev]);
      resetNewForm();
      toast.push({ title: "Акаунт успішно створено", tone: "success" });
    } catch (e: any) {
      toast.push({
        title: "Помилка створення",
        message: e?.message ?? "Не вдалося створити",
        tone: "error",
      });
    }
  };

  const update = async (id: number, patch: any) => {
    const updated = await apiRequest<AdminAccount>("PATCH", `/api/admins/${id}`, patch);
    setItems((prev) => prev.map((x) => (x.id === id ? updated : x)));
    return updated;
  };

  const remove = async (admin: AdminAccount) => {
    if (!canManageSupers) return;
    const label = admin.display_name || admin.username;
    const ok = await confirm({
      title: "Видалити акаунт?",
      message: `Адміністратор "${label}" буде видалений. Дію не можна скасувати.`,
      confirmText: "Видалити",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await apiRequest("DELETE", `/api/admins/${admin.id}`);
      setItems((prev) => prev.filter((x) => x.id !== admin.id));
      toast.push({ title: "Акаунт видалено", tone: "success" });
    } catch (e: any) {
      toast.push({
        title: "Помилка видалення",
        message: e?.message ?? "Не вдалося видалити",
        tone: "error",
      });
    }
  };

  const filteredAndSorted = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return items
      .filter((item) => {
        if (!q) return true;
        return (
          item.username.toLowerCase().includes(q) ||
          (item.display_name ?? "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.id - a.id);
  }, [items, searchQuery]);

  const activeCount = useMemo(() => items.filter((i) => i.is_active).length, [items]);

  return (
    <div className="mx-auto min-h-[calc(100vh-120px)] max-w-7xl space-y-8 px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
            <UserCog className="h-6 w-6 text-indigo-600" />
            Керування акаунтами
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Налаштування прав доступу та профілів адміністраторів
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            className="bg-white shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw className={["h-4 w-4", loading ? "animate-spin" : ""].join(" ")} />
            Оновити
          </Button>
          <Button
            onClick={() => setNewOpen(!newOpen)}
            className="bg-indigo-600 text-white shadow-md shadow-indigo-100 hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            Новий користувач
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Усього адміністраторів
          </div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{items.length}</div>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Активні акаунти
          </div>
          <div className="mt-1 text-2xl font-bold text-green-600">{activeCount}</div>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Вимкнені акаунти
          </div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{items.length - activeCount}</div>
        </div>
      </div>

      {/* Create */}
      {newOpen ? (
        <Card className="overflow-hidden border-none shadow-xl ring-1 ring-slate-200">
          <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4">
            <h3 className="font-semibold text-slate-800">Реєстрація нового адміністратора</h3>
          </div>
          <CardBody className="grid grid-cols-1 gap-6 p-6 md:grid-cols-4">
            <div className="space-y-2">
              <label className="ml-1 text-xs font-semibold text-slate-600">Логін (ID)</label>
              <Input
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="напр. admin_kyiv"
              />
            </div>
            <div className="space-y-2">
              <label className="ml-1 text-xs font-semibold text-slate-600">Публічне імʼя</label>
              <Input
                value={newDisplayName}
                onChange={(e) => setNewDisplayName(e.target.value)}
                placeholder="Олександр"
              />
            </div>
            <div className="space-y-2">
              <label className="ml-1 text-xs font-semibold text-slate-600">Іконка</label>
              <Select value={newEmoji} onChange={(e) => setNewEmoji(e.target.value)}>
                {EMOJI_OPTIONS.map((e) => (
                  <option key={e} value={e}>
                    {e} Обрати символ
                  </option>
                ))}
              </Select>
            </div>
            {canManageSupers ? (
              <div className="space-y-2">
                <label className="ml-1 text-xs font-semibold text-slate-600">Роль</label>
                <label className="flex h-11 items-center gap-3 rounded-2xl bg-white px-3.5 text-sm ring-1 ring-black/10">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                    checked={newIsSuper}
                    onChange={(e) => setNewIsSuper(e.target.checked)}
                  />
                  <span className="text-slate-700">Супер админ</span>
                </label>
              </div>
            ) : null}
            <div className="space-y-2">
              <label className="ml-1 text-xs font-semibold text-slate-600">Пароль</label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2 md:col-span-4">
              <Button variant="secondary" onClick={() => setNewOpen(false)}>
                Скасувати
              </Button>
              <Button className="bg-slate-900 text-white hover:bg-black" onClick={() => void create()}>
                Зберегти користувача
              </Button>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {/* Table */}
      <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
        <div className="flex items-center border-b border-slate-50 bg-white p-4">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="w-full rounded-xl bg-slate-50 px-4 py-2 pl-10 text-sm outline-none transition-all focus:ring-2 focus:ring-indigo-500/20"
              placeholder="Пошук за іменем або логіном…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="animate-pulse p-20 text-center text-slate-400">Завантаження…</div>
          ) : (
            <div className="divide-y divide-slate-50">
              <div className="grid grid-cols-12 gap-4 bg-slate-50/50 px-6 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <div className="col-span-6 md:col-span-5">Користувач</div>
                <div className="col-span-4 md:col-span-3">Статус доступу</div>
                <div className="col-span-2 md:col-span-4 text-right">Дія</div>
              </div>

              {filteredAndSorted.map((admin) => (
                <AdminListItem
                  key={admin.id}
                  admin={admin}
                  canManageSupers={canManageSupers}
                  canDelete={
                    canManageSupers &&
                    (!props.currentAdmin?.id || props.currentAdmin.id !== admin.id)
                  }
                  onDelete={() => void remove(admin)}
                  onSave={async (patch) => {
                    try {
                      await update(admin.id, patch);
                      toast.push({ title: "Оновлено", tone: "success" });
                    } catch (e: any) {
                      toast.push({ title: "Помилка збереження", message: e?.message ?? "Не вдалося", tone: "error" });
                      throw e;
                    }
                  }}
                />
              ))}

              {!filteredAndSorted.length ? (
                <div className="p-20 text-center">
                  <div className="mb-2 font-medium text-slate-300">Нічого не знайдено</div>
                  <p className="text-sm text-slate-400">Спробуйте змінити параметри пошуку</p>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PasswordModal(props: {
  open: boolean;
  onClose: () => void;
  onSave: (oldPass: string, newPass: string) => Promise<void>;
}) {
  const [oldPass, setOldPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!props.open) return;
    setOldPass("");
    setNewPass("");
    setLoading(false);
  }, [props.open]);

  if (!props.open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/35" onClick={props.onClose} />
      <div className="absolute left-1/2 top-1/2 w-[92%] max-w-[520px] -translate-x-1/2 -translate-y-1/2">
        <div className="overflow-hidden rounded-3xl bg-white shadow-xl ring-1 ring-black/10">
          <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
            <div className="text-sm font-semibold tracking-tight text-slate-900">Зміна пароля</div>
            <div className="mt-0.5 text-xs text-slate-500">Для безпеки потрібно ввести старий пароль.</div>
          </div>
          <div className="space-y-4 p-6">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
              <div className="md:col-span-5">
                <div className="text-xs font-semibold text-slate-600">Старий пароль</div>
                <Input value={oldPass} onChange={(e) => setOldPass(e.target.value)} type="password" placeholder="••••••" />
              </div>
              <div className="hidden items-end justify-center md:col-span-2 md:flex">
                <ChevronRight className="h-5 w-5 text-slate-300" />
              </div>
              <div className="md:col-span-5">
                <div className="text-xs font-semibold text-slate-600">Новий пароль</div>
                <Input value={newPass} onChange={(e) => setNewPass(e.target.value)} type="password" placeholder="••••••" />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-1">
              <Button variant="secondary" onClick={props.onClose} disabled={loading}>
                Скасувати
              </Button>
              <Button
                className="bg-slate-900 text-white hover:bg-black"
                disabled={loading || !oldPass.trim() || !newPass.trim()}
                onClick={() => {
                  void (async () => {
                    setLoading(true);
                    try {
                      await props.onSave(oldPass, newPass);
                      props.onClose();
                    } finally {
                      setLoading(false);
                    }
                  })();
                }}
              >
                Зберегти
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminListItem(props: {
  admin: AdminAccount;
  onSave: (patch: any) => Promise<void>;
  canManageSupers: boolean;
  canDelete: boolean;
  onDelete: () => void;
}) {
  const admin = props.admin;
  const [displayName, setDisplayName] = useState(admin.display_name ?? "");
  const [emoji, setEmoji] = useState(admin.avatar_emoji ?? "🧑‍💻");
  const [isActive, setIsActive] = useState(admin.is_active);
  const [isSuper, setIsSuper] = useState(admin.is_super);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pwdOpen, setPwdOpen] = useState(false);

  useEffect(() => setDisplayName(admin.display_name ?? ""), [admin.display_name]);
  useEffect(() => setEmoji(admin.avatar_emoji ?? "🧑‍💻"), [admin.avatar_emoji]);
  useEffect(() => setIsActive(admin.is_active), [admin.is_active]);
  useEffect(() => setIsSuper(admin.is_super), [admin.is_super]);

  const hasChanges =
    displayName !== (admin.display_name ?? "") ||
    emoji !== (admin.avatar_emoji ?? "🧑‍💻") ||
    isActive !== admin.is_active ||
    (props.canManageSupers && isSuper !== admin.is_super);

  return (
    <div className="group grid grid-cols-12 items-center gap-4 px-6 py-5 transition-colors hover:bg-slate-50/50">
      {/* User */}
      <div className="col-span-6 flex items-center gap-4 md:col-span-5">
        <div className="relative">
          <div className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-2xl border border-slate-200 bg-white text-2xl shadow-sm transition-transform group-hover:scale-110">
            {emoji}
          </div>
          <select
            className="absolute inset-0 cursor-pointer opacity-0"
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
          >
            {EMOJI_OPTIONS.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate font-bold text-slate-900">{admin.username}</span>
            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
              ID:{admin.id}
            </span>
            {props.canManageSupers && isSuper ? (
              <Badge tone="amber" className="text-[10px] uppercase tracking-wide">
                Супер
              </Badge>
            ) : null}
          </div>
          <input
            className="w-full border-none bg-transparent p-0 text-sm text-slate-500 outline-none transition-colors hover:text-indigo-600"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Встановити імʼя…"
          />
        </div>
      </div>

      {/* Status */}
      <div className="col-span-4 md:col-span-3">
        <button
          type="button"
          onClick={() => setIsActive(!isActive)}
          className={[
            "inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold transition-all",
            isActive
              ? "bg-green-50 text-green-700 ring-1 ring-green-600/20"
              : "bg-slate-100 text-slate-500 ring-1 ring-slate-200",
          ].join(" ")}
        >
          {isActive ? (
            <>
              <ShieldCheck className="mr-1.5 h-3.5 w-3.5" /> Активний
            </>
          ) : (
            <>
              <ShieldAlert className="mr-1.5 h-3.5 w-3.5" /> Вимкнено
            </>
          )}
        </button>
        {props.canManageSupers ? (
          <button
            type="button"
            onClick={() => setIsSuper(!isSuper)}
            className={[
              "mt-2 inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold transition-all",
              isSuper
                ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                : "bg-slate-100 text-slate-500 ring-1 ring-slate-200",
            ].join(" ")}
          >
            {isSuper ? "Супер" : "Админ"}
          </button>
        ) : null}
      </div>

      {/* Actions */}
      <div className="col-span-2 flex items-center justify-end gap-2 md:col-span-4">
        <button
          disabled={!hasChanges}
          onClick={() =>
            void props.onSave({
              display_name: displayName.trim() || null,
              avatar_emoji: emoji,
              is_active: isActive,
              is_super: props.canManageSupers ? isSuper : undefined,
            })
          }
          className={[
            "rounded-xl p-2.5 transition-all",
            hasChanges
              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200"
              : "cursor-not-allowed bg-slate-50 text-slate-300",
          ].join(" ")}
          aria-label="Зберегти"
        >
          <Save className="h-4 w-4" />
        </button>

        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="rounded-xl p-2.5 text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50"
            aria-label="Дії"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
          {menuOpen ? (
            <div className="absolute right-0 top-11 z-20 w-[220px] overflow-hidden rounded-2xl bg-white shadow-lg ring-1 ring-black/10">
              <button
                className="w-full px-4 py-3 text-left text-sm text-slate-800 hover:bg-slate-50"
                onClick={() => {
                  setMenuOpen(false);
                  setPwdOpen(true);
                }}
              >
                Змінити пароль
              </button>
              {props.canDelete ? (
                <button
                  className="w-full px-4 py-3 text-left text-sm text-red-600 hover:bg-red-50"
                  onClick={() => {
                    setMenuOpen(false);
                    props.onDelete();
                  }}
                >
                  Видалити акаунт
                </button>
              ) : null}
              <button
                className="w-full px-4 py-3 text-left text-sm text-slate-800 hover:bg-slate-50"
                onClick={() => setMenuOpen(false)}
              >
                Закрити
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <PasswordModal
        open={pwdOpen}
        onClose={() => setPwdOpen(false)}
        onSave={async (oldPass, newPass) => {
          await props.onSave({
            old_password: oldPass || undefined,
            new_password: newPass || undefined,
          });
        }}
      />
    </div>
  );
}
