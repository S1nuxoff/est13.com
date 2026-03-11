import { useEffect, useMemo, useRef, useState } from "react";

import { apiRequest } from "./api/http";
import type { AdminMe } from "./api/auth";
import { fetchMe } from "./api/auth";
import type { Service } from "./api/types";
import { NAV_ITEMS } from "./app/nav";
import { MobileDrawer } from "./layout/MobileDrawer";
import { MobileTopbar } from "./layout/MobileTopbar";
import { PageHeader } from "./layout/PageHeader";
import { Sidebar } from "./layout/Sidebar";
import { AccountsPage } from "./pages/AccountsPage";
import { BroadcastPage } from "./pages/BroadcastPage";
import { ChatsPage } from "./pages/ChatsPage";
import { DashboardPage } from "./pages/DashboardPage";
import { LeadsPage } from "./pages/LeadsPage";
import { LoginPage } from "./pages/LoginPage";
import { ProjectPage } from "./pages/ProjectPage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { ServicesPage } from "./pages/ServicesPage";
import { SettingsPage } from "./pages/SettingsPage";
import { TextsPage } from "./pages/TextsPage";
import { useHashRoute } from "./lib/router";
import {
  clearAdminToken,
  getAdminToken,
  getNotificationSoundEnabled,
} from "./lib/storage";
import { useToast } from "./lib/toast";
import { ConfirmProvider } from "./lib/confirm";

export default function App() {
  const toast = useToast();
  const { route, params, navigate } = useHashRoute();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [search, setSearch] = useState("");
  const [me, setMe] = useState<AdminMe | null>(null);

  const [unreadChats, setUnreadChats] = useState(0);
  const [unacceptedLeads, setUnacceptedLeads] = useState(0);

  const prevUnreadRef = useRef<number | null>(null);
  const prevUnacceptedRef = useRef<number | null>(null);
  const lastSoundAtRef = useRef<number>(0);

  const navItems = useMemo(() => NAV_ITEMS, []);
  const token = getAdminToken();
  const notificationSoundUrl = useMemo(
    () => new URL("./assets/notification.mp3", import.meta.url).toString(),
    [],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) {
        setMe(null);
        return;
      }
      try {
        const m = await fetchMe();
        if (!cancelled) setMe(m);
      } catch {
        if (!cancelled) {
          clearAdminToken();
          setMe(null);
          window.location.hash = "login";
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) return;
      try {
        const list = await apiRequest<Service[]>("GET", "/api/services");
        if (!cancelled)
          setServices(list.sort((a, b) => a.sort - b.sort || a.id - b.id));
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    let t: number | null = null;

    const tick = async () => {
      if (!token) return;
      try {
        const res = await apiRequest<{
          unread_total: number;
          unaccepted_leads?: number;
        }>("GET", "/api/notifications");
        if (!cancelled) {
          setUnreadChats(Number(res.unread_total ?? 0));
          setUnacceptedLeads(Number(res.unaccepted_leads ?? 0));
        }
      } catch {
        if (!cancelled) {
          setUnreadChats(0);
          setUnacceptedLeads(0);
        }
      }
    };

    void tick();
    t = window.setInterval(() => void tick(), 5000);
    return () => {
      cancelled = true;
      if (t) window.clearInterval(t);
    };
  }, [token]);

  useEffect(() => {
    const prev = prevUnreadRef.current;
    prevUnreadRef.current = unreadChats;

    if (prev === null) return;
    if (unreadChats <= prev) return;

    if (getNotificationSoundEnabled()) {
      const now = Date.now();
      if (now - lastSoundAtRef.current > 1200) {
        lastSoundAtRef.current = now;
        try {
          const a = new Audio(notificationSoundUrl);
          a.volume = 0.9;
          void a.play();
        } catch {}
      }
    }

    if (route !== "chats") {
      toast.push({
        title: "Нове повідомлення",
        message: "Є непрочитані повідомлення в чатах.",
        tone: "info",
      });
    }
  }, [notificationSoundUrl, route, toast, unreadChats]);

  useEffect(() => {
    const prev = prevUnacceptedRef.current;
    prevUnacceptedRef.current = unacceptedLeads;

    if (prev === null) return;
    if (unacceptedLeads <= prev) return;

    if (getNotificationSoundEnabled()) {
      const now = Date.now();
      if (now - lastSoundAtRef.current > 1200) {
        lastSoundAtRef.current = now;
        try {
          const a = new Audio(notificationSoundUrl);
          a.volume = 0.9;
          void a.play();
        } catch {}
      }
    }

    if (route !== "leads") {
      toast.push({
        title: "Новий лід",
        message: "Є ліди, які потрібно прийняти на перевірку.",
        tone: "info",
      });
    }
  }, [notificationSoundUrl, route, toast, unacceptedLeads]);

  useEffect(() => {
    const base = "Est13 Admin";
    const total = unreadChats + unacceptedLeads;
    document.title = total > 0 ? `(${total}) ${base}` : base;
  }, [unacceptedLeads, unreadChats]);

  const currentTitle =
    navItems.find((x) => x.key === route)?.label ?? "Дашборд";

  const serviceIdParam = Number(params.get("serviceId") ?? "");
  const selectedServiceId =
    Number.isFinite(serviceIdParam) && serviceIdParam > 0
      ? serviceIdParam
      : null;

  const goToService = (id: number) => {
    navigate("services", { params: { serviceId: id } });
  };

  const logout = async () => {
    try {
      await apiRequest("POST", "/api/auth/logout");
    } catch {}
    clearAdminToken();
    window.location.hash = "login";
  };

  if (!token && route !== "login") {
    window.location.hash = "login";
    return null;
  }

  if (!token && route === "login") {
    return (
      <ConfirmProvider>
        <LoginPage onLoggedIn={() => (window.location.hash = "dashboard")} />
      </ConfirmProvider>
    );
  }

  const renderContent = () => {
    switch (route) {
      case "services":
        return (
          <ServicesPage
            initialServiceId={selectedServiceId}
            onServiceSelected={(id) =>
              navigate("services", { params: { serviceId: id } })
            }
          />
        );
      case "chats":
        return <ChatsPage />;
      case "dashboard":
        return <DashboardPage />;
      case "texts":
        return <TextsPage />;
      case "leads":
        return <LeadsPage currentAdmin={me} />;
      case "projects":
        return <ProjectsPage currentAdmin={me} />;
      case "project":
        return <ProjectPage />;
      case "accounts":
        return <AccountsPage currentAdmin={me} />;
      case "broadcast":
        return <BroadcastPage />;
      case "settings":
        return <SettingsPage />;
      default:
        return <DashboardPage />;
    }
  };

  return (
    <ConfirmProvider>
    <div className="min-h-screen w-full bg-[#121212] overflow-hidden selection:bg-indigo-500/30">
      <div className="flex h-screen w-full">
        <aside className="hidden h-full w-[280px] shrink-0 lg:block">
          <Sidebar
            navItems={navItems}
            services={services}
            route={route}
            selectedServiceId={selectedServiceId}
            unreadChats={unreadChats}
            unacceptedLeads={unacceptedLeads}
            navigate={navigate}
            goToService={goToService}
            onLogout={() => void logout()}
            currentAdmin={me}
          />
        </aside>

        <main className="relative flex flex-1 flex-col min-w-0 lg:py-3 lg:pr-3">
          <div className="flex h-full w-full flex-col overflow-hidden bg-white shadow-2xl lg:rounded-[32px]">
            <MobileTopbar
              title={currentTitle}
              onOpenMenu={() => setMobileMenuOpen(true)}
              unreadChats={unreadChats}
              onOpenChats={() => {
                setMobileMenuOpen(false);
                navigate("chats");
              }}
            />

            <MobileDrawer
              open={mobileMenuOpen}
              onClose={() => setMobileMenuOpen(false)}
            >
              <Sidebar
                mobile
                navItems={navItems}
                services={services}
                route={route}
                selectedServiceId={selectedServiceId}
                unreadChats={unreadChats}
                unacceptedLeads={unacceptedLeads}
                navigate={navigate}
                goToService={goToService}
                onCloseMobile={() => setMobileMenuOpen(false)}
                onLogout={() => void logout()}
                currentAdmin={me}
              />
            </MobileDrawer>

            <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-10 scroll-smooth">
              <PageHeader
                title={currentTitle}
                search={search}
                onSearchChange={setSearch}
                unreadChats={unreadChats}
                onOpenChats={() => navigate("chats")}
              />

              <div className="mt-6">{renderContent()}</div>
            </div>
          </div>
        </main>
      </div>
    </div>
    </ConfirmProvider>
  );
}
