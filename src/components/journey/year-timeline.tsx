"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PixelIcon } from "@/components/pixel-icons";
import { milestoneExtent, milestoneStatus, spanPosition, timelineSpan, wibDate, type Milestone, type MilestoneStatus } from "@/lib/journey";
import { dayLabel, rangeLabel } from "@/lib/schedule";

export type Track = { name: string; href: string; color: "blue" | "green"; milestones: readonly Milestone[] };

const statusLabel: Record<MilestoneStatus, string> = { done: "Selesai", current: "Berlangsung", upcoming: "Akan datang" };

/**
 * The year as two tracks on one ruler, drawn to scale from the program modules' dates. The landing is prerendered,
 * so "today" is read after hydration: until then the milestones show no status and the ruler has no pin.
 */
export function YearTimeline({ tracks }: { tracks: readonly Track[] }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setNow(Date.now()));
    return () => cancelAnimationFrame(frame);
  }, []);
  const span = timelineSpan(tracks.flatMap((track) => track.milestones));
  const today = now === null ? null : spanPosition(span, now);
  const pinned = today !== null && today >= 0 && today <= 1;
  const percent = (value: number) => `${(value * 100).toFixed(3)}%`;
  const columns = span.months.map((month) => `${month.share}fr`).join(" ");

  return (
    <div className="year">
      <div className="year-ruler" aria-hidden="true">
        <div className="year-grid" style={{ gridTemplateColumns: columns }}>
          {span.months.map((month) => (
            <span key={month.key} />
          ))}
        </div>
        <div className="year-months" style={{ gridTemplateColumns: columns }}>
          {span.months.map((month, index) => (
            <span key={month.key}>
              {month.label}
              {(index === 0 || month.label === "Jan") && <small> {month.year}</small>}
            </span>
          ))}
        </div>
        {tracks.map((track) => (
          <div key={track.name} className="year-lane" data-color={track.color}>
            {track.milestones.map((milestone, index) => {
              const { left, width } = milestoneExtent(span, milestone);
              return (
                <span
                  key={milestone.label}
                  className={milestone.end ? "year-bar" : "year-dot"}
                  data-status={now === null ? undefined : milestoneStatus(now, milestone)}
                  style={{ left: percent(left), width: milestone.end ? percent(width) : undefined }}
                >
                  {index + 1}
                </span>
              );
            })}
          </div>
        ))}
        {pinned && (
          <span className="year-today" style={{ left: percent(today) }}>
            <span>Hari ini</span>
          </span>
        )}
      </div>
      <p className="year-now">
        {now !== null && (
          <>
            <PixelIcon name="calendar" size={16} /> Hari ini {dayLabel(wibDate(now))} WIB
          </>
        )}
      </p>
      <div className="year-tracks">
        {tracks.map((track) => (
          <div key={track.name} className="year-track" data-color={track.color}>
            <h3>
              <Link href={track.href}>{track.name}</Link>
            </h3>
            <ol>
              {track.milestones.map((milestone) => {
                const status = now === null ? undefined : milestoneStatus(now, milestone);
                return (
                  <li key={milestone.label} data-status={status}>
                    <span className="year-date">{rangeLabel(milestone.start, milestone.end)}</span>
                    <span className="year-label">{milestone.label}</span>
                    <span className="year-status">{status && statusLabel[status]}</span>
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
      </div>
    </div>
  );
}
