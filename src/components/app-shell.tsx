"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  KanbanSquare,
  ListChecks,
  BarChart3,
  Target,
  Settings,
  Menu,
  X,
  LogOut,
  Bell,
  type LucideIcon,
} from "lucide-react";
import type { NavItem } from "@/lib/navigation";
import { ROLE_LABEL } from "@/lib/navigation";
import type { Role } from "@prisma/client";
import { logoutAction } from "@/lib/actions/auth-actions";

const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard,
  KanbanSquare,
  ListChecks,
  BarChart3,
  Target,
  Settings,
};

function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-5 py-5">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-lg font-bold text-white">
        A
      </div>
      <div className="leading-tight">
        <div className="text-sm font-semibold text-slate-900">Alif CRM</div>
        <div className="text-xs text-slate-400">Arab tili kursi</div>
      </div>
    </div>
  );
}

function NavLinks({
  nav,
  pathname,
  onNavigate,
}: {
  nav: NavItem[];
  pathname: string;
  onNavigate?: () => void;
}) {
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <nav className="flex flex-col gap-1 px-3">
      {nav.map((item) => {
        const Icon = ICONS[item.icon] ?? LayoutDashboard;
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              active
                ? "bg-brand-50 text-brand-700"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <Icon className="h-5 w-5 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function UserBox({ user }: { user: { name: string; role: Role } }) {
  return (
    <div className="border-t border-slate-100 p-3">
      <div className="flex items-center gap-3 rounded-lg px-2 py-2">
        <Link href="/profile" className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-600">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-medium text-slate-900">{user.name}</div>
            <div className="text-xs text-slate-400">{ROLE_LABEL[user.role]}</div>
          </div>
        </Link>
        <form action={logoutAction}>
          <button
            type="submit"
            title="Chiqish"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-red-600"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </form>
      </div>
    </div>
  );
}

function NotifBell({ count }: { count: number }) {
  return (
    <Link
      href="/notifications"
      className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
      title="Bildirishnomalar"
    >
      <Bell className="h-5 w-5" />
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}

interface Props {
  user: { name: string; role: Role };
  nav: NavItem[];
  unreadCount: number;
  children: React.ReactNode;
}

export function AppShell({ user, nav, unreadCount, children }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="min-h-dvh bg-canvas">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex items-center justify-between pr-3">
          <Brand />
          <NotifBell count={unreadCount} />
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          <NavLinks nav={nav} pathname={pathname} />
        </div>
        <UserBox user={user} />
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[80%] flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between">
              <Brand />
              <button
                onClick={() => setOpen(false)}
                className="mr-3 rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-2">
              <NavLinks nav={nav} pathname={pathname} onNavigate={() => setOpen(false)} />
            </div>
            <UserBox user={user} />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="lg:pl-64">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur lg:hidden">
          <button
            onClick={() => setOpen(true)}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-600 text-sm font-bold text-white">
              A
            </div>
            <span className="text-sm font-semibold text-slate-900">Alif CRM</span>
          </div>
          <div className="ml-auto">
            <NotifBell count={unreadCount} />
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
