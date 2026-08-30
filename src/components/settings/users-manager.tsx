"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, KeyRound, Loader2, X, Check } from "lucide-react";
import {
  createUserAction,
  updateUserAction,
  resetPasswordAction,
} from "@/lib/actions/user-actions";
import { ROLE_LABEL } from "@/lib/navigation";
import type { Role } from "@prisma/client";

export interface UserItem {
  id: string;
  name: string;
  login: string;
  role: Role;
  isActive: boolean;
}

const ROLES: Role[] = ["ADMIN", "OPERATOR", "TARGETOLOG"];

export function UsersManager({ users }: { users: UserItem[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [nName, setNName] = useState(""); const [nLogin, setNLogin] = useState(""); const [nPass, setNPass] = useState(""); const [nRole, setNRole] = useState<Role>("OPERATOR");
  const [editId, setEditId] = useState<string | null>(null);
  const [eName, setEName] = useState(""); const [eRole, setERole] = useState<Role>("OPERATOR"); const [eActive, setEActive] = useState(true);
  const [pwId, setPwId] = useState<string | null>(null); const [pw, setPw] = useState("");

  function add() {
    startTransition(async () => {
      const res = await createUserAction({ name: nName, login: nLogin, password: nPass, role: nRole });
      if (res.ok) { setAdding(false); setNName(""); setNLogin(""); setNPass(""); router.refresh(); } else setError(res.error ?? "Xato");
    });
  }
  function saveEdit() {
    startTransition(async () => {
      const res = await updateUserAction({ id: editId!, name: eName, role: eRole, isActive: eActive });
      if (res.ok) { setEditId(null); router.refresh(); } else setError(res.error ?? "Xato");
    });
  }
  function savePw() {
    startTransition(async () => {
      const res = await resetPasswordAction({ id: pwId!, password: pw });
      if (res.ok) { setPwId(null); setPw(""); router.refresh(); } else setError(res.error ?? "Xato");
    });
  }

  return (
    <div className="space-y-3">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</div>}

      {users.map((u) => (
        <div key={u.id} className={`card p-4 ${!u.isActive ? "opacity-60" : ""}`}>
          {editId === u.id ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div><label className="label">Ism</label><input className="input" value={eName} onChange={(e) => setEName(e.target.value)} /></div>
                <div><label className="label">Rol</label><select className="input" value={eRole} onChange={(e) => setERole(e.target.value as Role)}>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></div>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" className="h-4 w-4" checked={eActive} onChange={(e) => setEActive(e.target.checked)} /> Faol</label>
              <div className="flex gap-2">
                <button onClick={saveEdit} disabled={pending} className="btn-primary py-1.5">{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Saqlash</button>
                <button onClick={() => setEditId(null)} className="btn-secondary py-1.5"><X className="h-4 w-4" /></button>
              </div>
            </div>
          ) : pwId === u.id ? (
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex-1"><label className="label">Yangi parol</label><input type="text" className="input" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Kamida 6 belgi" /></div>
              <button onClick={savePw} disabled={pending || pw.length < 6} className="btn-primary py-2.5">{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} O&apos;rnatish</button>
              <button onClick={() => setPwId(null)} className="btn-secondary py-2.5"><X className="h-4 w-4" /></button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900">{u.name} {!u.isActive && <span className="text-xs text-slate-400">nofaol</span>}</p>
                <p className="text-xs text-slate-400">{u.login} · {ROLE_LABEL[u.role]}</p>
              </div>
              <button onClick={() => { setEditId(u.id); setEName(u.name); setERole(u.role); setEActive(u.isActive); }} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><Pencil className="h-4 w-4" /></button>
              <button onClick={() => { setPwId(u.id); setPw(""); }} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" title="Parolni tiklash"><KeyRound className="h-4 w-4" /></button>
            </div>
          )}
        </div>
      ))}

      {adding ? (
        <div className="card space-y-3 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div><label className="label">Ism</label><input className="input" value={nName} onChange={(e) => setNName(e.target.value)} /></div>
            <div><label className="label">Login</label><input className="input" value={nLogin} onChange={(e) => setNLogin(e.target.value)} autoComplete="off" /></div>
            <div><label className="label">Parol</label><input type="text" className="input" value={nPass} onChange={(e) => setNPass(e.target.value)} autoComplete="off" /></div>
            <div><label className="label">Rol</label><select className="input" value={nRole} onChange={(e) => setNRole(e.target.value as Role)}>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></div>
          </div>
          <div className="flex gap-2">
            <button onClick={add} disabled={pending || !nName || !nLogin || !nPass} className="btn-primary py-1.5">{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Qo&apos;shish</button>
            <button onClick={() => setAdding(false)} className="btn-secondary py-1.5"><X className="h-4 w-4" /></button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="btn-secondary w-full"><Plus className="h-4 w-4" /> Foydalanuvchi qo&apos;shish</button>
      )}
    </div>
  );
}
