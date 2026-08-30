"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send, Loader2, MessageSquare } from "lucide-react";
import { addCommentAction } from "@/lib/actions/comment-actions";
import { formatTashkent } from "@/lib/datetime";

export interface CommentRow {
  id: string;
  author: string;
  body: string;
  createdAt: Date;
}

/** Bosqich tanlagich yonidagi tezkor izoh: yangi izohlar tagidan qo'shilib boradi. */
export function LeadComments({ leadId, comments, readOnly = false }: { leadId: string; comments: CommentRow[]; readOnly?: boolean }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!body.trim()) return;
    setError(null);
    startTransition(async () => {
      const res = await addCommentAction({ leadId, body });
      if (res.ok) {
        setBody("");
        router.refresh();
      } else {
        setError(res.error ?? "Xatolik");
      }
    });
  }

  return (
    <div>
      <label className="label flex items-center gap-1.5">
        <MessageSquare className="h-4 w-4 text-slate-400" />
        Izohlar
      </label>

      {/* To'plangan izohlar (eskidan yangiga — yangisi tagida) */}
      {comments.length > 0 && (
        <div className="scroll-thin mb-2 max-h-40 space-y-1.5 overflow-y-auto rounded-lg border border-slate-100 bg-slate-50 p-2.5">
          {comments.map((c) => (
            <div key={c.id} className="text-sm">
              <span className="text-slate-800">{c.body}</span>
              <span className="ml-1.5 text-xs text-slate-400">
                — {c.author}, {formatTashkent(c.createdAt, "dd.MM HH:mm")}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Yangi izoh */}
      {!readOnly && (
      <div className="flex gap-2">
        <input
          type="text"
          className="input"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Izoh qo'shing..."
        />
        <button onClick={submit} disabled={pending || !body.trim()} className="btn-primary shrink-0">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
      )}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      {readOnly && comments.length === 0 && <p className="text-sm text-slate-400">Izohlar yo&apos;q</p>}
    </div>
  );
}
