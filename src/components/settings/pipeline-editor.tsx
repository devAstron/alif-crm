"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronUp, ChevronDown, Pencil, Trash2, Plus, Loader2, X, Check } from "lucide-react";
import {
  createStageAction,
  updateStageAction,
  deactivateStageAction,
  reorderStagesAction,
} from "@/lib/actions/pipeline-actions";

export interface EditorStage {
  id: string;
  name: string;
  slug: string;
  color: string;
  isSystem: boolean;
  requiredFields: string[];
}

interface Props {
  stages: EditorStage[];
  availableFields: { key: string; label: string }[];
}

export function PipelineEditor({ stages, availableFields }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("#6b7280");
  const [editRequired, setEditRequired] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#6366f1");
  const [error, setError] = useState<string | null>(null);

  function startEdit(s: EditorStage) {
    setEditingId(s.id);
    setEditName(s.name);
    setEditColor(s.color);
    setEditRequired(s.requiredFields);
    setError(null);
  }

  function saveEdit() {
    startTransition(async () => {
      const res = await updateStageAction({ id: editingId!, name: editName, color: editColor, requiredFields: editRequired });
      if (res.ok) { setEditingId(null); router.refresh(); }
      else setError(res.error ?? "Xatolik");
    });
  }

  function toggleField(key: string) {
    setEditRequired((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= stages.length) return;
    const ids = stages.map((s) => s.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    startTransition(async () => { await reorderStagesAction(ids); router.refresh(); });
  }

  function addStage() {
    startTransition(async () => {
      const res = await createStageAction({ name: newName, color: newColor });
      if (res.ok) { setAdding(false); setNewName(""); router.refresh(); }
      else setError(res.error ?? "Xatolik");
    });
  }

  function remove(id: string) {
    if (!confirm("Bu bosqichni o'chirishni tasdiqlaysizmi?")) return;
    startTransition(async () => {
      const res = await deactivateStageAction(id);
      if (!res.ok) { setError(res.error ?? "Xatolik"); }
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</div>}

      {stages.map((s, i) => (
        <div key={s.id} className="card p-4">
          {editingId === s.id ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <input type="color" className="h-9 w-12 rounded border border-slate-200" value={editColor} onChange={(e) => setEditColor(e.target.value)} />
                <input className="input max-w-xs" value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>
              <div>
                <p className="label">Bu bosqichga o&apos;tish uchun majburiy maydonlar:</p>
                <div className="flex flex-wrap gap-2">
                  {availableFields.map((f) => (
                    <label key={f.key} className={`cursor-pointer rounded-lg border px-2.5 py-1 text-xs ${editRequired.includes(f.key) ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-600"}`}>
                      <input type="checkbox" className="hidden" checked={editRequired.includes(f.key)} onChange={() => toggleField(f.key)} />
                      {f.label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={saveEdit} disabled={pending} className="btn-primary py-1.5">
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Saqlash
                </button>
                <button onClick={() => setEditingId(null)} className="btn-secondary py-1.5"><X className="h-4 w-4" /> Bekor</button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex flex-col">
                <button onClick={() => move(i, -1)} disabled={i === 0 || pending} className="text-slate-300 hover:text-slate-600 disabled:opacity-30"><ChevronUp className="h-4 w-4" /></button>
                <button onClick={() => move(i, 1)} disabled={i === stages.length - 1 || pending} className="text-slate-300 hover:text-slate-600 disabled:opacity-30"><ChevronDown className="h-4 w-4" /></button>
              </div>
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: s.color }} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900">{s.name}</p>
                <p className="text-xs text-slate-400">
                  {s.slug}
                  {s.isSystem && " · tizim"}
                  {s.requiredFields.length > 0 && ` · ${s.requiredFields.length} majburiy maydon`}
                </p>
              </div>
              <button onClick={() => startEdit(s)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><Pencil className="h-4 w-4" /></button>
              {!s.isSystem && (
                <button onClick={() => remove(s.id)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
              )}
            </div>
          )}
        </div>
      ))}

      {adding ? (
        <div className="card flex flex-wrap items-center gap-3 p-4">
          <input type="color" className="h-9 w-12 rounded border border-slate-200" value={newColor} onChange={(e) => setNewColor(e.target.value)} />
          <input className="input max-w-xs" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Bosqich nomi" />
          <button onClick={addStage} disabled={pending || !newName} className="btn-primary py-1.5">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Qo&apos;shish
          </button>
          <button onClick={() => setAdding(false)} className="btn-secondary py-1.5"><X className="h-4 w-4" /></button>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="btn-secondary w-full"><Plus className="h-4 w-4" /> Bosqich qo&apos;shish</button>
      )}
    </div>
  );
}
