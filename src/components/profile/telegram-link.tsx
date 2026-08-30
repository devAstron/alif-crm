"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send, Loader2, Check, Unlink } from "lucide-react";
import {
  generateTelegramLinkCodeAction,
  unlinkTelegramAction,
} from "@/lib/actions/telegram-actions";

interface Props {
  configured: boolean;
  linked: boolean;
  username: string | null;
}

export function TelegramLink({ configured, linked, username }: Props) {
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

  function unlink() {
    startTransition(async () => {
      await unlinkTelegramAction();
      setCode(null);
      router.refresh();
    });
  }

  if (!configured) {
    return (
      <div className="card p-5">
        <h3 className="mb-1 text-sm font-semibold text-slate-900">Telegram bildirishnomalari</h3>
        <p className="text-sm text-slate-500">
          Telegram bot hali sozlanmagan. Administrator <code className="rounded bg-slate-100 px-1">TELEGRAM_BOT_TOKEN</code> ni kiritishi kerak.
        </p>
      </div>
    );
  }

  return (
    <div className="card p-5">
      <h3 className="mb-1 text-sm font-semibold text-slate-900">Telegram bildirishnomalari</h3>

      {linked ? (
        <div>
          <p className="mb-3 flex items-center gap-2 text-sm text-green-600">
            <Check className="h-4 w-4" />
            Bog&apos;langan{username ? ` (@${username})` : ""}
          </p>
          <button onClick={unlink} disabled={pending} className="btn-secondary">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlink className="h-4 w-4" />}
            Uzish
          </button>
        </div>
      ) : code ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Telegram botni oching va quyidagi buyruqni yuboring:
          </p>
          <div className="rounded-lg bg-slate-900 px-4 py-3 font-mono text-sm text-white">
            /start {code}
          </div>
          {deepLink && (
            <a href={deepLink} target="_blank" rel="noopener noreferrer" className="btn-primary">
              <Send className="h-4 w-4" />
              Botni ochish
            </a>
          )}
          <p className="text-xs text-slate-400">Kod 15 daqiqa amal qiladi.</p>
        </div>
      ) : (
        <div>
          <p className="mb-3 text-sm text-slate-500">
            Muhim bildirishnomalarni (qayta aloqa vaqti, to&apos;lov, lead o&apos;zgarishi) Telegram orqali oling.
          </p>
          <button onClick={generate} disabled={pending} className="btn-primary">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Telegramni bog&apos;lash
          </button>
        </div>
      )}
    </div>
  );
}
