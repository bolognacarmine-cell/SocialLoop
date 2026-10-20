"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PLATFORM_META } from "@/lib/social/platforms";
import type { SocialPlatform } from "@prisma/client";

type CalendarItem = {
  id: string;
  body: string;
  status: string;
  scheduledAt: string;
  platforms: SocialPlatform[];
};

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

const weekdayLabels = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

export function EditorialCalendar({ items }: { items: CalendarItem[] }) {
  const router = useRouter();
  const today = new Date();
  const [cursor, setCursor] = useState(startOfMonth(today));
  const [dragging, setDragging] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const monthLabel = cursor.toLocaleDateString("it-IT", { month: "long", year: "numeric" });
  const firstWeekday = (startOfMonth(cursor).getDay() + 6) % 7;
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const gridStart = addDays(startOfMonth(cursor), -firstWeekday);
  const cells = Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));

  const byDay = new Map<string, CalendarItem[]>();
  for (const item of items) {
    const key = new Date(item.scheduledAt).toDateString();
    byDay.set(key, [...(byDay.get(key) ?? []), item]);
  }

  async function reschedule(postId: string, date: Date) {
    setError(null);
    const target = new Date(date);
    const source = items.find((item) => item.id === postId);
    if (source) {
      const original = new Date(source.scheduledAt);
      target.setHours(original.getHours(), original.getMinutes(), 0, 0);
    } else {
      target.setHours(9, 0, 0, 0);
    }

    const response = await fetch(`/api/posts/${postId}/schedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduledAt: target.toISOString() })
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? "Riprogrammazione non riuscita");
    }
    setDragging(null);
    router.refresh();
  }

  return (
    <div>
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex gap-2">
          <button
            type="button"
            className="btn-ghost !px-3 !py-1.5 text-xs"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
          >
            ← Mese prec.
          </button>
          <button
            type="button"
            className="btn-ghost !px-3 !py-1.5 text-xs"
            onClick={() => setCursor(startOfMonth(new Date()))}
          >
            Oggi
          </button>
          <button
            type="button"
            className="btn-ghost !px-3 !py-1.5 text-xs"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
          >
            Mese succ. →
          </button>
        </div>
        <p className="text-sm font-semibold capitalize text-slate-700">{monthLabel}</p>
      </div>

      {error ? (
        <p className="mx-5 mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      ) : null}

      <div className="grid grid-cols-7 border-t border-slate-100 bg-slate-50 text-center">
        {weekdayLabels.map((label) => (
          <div key={label} className="px-2 py-2 text-xs font-semibold uppercase text-slate-500">
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((day) => {
          const key = day.toDateString();
          const dayItems = byDay.get(key) ?? [];
          const isCurrentMonth = day.getMonth() === cursor.getMonth();
          const isToday = day.toDateString() === today.toDateString();
          return (
            <div
              key={key}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                if (dragging) void reschedule(dragging, day);
              }}
              className={`min-h-[110px] border-b border-r border-slate-100 p-1.5 ${
                isCurrentMonth ? "bg-white" : "bg-slate-50/60"
              }`}
            >
              <div className="mb-1 flex justify-end">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                    isToday ? "bg-loop-600 text-white" : "text-slate-500"
                  }`}
                >
                  {day.getDate()}
                </span>
              </div>
              <div className="space-y-1">
                {dayItems.map((item) => (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={() => setDragging(item.id)}
                    className="cursor-grab rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] shadow-sm active:cursor-grabbing"
                  >
                    <div className="mb-1 flex items-center gap-1">
                      {item.platforms.slice(0, 4).map((platform) => (
                        <span
                          key={platform}
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: PLATFORM_META[platform].color }}
                        />
                      ))}
                    </div>
                    <p className="line-clamp-2 text-slate-600">{item.body.slice(0, 60)}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <p className="px-5 py-3 text-xs text-slate-400">
        Suggerimento: trascina un contenuto su un altro giorno per riprogrammarlo.
      </p>
    </div>
  );
}
