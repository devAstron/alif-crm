"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send, Loader2, AlertTriangle } from "lucide-react";
import { generateTelegramLinkCodeAction } from "@/lib/actions/telegram-actions";

/** Operator botni faollashtirmaguncha ishlay olmaydi — prominent banner. */
export function TelegramActivate() {
  const router = useRouter();
  const [code, setCode] = useState<string | null>(null);
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function generate() {
    startTransition(async () => {
      const res = await generateTelegramLinkCodeAction();
      if (res.ok) {
        setCode(res.code ?? null);
        setDeepLink(res.deepLink ?? null);
      }
    });
  }

  return (
    <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h3 className="text-base font-semibold text-amber-900">Ishni boshlash uchun Telegram botni faollashtiring</h3>
          <p className="mt-1 text-sm text-amber-800">
            Mijozlar bo&apos;limiga kirish va muhim bildirishnomalarni olish uchun Telegram botni bog&apos;lang.
          </p>

          {code ? (
            <div className="mt-4 space-y-3">
              <p className="text-sm text-amber-900">Telegram botni oching va quyidagini yuboring:</p>
              <div className="inline-block rounded-lg bg-slate-900 px-4 py-2.5 font-mono text-sm text-white">
                /start {code}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {deepLink && (
                  <a href={deepLink} target="_blank" rel="noopener noreferrer" className="btn-primary">
                    <Send className="h-4 w-4" />
                    Botni ochish
                  </a>
                )}
                <button onClick={() => router.refresh()} className="btn-secondary">
                  Bog&apos;ladim, tekshirish
                </button>
              </div>
              <p className="text-xs text-amber-700">Bog&apos;langach shu tugmani bosing yoki sahifani yangilang. Kod 15 daqiqa amal qiladi.</p>
            </div>
          ) : (
            <button onClick={generate} disabled={pending} className="btn-primary mt-4">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Telegramni faollashtirish
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
