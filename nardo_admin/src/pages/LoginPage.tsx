import { LockKeyhole, Sparkles, User, Loader2 } from "lucide-react";
import { useState } from "react";

import { apiRequest } from "../api/http";
import { Button, Card, CardBody, Input } from "../components/ui";
import { setAdminToken } from "../lib/storage";
import { useToast } from "../lib/toast";

type LoginOut = {
  token: string;
  admin: {
    id: number;
    username: string;
    display_name: string | null;
    avatar_emoji?: string | null;
  };
};

export function LoginPage(props: { onLoggedIn: () => void }) {
  const toast = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const u = username.trim();
    const p = password;
    if (!u || !p) {
      toast.push({ title: "Заповніть логін і пароль", tone: "info" });
      return;
    }
    setLoading(true);
    try {
      const res = await apiRequest<LoginOut>("POST", "/api/auth/login", {
        username: u,
        password: p,
      });
      setAdminToken(res.token);
      props.onLoggedIn();
    } catch (e: any) {
      toast.push({
        title: "Не вдалося увійти",
        message: e?.message ?? "Перевірте правильність даних",
        tone: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden bg-zinc-50/50">
      {/* Декоративные элементы фона */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-zinc-200/50 blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-zinc-200/50 blur-[120px]" />

      <div className="relative w-full max-w-[420px] transition-all duration-500 animate-in fade-in slide-in-from-bottom-4">
        {/* Хедер формы */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-zinc-900 text-white shadow-xl shadow-zinc-200 ring-4 ring-white">
            <Sparkles className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
            Вітаємо знову
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            Введіть ваші дані для доступу до панелі
          </p>
        </div>

        <Card className="border-zinc-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-sm">
          <CardBody className="p-6 space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none text-zinc-700 ml-1">
                Логін
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 transition-colors group-focus-within:text-zinc-900" />
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-10 h-11 bg-white border-zinc-200 focus:ring-2 focus:ring-zinc-900/5 transition-all"
                  placeholder="admin"
                  autoComplete="username"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium leading-none text-zinc-700 ml-1">
                Пароль
              </label>
              <div className="relative">
                <LockKeyhole className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 transition-colors" />
                <Input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 h-11 bg-white border-zinc-200 focus:ring-2 focus:ring-zinc-900/5 transition-all"
                  placeholder="••••••••"
                  type="password"
                  autoComplete="current-password"
                  disabled={loading}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void submit();
                  }}
                />
              </div>
            </div>

            <Button
              onClick={() => void submit()}
              disabled={loading}
              className="w-full h-11 bg-zinc-900 hover:bg-zinc-800 text-white font-medium transition-all active:scale-[0.98]"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Вхід...
                </div>
              ) : (
                "Увійти в систему"
              )}
            </Button>

            {/* <div className="flex items-center justify-center gap-2 pt-2">
              <div className="h-px flex-1 bg-zinc-100" />
              <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">
                server status
              </span>
              <div className="h-px flex-1 bg-zinc-100" />
            </div>

            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-400">Підключено до:</span>
              <code className="px-2 py-0.5 rounded bg-zinc-100 text-zinc-600 font-medium">
                {apiBase.replace(/^https?:\/\//, "")}
              </code>
            </div> */}
          </CardBody>
        </Card>

        {/* <p className="mt-8 text-center text-xs text-zinc-400">
          &copy; {new Date().getFullYear()} Ваша Компанія. Всі права захищені.
        </p> */}
      </div>
    </div>
  );
}
