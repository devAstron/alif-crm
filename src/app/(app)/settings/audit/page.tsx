import { prisma } from "@/lib/prisma";
import { formatTashkent } from "@/lib/datetime";

export const metadata = { title: "Audit jurnali — Alif CRM" };

const ACTION_LABEL: Record<string, string> = {
  "auth.login": "Tizimga kirdi",
  "auth.logout": "Tizimdan chiqdi",
  "lead.create": "Lead yaratdi",
  "lead.update": "Leadni yangiladi",
  "lead.field_update": "Maydonni o'zgartirdi",
  "lead.stage_change": "Bosqichni o'zgartirdi",
  "lead.assign": "Leadni biriktirdi",
  "lead.reassign": "Operatorni almashtirdi",
  "lead.delete": "Leadni o'chirdi",
  "lead.restore": "Leadni tikladi",
  "payment.create": "To'lov qo'shdi",
  "payment.update": "To'lovni yangiladi",
  "task.create": "Vazifa yaratdi",
  "task.update": "Vazifani yangiladi",
  "comment.create": "Izoh qoldirdi",
  "settings.update": "Sozlamani yangiladi",
  "capi.config_update": "CAPI sozlamasini yangiladi",
  "custom_field.update": "Maydon sozlamasi",
  "pipeline.update": "Voronkani yangiladi",
  "user.update": "Foydalanuvchi boshqaruvi",
  "telegram.link": "Telegram bog'lash",
};

export default async function AuditPage() {
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { user: { select: { name: true } } },
  });

  return (
    <div>
      <p className="mb-4 text-sm text-slate-500">So&apos;nggi 100 ta muhim harakat. Parol va tokenlar bu yerga tushmaydi.</p>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
                <th className="px-4 py-2.5 font-medium">Vaqt</th>
                <th className="px-3 py-2.5 font-medium">Foydalanuvchi</th>
                <th className="px-3 py-2.5 font-medium">Harakat</th>
                <th className="px-3 py-2.5 font-medium">Obyekt</th>
                <th className="px-4 py-2.5 font-medium">IP</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-b border-slate-50 last:border-0">
                  <td className="whitespace-nowrap px-4 py-2.5 text-xs text-slate-400">{formatTashkent(l.createdAt)}</td>
                  <td className="px-3 py-2.5 text-slate-700">{l.user?.name ?? "Tizim"}</td>
                  <td className="px-3 py-2.5 text-slate-700">{ACTION_LABEL[l.action] ?? l.action}</td>
                  <td className="px-3 py-2.5 text-slate-500">{l.entity}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-400">{l.ip ?? "—"}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Jurnal bo&apos;sh</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
