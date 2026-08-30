"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StageChangeModal, type StageChangeExtraInput } from "./stage-change-modal";
import { moveLeadStageAction } from "@/lib/actions/lead-actions";
import type { BoardStage } from "./kanban-board";

interface Props {
  leadId: string;
  currentStageId: string;
  stages: BoardStage[];
  rejectionReasons: { id: string; name: string }[];
  processingReasons: { id: string; name: string }[];
}

export function LeadStageSelector({ leadId, currentStageId, stages, rejectionReasons, processingReasons }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState<BoardStage | null>(null);
  const [moving, setMoving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  const current = stages.find((s) => s.id === currentStageId);

  async function performMove(toStage: BoardStage, extra: StageChangeExtraInput = {}) {
    setMoving(true);
    setModalError(null);
    const result = await moveLeadStageAction({
      leadId,
      toStageId: toStage.id,
      callbackAt: extra.callbackAt,
      rejectionReasonId: extra.rejectionReasonId,
      rejectionNote: extra.rejectionNote,
      processingStatus: extra.processingStatus,
      paymentAmount: extra.paymentAmount,
    });
    setMoving(false);

    if (result.ok) {
      setPending(null);
      router.refresh();
      return;
    }
    if (result.code === "required_fields") {
      setPending(toStage);
      setModalError(result.error ?? null);
    } else {
      setBanner(result.error ?? "Xatolik yuz berdi.");
      setPending(null);
      setTimeout(() => setBanner(null), 4000);
    }
  }

  function handleSelect(stageId: string) {
    if (stageId === currentStageId) return;
    const toStage = stages.find((s) => s.id === stageId);
    if (!toStage) return;
    const needsModal =
      toStage.requiredFields.includes("callbackAt") ||
      toStage.requiredFields.includes("rejectionReasonId") ||
      toStage.slug === "in_progress" ||
      toStage.slug === "partial_payment" ||
      toStage.slug === "paid";
    if (needsModal) {
      setModalError(null);
      setPending(toStage);
    } else {
      performMove(toStage);
    }
  }

  return (
    <div>
      <label className="label">Bosqich</label>
      <div className="flex items-center gap-2">
        <span
          className="h-3 w-3 shrink-0 rounded-full"
          style={{ background: current?.color ?? "#94a3b8" }}
        />
        <select
          className="input"
          value={currentStageId}
          onChange={(e) => handleSelect(e.target.value)}
          disabled={moving}
        >
          {stages.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {banner && <p className="mt-2 text-sm text-red-600">{banner}</p>}

      {pending && (
        <StageChangeModal
          stageName={pending.name}
          stageSlug={pending.slug}
          requiredFields={pending.requiredFields}
          rejectionReasons={rejectionReasons}
          processingReasons={processingReasons}
          loading={moving}
          error={modalError}
          onSubmit={(extra) => performMove(pending, extra)}
          onCancel={() => {
            setPending(null);
            setModalError(null);
          }}
        />
      )}
    </div>
  );
}
