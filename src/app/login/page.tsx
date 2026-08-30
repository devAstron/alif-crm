import { redirect } from "next/navigation";
import { getCurrentUser, defaultHomeFor } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata = {
  title: "Kirish — Alif CRM",
};

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(defaultHomeFor(user.role));

  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-2xl font-bold text-white shadow-lg shadow-brand-600/20">
            A
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">Alif CRM</h1>
          <p className="mt-1 text-sm text-slate-500">
            Tizimga kirish uchun ma&apos;lumotlaringizni kiriting
          </p>
        </div>

        <div className="card p-6 sm:p-8">
          <LoginForm />
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          Alif Academy Arab tili kursi · Savdo CRM
        </p>
      </div>
    </div>
  );
}
