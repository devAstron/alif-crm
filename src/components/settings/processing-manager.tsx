"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Loader2, X, Check, Eye, EyeOff } from "lucide-react";
import {
  createProcessingReasonAction,
  updateProcessingReasonAction,
  toggleProcessingReasonAction,
} from "@/lib/actions/processing-actions";

export interface ReasonItem {
  id: string;
  name: string;
  isActive: boolean;
}

export function ProcessingManager({ reasons }: { reasons: ReasonItem[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);

  function save(id: string) {
    startTransition(async () => {
      const res = await updateProcessingReasonAction(id, editName);
      if (res.ok) { setEditingId(null); router.refresh(); } else setError(res.error ?? "Xato");
    });
  }
  function add() {
    startTransition(async () => {
      const res = await createProcessingReasonAction(newName);
      if (res.ok) { setAdding(false); setNewName(""); router.refresh(); } else setError(res.error ?? "Xato");
    });
  }
  function toggle(id: string) {
    startTransition(async () => { await toggleProcessingReasonAction(id); router.refresh(); });
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-sm text-red-600">{error}</p>}
      {reasons.map((r) => (
        <div key={r.id} className={`card flex items-center gap-3 p-3.5 ${!r.isActive ? "opacity-60" : ""}`}>
          {editingId === r.id ? (
            <>
              <input className="input flex-1" value={editName} onChange={(e) => setEditName(e.target.value)} />
              <button onClick={() => save(r.id)} disabled={pending} className="btn-primary py-1.5"><Check className="h-4 w-4" /></button>
              <button onClick={() => setEditingId(null)} className="btn-secondary py-1.5"><X className="h-4 w-4" /></button>
            </>
          ) : (
            <>
              <span className="flex-1 text-sm text-slate-800">{r.name}{!r.isActive && <span className="ml-2 text-xs text-slate-400">nofaol</span>}</span>
              <button onClick={() => { setEditingId(r.id); setEditName(r.name); }} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><Pencil className="h-4 w-4" /></button>
              <button onClick={() => toggle(r.id)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">{r.isActive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
            </>
          )}
        </div>
      ))}

      {adding ? (
        <div className="card flex items-center gap-2 p-3.5">
          <input className="input flex-1" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Holat nomi" />
          <button onClick={add} disabled={pending || !newName} className="btn-primary py-1.5">{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}</button>
          <button onClick={() => setAdding(false)} className="btn-secondary py-1.5"><X className="h-4 w-4" /></button>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="btn-secondary w-full"><Plus className="h-4 w-4" /> Holat qo&apos;shish</button>
      )}
    </div>
  );
}
