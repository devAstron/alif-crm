"use client";

import { useState } from "react";
import { addDays } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

const TZ = "Asia/Tashkent";
const WEEKDAYS_UZ = ["Yak", "Dush", "Sesh", "Chor", "Pay", "Jum", "Shan"]; // 0=Yakshanba

// Yaxlit soatlar (ish vaqti): 08:00 - 21:00
const HOURS = Array.from({ length: 14 }, (_, i) => `${String(i + 8).padStart(2, "0")}:00`);

interface Props {
  /** UTC ISO string yoki "" */
  value: string;
  onChange: (iso: string) => void;
}

/**
 * Qulay sana+vaqt tanlagich: bugundan 7 kungacha sana chiplari + yaxlit soat.
 * Tanlangan vaqt Asia/Tashkent bo'yicha talqin qilinib, UTC ISO sifatida qaytariladi.
 */
export function DateTimeQuick({ value, onChange }: Props) {
  const [dateKey, setDateKey] = useState<string>("");
  const [time, setTime] = useState<string>("");

  // 8 kun: bugun + keyingi 7 kun
  const now = new Date();
  const days = Array.from({ length: 8 }, (_, i) => {
    const d = addDays(now, i);
    const key = formatInTimeZone(d, TZ, "yyyy-MM-dd");
    const dow = Number(formatInTimeZone(d, TZ, "i")) % 7; // 1=Mon..7=Sun -> 1..6,0
    const label = i === 0 ? "Bugun" : i === 1 ? "Ertaga" : WEEKDAYS_UZ[dow];
    const sub = formatInTimeZone(d, TZ, "dd.MM");
    return { key, label, sub };
  });

  // value tashqaridan tozalansa (masalan submitdan keyin) — chiplarni tiklaymiz
  // (effekt'siz, render vaqtida — React tavsiyasi)
  const [prevValue, setPrevValue] = useState(value);
  if (prevValue !== value) {
    setPrevValue(value);
    if (!value && (dateKey || time)) {
      setDateKey("");
      setTime("");
    }
  }

  function emit(nextDate: string, nextTime: string) {
    if (nextDate && nextTime) {
      const local = `${nextDate}T${nextTime}:00`;
      const utc = fromZonedTime(local, TZ);
      onChange(utc.toISOString());
    } else {
      onChange("");
    }
  }

  return (
    <div className="space-y-3">
      {/* Sana chiplari */}
      <div>
        <p className="mb-1.5 text-xs text-slate-500">Kun</p>
        <div className="scroll-thin -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {days.map((d) => (
            <button
              key={d.key}
              type="button"
              onClick={() => { setDateKey(d.key); emit(d.key, time); }}
              className={`flex shrink-0 flex-col items-center rounded-lg border px-3 py-1.5 text-center transition ${
                dateKey === d.key
                  ? "border-brand-500 bg-brand-50 text-brand-700"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <span className="text-sm font-medium leading-tight">{d.label}</span>
              <span className="text-[11px] text-slate-400">{d.sub}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Soat */}
      <div>
        <p className="mb-1.5 text-xs text-slate-500">Soat</p>
        <div className="scroll-thin -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {HOURS.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => { setTime(h); emit(dateKey, h); }}
              className={`shrink-0 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                time === h
                  ? "border-brand-500 bg-brand-50 text-brand-700"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {h}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
