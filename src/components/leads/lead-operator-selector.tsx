"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { reassignLeadAction } from "@/lib/actions/lead-actions";

interface Props {
  leadId: string;
  currentOperatorId: string | null;
  operators: { id: string; name: string }[];
}

export function LeadOperatorSelector({ leadId, currentOperatorId, operators }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function change(operatorId: string) {
    if (!operatorId || operatorId === currentOperatorId) return;
    startTransition(async () => {
      await reassignLeadAction({ leadId, operatorId });
      router.refresh();
    });
  }

  return (
    <div>
      <label className="label">Operator</label>
      <select
        className="input"
        value={currentOperatorId ?? ""}
        onChange={(e) => change(e.target.value)}
        disabled={pending}
      >
        <option value="">Biriktirilmagan</option>
        {operators.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </div>
  );
}
