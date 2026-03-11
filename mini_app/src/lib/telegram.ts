export type TgWebApp = {
  initData?: string
  initDataUnsafe?: {
    user?: {
      id: number
      first_name?: string
      last_name?: string
      username?: string
      language_code?: string
    }
  }
  ready?: () => void
  expand?: () => void
  setHeaderColor?: (color: string) => void
  setBackgroundColor?: (color: string) => void
  disableVerticalSwipes?: () => void
  HapticFeedback?: {
    impactOccurred?: (style: "light" | "medium" | "heavy" | "rigid" | "soft") => void
    notificationOccurred?: (type: "error" | "success" | "warning") => void
    selectionChanged?: () => void
  }
  colorScheme?: "light" | "dark"
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TgWebApp
    }
  }
}

export function getTg(): TgWebApp | null {
  return window.Telegram?.WebApp ?? null
}

export function tgInit() {
  const tg = getTg()
  if (!tg) return
  try {
    tg.ready?.()
    tg.expand?.()
    tg.disableVerticalSwipes?.()
    tg.setBackgroundColor?.("#f8fafc")
    tg.setHeaderColor?.("#f8fafc")
  } catch {
    // ignore
  }
}

export function tgUserName(): string | null {
  const tg = getTg()
  const u = tg?.initDataUnsafe?.user
  if (!u) return null
  return u.first_name || u.username || null
}
