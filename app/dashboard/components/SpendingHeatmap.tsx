import React from "react";
import type { HeatmapCell } from "@/lib/analytics";

const MONTH_ABBRS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function heatColor(total: number, min: number, max: number): string {
  if (max === min) return "hsl(200, 60%, 75%)";
  const t = (total - min) / (max - min); // 0 = low (cool), 1 = high (warm)
  const hue = Math.round(210 - t * 210); // blue (210) → red (0)
  const sat = Math.round(60 + t * 30);
  const lit = Math.round(80 - t * 35);
  return `hsl(${hue}, ${sat}%, ${lit}%)`;
}

interface SpendingHeatmapProps {
  cells: HeatmapCell[];
  years: number[];
  minTotal: number;
  maxTotal: number;
}

export function SpendingHeatmap({ cells, years, minTotal, maxTotal }: SpendingHeatmapProps) {
  if (cells.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        No bill data to display.
      </p>
    );
  }

  // Build lookup map keyed by "year-month"
  const cellMap = new Map<string, HeatmapCell>();
  cells.forEach((c) => cellMap.set(`${c.year}-${c.month}`, c));

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <div
          className="grid gap-1 min-w-[560px]"
          style={{ gridTemplateColumns: "3rem repeat(12, 1fr)" }}
        >
          {/* Header row */}
          <div />
          {MONTH_ABBRS.map((m) => (
            <div
              key={m}
              className="text-center text-xs font-medium text-muted-foreground py-1"
            >
              {m}
            </div>
          ))}

          {/* Data rows, one per year */}
          {years.map((year) => (
            <React.Fragment key={year}>
              <div className="text-xs font-medium text-muted-foreground flex items-center justify-end pr-2"
              >
                {year}
              </div>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((month) => {
                const cell = cellMap.get(`${year}-${month}`);
                return (
                  <div
                    key={`${year}-${month}`}
                    className="rounded aspect-square flex items-center justify-center text-[10px] font-mono leading-none"
                    style={{
                      backgroundColor: cell
                        ? heatColor(cell.total, minTotal, maxTotal)
                        : "transparent",
                      color: cell
                        ? cell.total > (minTotal + maxTotal) / 2
                          ? "#1a1a1a"
                          : "#333"
                        : "transparent",
                      border: cell ? "none" : "1px dashed #e2e8f0",
                    }}
                    title={cell ? `${cell.label}: $${cell.total.toFixed(2)}` : "No data"}
                  >
                    {cell ? `$${Math.round(cell.total)}` : ""}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>Low</span>
        <div
          className="h-3 flex-1 rounded"
          style={{
            background: `linear-gradient(to right, hsl(210,60%,80%), hsl(105,75%,62%), hsl(0,90%,62%))`,
          }}
        />
        <span>High</span>
      </div>
    </div>
  );
}
