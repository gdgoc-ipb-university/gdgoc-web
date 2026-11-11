"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PixelIcon } from "@/components/pixel-icons";
import { Arrow } from "@/components/icons";
import {
  laneRows,
  milestoneExtent,
  milestoneStatus,
  spanPosition,
  timelineSpan,
  timelineSteps,
  wibDate,
  type Milestone,
  type MilestoneStatus,
} from "@/lib/journey";
import { dayLabel, rangeLabel } from "@/lib/schedule";

export type Track = { name: string; href: string; color: "blue" | "green"; milestones: readonly Milestone[] };

const statusLabel: Record<MilestoneStatus, string> = { done: "Selesai", current: "Berlangsung", upcoming: "Akan datang" };

/** How wide the ruler draws a step at least, as a share of the year: a one-day step still gets a numbered box. */
const minStepWidth = 0.03;

/**
 * The year as one track per program on one ruler, drawn to scale from the program modules' dates: Catalyst's items
 * (unless its schedule is on hold), and Tech League's five milestones (its page lists every item). Overlapping steps
 * stack in rows. The landing is prerendered, so "today" is read after hydration: until then the steps show no status
 * and the ruler has no pin.
 */
export function YearTimeline({ tracks }: { tracks: readonly Track[] }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setNow(Date.now()));
    return () => cancelAnimationFrame(frame);
  }, []);
  const span = timelineSpan(tracks.flatMap((track) => track.milestones));
  const lanes = tracks.map((track) => {
    const steps = timelineSteps(track.milestones);
    const extents = steps.map((step) => milestoneExtent(span, step));
    return { ...track, steps, extents, rows: laneRows(extents, minStepWidth) };
  });
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
        {lanes.map((lane) => (
          <div
            key={lane.name}
            className="year-lane"
            data-color={lane.color}
            style={{ "--rows": Math.max(...lane.rows) + 1 } as React.CSSProperties}
          >
            {lane.steps.map((step, index) => (
              <span
                key={step.label}
                className={step.end ? "year-bar" : "year-dot"}
                data-status={now === null ? undefined : milestoneStatus(now, step)}
                style={{
                  left: percent(lane.extents[index].left),
                  width: step.end ? percent(lane.extents[index].width) : undefined,
                  top: `calc(${lane.rows[index]} * var(--row))`,
                }}
              >
                {index + 1}
              </span>
            ))}
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
        {lanes.map((lane) => (
          <div key={lane.name} className="year-track" data-color={lane.color}>
            <h3>
              <Link href={lane.href}>{lane.name}</Link>
            </h3>
            <ol>
              {lane.steps.map((step) => {
                const status = now === null ? undefined : milestoneStatus(now, step);
                return (
                  <li key={step.label} data-status={status}>
                    <span className="year-date">{rangeLabel(step.start, step.end)}</span>
                    <span className="year-label">{step.label}</span>
                    <span className="year-status">{status && statusLabel[status]}</span>
                  </li>
                );
              })}
            </ol>
            <Link className="text-link" href={lane.href}>
              Jadwal lengkap {lane.name} <Arrow />
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
