"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Loader2 } from "lucide-react";
import { createLeadAction } from "@/lib/actions/lead-actions";
import { DateTimeQuick } from "@/components/ui/datetime-quick";

// Manba: operator qo'lda tanlaydi (source matni + inquirySource enum)
const SOURCE_OPTS = [
  { source: "Instagram Direct", inquiry: "INSTAGRAM_DIRECT" },
  { source: "Instagram komment", inquiry: "INSTAGRAM_COMMENT" },
  { source: "Sarafan", inquiry: "REFERRAL" },
  { source: "Target", inquiry: "TARGET" },
  { source: "Telegram", inquiry: "OTHER" },
  { source: "Boshqa", inquiry: "OTHER" },
] as const;

// Qo'lda yaratishda tanlash mumkin bo'lgan bosqichlar (dastlabki voronka)
const ENTRY_SLUGS = ["unprocessed", "new_lead", "first_call", "no_answer", "callback", "in_progress"];

export function CreateLeadModal({ stages }: { stages: { slug: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const entryStages = stages.filter((s) => ENTRY_SLUGS.includes(s.slug));

  const [f, setF] = useState({
    name: "",
    phone: "",
    secondPhone: "",
    sourceIdx: "0",
    arabicLevel: "",
    activity: "",
    profession: "",
    city: "",
    tariff: "",
    age: "",
    gender: "",
    interestLevel: "",
    dealAmount: "",
    goal: "",
    note: "",
    stageSlug: "",
    callbackAt: "",
  });

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF((prev) => ({ ...prev, [k]: e.target.value }));

  function reset() {
    setF({
      name: "", phone: "", secondPhone: "", sourceIdx: "0", arabicLevel: "", activity: "",
      profession: "", city: "", tariff: "", age: "", gender: "", interestLevel: "",
      dealAmount: "", goal: "", note: "", stageSlug: "", callbackAt: "",
    });
    setError(null);
  }

  function submit() {
    setError(null);
    const opt = SOURCE_OPTS[Number(f.sourceIdx)] ?? SOURCE_OPTS[0];
    startTransition(async () => {
      const res = await createLeadAction({
        name: f.name,
        phone: f.phone,
        secondPhone: f.secondPhone || null,
        source: opt.source,
        inquirySource: opt.inquiry,
        arabicLevel: f.arabicLevel || null,
        activity: f.activity || null,
        profession: f.profession || null,
        city: f.city || null,
        tariff: f.tariff || null,
        age: f.age ? Number(f.age) : null,
        gender: (f.gender || null) as "MALE" | "FEMALE" | null,
        interestLevel: f.interestLevel || null,
        dealAmount: f.dealAmount ? Number(f.dealAmount) : null,
        goal: f.goal || null,
        note: f.note || null,
        stageSlug: f.stageSlug || null,
        callbackAt: f.stageSlug === "callback" ? f.callbackAt || null : null,
      });
      if (res.ok && res.data) {
        setOpen(false);
        reset();
        router.push(`/leads/${res.data.leadId}`);
      } else {
        setError(res.error ?? "Xatolik");
      }
    });
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary">
        <Plus className="h-4 w-4" />
        Yangi lead
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} />
          <div className="card relative z-10 flex max-h-[92dvh] w-full max-w-2xl flex-col rounded-b-none sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h3 className="text-base font-semibold text-slate-900">Qo&apos;lda yangi lead</h3>
              <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {error && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

              <p className="mb-2 text-xs font-semibold uppercase text-slate-400">Asosiy</p>
              <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div><label className="label">Ism *</label><input className="input" value={f.name} onChange={set("name")} placeholder="Mijoz ismi" /></div>
                <div><label className="label">Telefon *</label><input className="input" value={f.phone} onChange={set("phone")} dir="ltr" placeholder="+998 90 123 45 67" /></div>
                <div><label className="label">Ikkinchi raqam</label><input className="input" value={f.secondPhone} onChange={set("secondPhone")} dir="ltr" /></div>
                <div>
                  <label className="label">Manba *</label>
                  <select className="input" value={f.sourceIdx} onChange={set("sourceIdx")}>
                    {SOURCE_OPTS.map((o, i) => <option key={o.source} value={i}>{o.source}</option>)}
                  </select>
                </div>
              </div>

              <p className="mb-2 text-xs font-semibold uppercase text-slate-400">Voronka bosqichi</p>
              <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="label">Bosqich</label>
                  <select className="input" value={f.stageSlug} onChange={set("stageSlug")}>
                    <option value="">Yangi lead (avtomatik, o&apos;zingizga biriktiriladi)</option>
                    {entryStages.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}
                  </select>
                </div>
                {f.stageSlug === "callback" && (
                  <div>
                    <label className="label">Qayta aloqa vaqti</label>
                    <DateTimeQuick value={f.callbackAt} onChange={(v) => setF((p) => ({ ...p, callbackAt: v }))} />
                  </div>
                )}
              </div>

              <p className="mb-2 text-xs font-semibold uppercase text-slate-400">Qo&apos;shimcha</p>
              <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div><label className="label">Arab tilini bilish darajasi</label><input className="input" value={f.arabicLevel} onChange={set("arabicLevel")} /></div>
                <div><label className="label">Faoliyati</label><input className="input" value={f.activity} onChange={set("activity")} /></div>
                <div><label className="label">Kasb</label><input className="input" value={f.profession} onChange={set("profession")} /></div>
                <div><label className="label">Shahar</label><input className="input" value={f.city} onChange={set("city")} /></div>
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
            </div>

            <div className="flex gap-2 border-t border-slate-100 px-5 py-4">
              <button onClick={() => setOpen(false)} className="btn-secondary flex-1">Bekor qilish</button>
              <button onClick={submit} disabled={pending || !f.name || !f.phone} className="btn-primary flex-1">
                {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                Yaratish
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
