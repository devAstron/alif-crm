"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Loader2, X, Check, Eye, EyeOff } from "lucide-react";
import {
  createCustomFieldAction,
  updateCustomFieldAction,
  toggleCustomFieldActiveAction,
} from "@/lib/actions/customfield-actions";
import type { CustomFieldType } from "@prisma/client";

export interface FieldItem {
  id: string;
  name: string;
  slug: string;
  type: CustomFieldType;
  options: string[];
  required: boolean;
  isActive: boolean;
}

const TYPE_LABEL: Record<string, string> = {
  TEXT: "Matn", NUMBER: "Raqam", SELECT: "Tanlov", MULTISELECT: "Ko'p tanlov", DATE: "Sana", CHECKBOX: "Belgi",
};
const TYPES: CustomFieldType[] = ["TEXT", "NUMBER", "SELECT", "MULTISELECT", "DATE", "CHECKBOX"];

interface FormState {
  id: string | null;
  name: string;
  type: CustomFieldType;
  optionsText: string;
  required: boolean;
}

const EMPTY: FormState = { id: null, name: "", type: "TEXT", optionsText: "", required: false };

export function CustomFieldsManager({ fields }: { fields: FieldItem[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const needsOptions = form?.type === "SELECT" || form?.type === "MULTISELECT";

  function openNew() { setForm({ ...EMPTY }); setError(null); }
  function openEdit(f: FieldItem) {
    setForm({ id: f.id, name: f.name, type: f.type, optionsText: f.options.join(", "), required: f.required });
    setError(null);
  }

  function save() {
    if (!form) return;
    const options = form.optionsText.split(",").map((s) => s.trim()).filter(Boolean);
    startTransition(async () => {
      const payload = { name: form.name, type: form.type, options, required: form.required };
      const res = form.id
        ? await updateCustomFieldAction({ id: form.id, ...payload })
        : await createCustomFieldAction(payload);
      if (res.ok) { setForm(null); router.refresh(); }
      else setError(res.error ?? "Xatolik");
    });
  }

  function toggle(id: string) {
    startTransition(async () => { await toggleCustomFieldActiveAction(id); router.refresh(); });
  }

  return (
    <div className="space-y-3">
      {fields.map((f) => (
        <div key={f.id} className={`card flex items-center gap-3 p-4 ${!f.isActive ? "opacity-60" : ""}`}>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-900">
              {f.name}
              {f.required && <span className="ml-2 text-xs text-red-500">majburiy</span>}
              {!f.isActive && <span className="ml-2 text-xs text-slate-400">nofaol</span>}
            </p>
            <p className="text-xs text-slate-400">
              {TYPE_LABEL[f.type]} · {f.slug}
              {f.options.length > 0 && ` · ${f.options.join(", ")}`}
            </p>
          </div>
          <button onClick={() => openEdit(f)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><Pencil className="h-4 w-4" /></button>
          <button onClick={() => toggle(f.id)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" title={f.isActive ? "Nofaol qilish" : "Faollashtirish"}>
            {f.isActive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      ))}
      {fields.length === 0 && <p className="text-sm text-slate-400">Maydonlar yo&apos;q</p>}

      {form ? (
        <div className="card space-y-3 p-4">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Nom</label>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="label">Turi</label>
              <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as CustomFieldType })}>
                {TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
              </select>
            </div>
          </div>
          {needsOptions && (
            <div>
              <label className="label">Variantlar (vergul bilan)</label>
              <input className="input" value={form.optionsText} onChange={(e) => setForm({ ...form, optionsText: e.target.value })} placeholder="Variant 1, Variant 2" />
            </div>
          )}
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={form.required} onChange={(e) => setForm({ ...form, required: e.target.checked })} />
            Majburiy maydon
          </label>
          <div className="flex gap-2">
            <button onClick={save} disabled={pending || !form.name} className="btn-primary py-1.5">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Saqlash
            </button>
            <button onClick={() => setForm(null)} className="btn-secondary py-1.5"><X className="h-4 w-4" /> Bekor</button>
          </div>
        </div>
      ) : (
        <button onClick={openNew} className="btn-secondary w-full"><Plus className="h-4 w-4" /> Maydon qo&apos;shish</button>
      )}
    </div>
  );
}
