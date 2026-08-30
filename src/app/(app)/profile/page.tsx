import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isTelegramConfigured } from "@/lib/telegram/client";
import { ROLE_LABEL } from "@/lib/navigation";
import { PageHeader } from "@/components/page-header";
import { TelegramLink } from "@/components/profile/telegram-link";

export const metadata = { title: "Profil — Alif CRM" };

export default async function ProfilePage() {
  const user = await requireUser();
  const account = await prisma.telegramAccount.findUnique({ where: { userId: user.id } });

  return (
    <>
      <PageHeader title="Profil" />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="card p-5">
          <h3 className="mb-4 text-sm font-semibold text-slate-900">Hisob ma&apos;lumotlari</h3>
          <dl className="space-y-3">
            <div>
              <dt className="text-xs text-slate-400">Ism</dt>
              <dd className="text-sm text-slate-800">{user.name}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">Login</dt>
              <dd className="text-sm text-slate-800">{user.login}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">Rol</dt>
              <dd className="text-sm text-slate-800">{ROLE_LABEL[user.role]}</dd>
            </div>
          </dl>
        </div>

        <TelegramLink
          configured={isTelegramConfigured()}
          linked={!!account}
          username={account?.username ?? null}
        />
      </div>
    </>
  );
}
