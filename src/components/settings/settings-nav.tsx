"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/settings/pipeline", label: "Voronka bosqichlari" },
  { href: "/settings/fields", label: "Qo'shimcha maydonlar" },
  { href: "/settings/rejections", label: "Rad etish sabablari" },
  { href: "/settings/processing", label: "Qayta ishlash holatlari" },
  { href: "/settings/users", label: "Foydalanuvchilar" },
  { href: "/settings/deleted", label: "O'chirilgan leadlar" },
  { href: "/settings/audit", label: "Audit jurnali" },
];

export function SettingsNav() {
  const pathname = usePathname();
  return (
    <div className="scroll-thin mb-6 flex gap-1 overflow-x-auto border-b border-slate-200">
      {ITEMS.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-medium transition ${
              active
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
