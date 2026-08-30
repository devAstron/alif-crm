import { prisma } from "@/lib/prisma";
import { UsersManager } from "@/components/settings/users-manager";

export const metadata = { title: "Foydalanuvchilar — Alif CRM" };

export default async function UsersSettingsPage() {
  const users = await prisma.user.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: { id: true, name: true, login: true, role: true, isActive: true },
  });
  return (
    <div>
      <p className="mb-4 text-sm text-slate-500">Operatorlar, targetolog va adminlarni boshqaring.</p>
      <UsersManager users={users} />
    </div>
  );
}
