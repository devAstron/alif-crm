"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X, Loader2 } from "lucide-react";
import { updateLeadFieldsAction } from "@/lib/actions/lead-actions";
import type { CustomFieldType } from "@prisma/client";

export interface EditableLead {
  id: string;
  name: string;
  phone: string;
  secondPhone: string | null;
  arabicLevel: string | null;
  activity: string | null;
  tariff: string | null;
  age: number | null;
  gender: string | null;
  city: string | null;
  profession: string | null;
  interestLevel: string | null;
  goal: string | null;
  inquirySource: string;
  dealAmount: number | null;
  note: string | null;
  field1: string | null;
  field2: string | null;
  field3: string | null;
}

export interface EditCustomField {
  slug: string;
  name: string;
  type: CustomFieldType;
  options: string[];
}

const INQUIRY_OPTS = [
  { v: "TARGET", l: "Target" },
  { v: "INSTAGRAM_DIRECT", l: "Instagram Direct" },
  { v: "INSTAGRAM_COMMENT", l: "Instagram komment" },
  { v: "REFERRAL", l: "Tanishidan eshitib" },
  { v: "OTHER", l: "Boshqa" },
];

export function LeadEditModal({
  lead,
  customFields,
  customValues,
}: {
  lead: EditableLead;
  customFields: EditCustomField[];
  customValues: Record<string, unknown>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [f, setF] = useState({
    name: lead.name,
    phone: lead.phone,
    secondPhone: lead.secondPhone ?? "",
    arabicLevel: lead.arabicLevel ?? "",
    activity: lead.activity ?? "",
    tariff: lead.tariff ?? "",
    age: lead.age != null ? String(lead.age) : "",
    gender: lead.gender ?? "",
    city: lead.city ?? "",
    profession: lead.profession ?? "",
    interestLevel: lead.interestLevel ?? "",
    goal: lead.goal ?? "",
    inquirySource: lead.inquirySource,
    dealAmount: lead.dealAmount != null ? String(lead.dealAmount) : "",
    note: lead.note ?? "",
    field1: lead.field1 ?? "",
    field2: lead.field2 ?? "",
    field3: lead.field3 ?? "",
  });
  const [cv, setCv] = useState<Record<string, unknown>>(() => ({ ...customValues }));

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF((prev) => ({ ...prev, [k]: e.target.value }));

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await updateLeadFieldsAction({
        leadId: lead.id,
        name: f.name,
        phone: f.phone,
        secondPhone: f.secondPhone || null,
        arabicLevel: f.arabicLevel || null,
        activity: f.activity || null,
        tariff: f.tariff || null,
        age: f.age ? Number(f.age) : null,
        gender: (f.gender || null) as "MALE" | "FEMALE" | null,
        city: f.city || null,
        profession: f.profession || null,
        interestLevel: f.interestLevel || null,
        goal: f.goal || null,
        inquirySource: f.inquirySource as "TARGET" | "INSTAGRAM_DIRECT" | "INSTAGRAM_COMMENT" | "REFERRAL" | "OTHER",
        dealAmount: f.dealAmount ? Number(f.dealAmount) : null,
        note: f.note || null,
        field1: f.field1 || null,
        field2: f.field2 || null,
        field3: f.field3 || null,
        customUpdates: cv,
      });
      if (res.ok) { setOpen(false); router.refresh(); }
      else setError(res.error ?? "Xatolik");
    });
  }

  function renderCustom(field: EditCustomField) {
    const val = cv[field.slug];
    const setVal = (v: unknown) => setCv((prev) => ({ ...prev, [field.slug]: v }));
    switch (field.type) {
      case "NUMBER":
        return <input type="number" className="input" value={val != null ? String(val) : ""} onChange={(e) => setVal(e.target.value ? Number(e.target.value) : null)} />;
      case "DATE":
        return <input type="date" className="input" value={typeof val === "string" ? val : ""} onChange={(e) => setVal(e.target.value || null)} />;
      case "CHECKBOX":
        return <input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={!!val} onChange={(e) => setVal(e.target.checked)} />;
      case "SELECT":
        return (
          <select className="input" value={typeof val === "string" ? val : ""} onChange={(e) => setVal(e.target.value || null)}>
            <option value="">—</option>
            {field.options.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        );
      case "MULTISELECT": {
        const arr = Array.isArray(val) ? (val as string[]) : [];
        return (
          <div className="flex flex-wrap gap-1.5">
            {field.options.map((o) => {
              const on = arr.includes(o);
              return (
                <button key={o} type="button" onClick={() => setVal(on ? arr.filter((x) => x !== o) : [...arr, o])}
                  className={`rounded-lg border px-2.5 py-1 text-xs ${on ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-600"}`}>
                  {o}
                </button>
              );
            })}
          </div>
        );
      }
      default:
        return <input type="text" className="input" value={typeof val === "string" ? val : ""} onChange={(e) => setVal(e.target.value || null)} />;
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-secondary">
        <Pencil className="h-4 w-4" />
        Tahrirlash
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} />
          <div className="card relative z-10 flex max-h-[92dvh] w-full max-w-2xl flex-col rounded-b-none sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h3 className="text-base font-semibold text-slate-900">Leadni tahrirlash</h3>
              <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {error && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

              <p className="mb-2 text-xs font-semibold uppercase text-slate-400">Asosiy</p>
              <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div><label className="label">Ism *</label><input className="input" value={f.name} onChange={set("name")} /></div>
                <div><label className="label">Telefon *</label><input className="input" value={f.phone} onChange={set("phone")} dir="ltr" /></div>
                <div><label className="label">Ikkinchi raqam</label><input className="input" value={f.secondPhone} onChange={set("secondPhone")} dir="ltr" /></div>
                <div><label className="label">Arab tilini bilish darajasi</label><input className="input" value={f.arabicLevel} onChange={set("arabicLevel")} /></div>
                <div><label className="label">Faoliyati</label><input className="input" value={f.activity} onChange={set("activity")} /></div>
                <div><label className="label">Kasb</label><input className="input" value={f.profession} onChange={set("profession")} /></div>
                <div><label className="label">Shahar</label><input className="input" value={f.city} onChange={set("city")} /></div>
                <div>
                  <label className="label">Zayafka manbasi</label>
                  <select className="input" value={f.inquirySource} onChange={set("inquirySource")}>
                    {INQUIRY_OPTS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
                  </select>
                </div>
              </div>

              <p className="mb-2 text-xs font-semibold uppercase text-slate-400">Qo&apos;shimcha</p>
              <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div><label className="label">Tarif</label><input className="input" value={f.tariff} onChange={set("tariff")} /></div>
                <div><label className="label">Yosh</label><input type="number" className="input" value={f.age} onChange={set("age")} /></div>
                <div>
                  <label className="label">Jins</label>
                  <select className="input" value={f.gender} onChange={set("gender")}>
                    <option value="">—</option>
                    <option value="MALE">Erkak</option>
                    <option value="FEMALE">Ayol</option>
                  </select>
                </div>
                <div><label className="label">Kursga qiziqish darajasi</label><input className="input" value={f.interestLevel} onChange={set("interestLevel")} /></div>
                <div><label className="label">Kelishilgan summa (so&apos;m)</label><input type="number" className="input" value={f.dealAmount} onChange={set("dealAmount")} /></div>
                <div className="sm:col-span-2"><label className="label">Maqsadi</label><input className="input" value={f.goal} onChange={set("goal")} /></div>
                <div className="sm:col-span-2"><label className="label">Izoh</label><textarea className="input min-h-20" value={f.note} onChange={set("note")} /></div>
              </div>

              <p className="mb-2 text-xs font-semibold uppercase text-slate-400">Forma savollari</p>
              <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div><label className="label">Savol 1</label><input className="input" value={f.field1} onChange={set("field1")} /></div>
                <div><label className="label">Savol 2</label><input className="input" value={f.field2} onChange={set("field2")} /></div>
                <div><label className="label">Savol 3</label><input className="input" value={f.field3} onChange={set("field3")} /></div>
              </div>

              {customFields.length > 0 && (
                <>
                  <p className="mb-2 text-xs font-semibold uppercase text-slate-400">Qo&apos;shimcha maydonlar</p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {customFields.map((cf) => (
                      <div key={cf.slug}><label className="label">{cf.name}</label>{renderCustom(cf)}</div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-2 border-t border-slate-100 px-5 py-4">
              <button onClick={() => setOpen(false)} className="btn-secondary flex-1">Bekor qilish</button>
              <button onClick={submit} disabled={pending || !f.name || !f.phone} className="btn-primary flex-1">
                {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                Saqlash
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
