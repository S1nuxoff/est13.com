import type { ReactNode } from "react";
import {
  BarChart3,
  FileText,
  FormInput,
  FolderKanban,
  LayoutGrid,
  Megaphone,
  MessagesSquare,
  Settings,
  Users,
} from "lucide-react";

export type NavItem = { key: string; label: string; icon: ReactNode };

export const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", label: "Дашборд", icon: <BarChart3 className="h-4 w-4" /> },
  { key: "services", label: "Форми", icon: <LayoutGrid className="h-4 w-4" /> },
  { key: "texts", label: "Тексти", icon: <FileText className="h-4 w-4" /> },
  { key: "chats", label: "Чати", icon: <MessagesSquare className="h-4 w-4" /> },
  { key: "leads", label: "Ліди", icon: <FormInput className="h-4 w-4" /> },
  { key: "projects", label: "Проєкти", icon: <FolderKanban className="h-4 w-4" /> },
  { key: "broadcast", label: "Розсилка", icon: <Megaphone className="h-4 w-4" /> },
  { key: "accounts", label: "Акаунти", icon: <Users className="h-4 w-4" /> },
  { key: "settings", label: "Налаштування", icon: <Settings className="h-4 w-4" /> },
];
