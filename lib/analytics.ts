import { formatDollar } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Matches the shape produced by effData in dashboard/page.tsx */
export interface DashboardRow {
  bill_date: string;
  month: string;
  electric: number;
  water: number;
  sewer: number;
  refuse: number;
  stormwater: number;
  total: number;
  kwh: number;
  water_usage: number;
  power_cost_adj: number;
  days: number;
  cost_per_kwh: number | null;
  cost_per_water: number | null;
  pca_pct: number | null;
  cost_per_day: number | null;
}

export type InsightSeverity = "info" | "positive" | "warning";

export interface Insight {
  id: string;
  severity: InsightSeverity;
  text: string;
}

export interface DecompositionResult {
  totalDelta: number;
  usageContribution: number;
  rateContribution: number;
  daysContribution: number;
  residual: number;
  hasElecData: boolean;
}

export interface HeatmapCell {
  year: number;
  month: number; // 1–12
  total: number;
  label: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function avg(nums: (number | null | undefined)[]): number {
  const valid = nums.filter((n): n is number => n != null && !isNaN(n));
  return valid.length === 0 ? 0 : valid.reduce((a, b) => a + b, 0) / valid.length;
}

// ---------------------------------------------------------------------------
// computeInsights
// ---------------------------------------------------------------------------

/**
 * @param rows - range-filtered rows (used for most insights)
 * @param allRows - full bill history (used for PCA baseline and seasonal patterns)
 */
export function computeInsights(
  rows: DashboardRow[],
  allRows: DashboardRow[]
): Insight[] {
  const insights: Insight[] = [];

  // ── 1. Electric rate change detection ─────────────────────────────────────
  // Needs 2 consecutive bills with valid cost_per_kwh. Report most recent only.
  {
    const rateRows = rows.filter((r) => r.cost_per_kwh !== null);
    for (let i = rateRows.length - 1; i >= 1; i--) {
      const curr = rateRows[i].cost_per_kwh!;
      const prev = rateRows[i - 1].cost_per_kwh!;
      if (prev === 0) continue;
      const pct = ((curr - prev) / prev) * 100;
      if (Math.abs(pct) >= 5) {
        const dir = pct > 0 ? "jumped" : "dropped";
        insights.push({
          id: "elec-rate-change",
          severity: pct > 0 ? "warning" : "positive",
          text: `Your electric rate ${dir} from ${formatDollar(prev)}/kWh to ${formatDollar(curr)}/kWh in ${rateRows[i].month}. Cost changes are likely from rates, not usage.`,
        });
        break;
      }
    }
  }

  // ── 2. Water rate change detection ────────────────────────────────────────
  {
    const rateRows = rows.filter((r) => r.cost_per_water !== null);
    for (let i = rateRows.length - 1; i >= 1; i--) {
      const curr = rateRows[i].cost_per_water!;
      const prev = rateRows[i - 1].cost_per_water!;
      if (prev === 0) continue;
      const pct = ((curr - prev) / prev) * 100;
      if (Math.abs(pct) >= 5) {
        const dir = pct > 0 ? "jumped" : "dropped";
        insights.push({
          id: "water-rate-change",
          severity: pct > 0 ? "warning" : "positive",
          text: `Your water rate ${dir} from ${formatDollar(prev)}/unit to ${formatDollar(curr)}/unit in ${rateRows[i].month}.`,
        });
        break;
      }
    }
  }

  // ── 3. Long-term cost trend (linear regression) ───────────────────────────
  // Needs >= 4 rows.
  if (rows.length >= 4) {
    const n = rows.length;
    const ys = rows.map((r) => r.total);
    const xMean = (n - 1) / 2;
    const yMean = avg(ys);
    const numerator = rows.reduce((sum, _, i) => sum + (i - xMean) * (ys[i] - yMean), 0);
    const denominator = rows.reduce((sum, _, i) => sum + (i - xMean) ** 2, 0);
    const slope = denominator === 0 ? 0 : numerator / denominator;
    // slope is $/bill. Annualize (×12).
    if (Math.abs(slope) >= 0.5) {
      const dir = slope > 0 ? "increased" : "decreased";
      const annualized = Math.abs(slope * 12).toFixed(0);
      insights.push({
        id: "cost-trend",
        severity: slope > 0 ? "warning" : "positive",
        text: `Your bills have ${dir} by roughly $${annualized}/year on trend over the ${n}-bill period.`,
      });
    } else {
      insights.push({
        id: "cost-trend",
        severity: "info",
        text: `Your total bill has been stable across the ${n}-bill period — no significant upward or downward trend.`,
      });
    }
  }

  // ── 4. PCA elevated for last 3 bills ──────────────────────────────────────
  // Use allRows for baseline to avoid false positives on short ranges.
  if (rows.length >= 3) {
    const allPcaRows = allRows.filter((r) => r.pca_pct !== null);
    const filteredPcaRows = rows.filter((r) => r.pca_pct !== null);
    if (allPcaRows.length >= 3 && filteredPcaRows.length >= 3) {
      const baseline = avg(allPcaRows.map((r) => r.pca_pct));
      const last3 = filteredPcaRows.slice(-3);
      if (last3.every((r) => r.pca_pct! > baseline)) {
        const recentAvg = avg(last3.map((r) => r.pca_pct));
        insights.push({
          id: "pca-trend",
          severity: "warning",
          text: `The Power Cost Adjustment has been above your historical average for the last 3 bills (${recentAvg.toFixed(1)}% vs ${baseline.toFixed(1)}% avg). This fluctuating pass-through fee is adding to your costs.`,
        });
      }
    }
  }

  // ── 5. Usage vs rate divergence (electric) ────────────────────────────────
  // Needs >= 6 rows with valid electric data.
  if (rows.length >= 6) {
    const validElec = rows.filter((r) => r.kwh > 0 && r.cost_per_kwh !== null);
    if (validElec.length >= 6) {
      const half = Math.floor(validElec.length / 2);
      const early = validElec.slice(0, half);
      const recent = validElec.slice(-half);
      const earlyKwh = avg(early.map((r) => r.kwh));
      const recentKwh = avg(recent.map((r) => r.kwh));
      const earlyRate = avg(early.map((r) => r.cost_per_kwh));
      const recentRate = avg(recent.map((r) => r.cost_per_kwh));
      const kwhChange = earlyKwh > 0 ? ((recentKwh - earlyKwh) / earlyKwh) * 100 : 0;
      const rateChange = earlyRate > 0 ? ((recentRate - earlyRate) / earlyRate) * 100 : 0;
      if (kwhChange < -5 && rateChange > 5) {
        insights.push({
          id: "usage-rate-divergence",
          severity: "info",
          text: `Electric usage has trended down ${Math.abs(kwhChange).toFixed(0)}% while your cost per kWh has gone up ${rateChange.toFixed(0)}% — a rate increase is offsetting your conservation efforts.`,
        });
      } else if (kwhChange > 10 && rateChange < 2) {
        insights.push({
          id: "usage-rate-divergence",
          severity: "warning",
          text: `Electric usage has risen ${kwhChange.toFixed(0)}% recently while rates have stayed flat — higher usage is driving costs up.`,
        });
      }
    }
  }

  // ── 6. Seasonal high-cost month (requires >= 24 bills / ~2 full years) ────
  if (allRows.length >= 24) {
    const byMonth: Record<number, number[]> = {};
    allRows.forEach((r) => {
      const mm = parseInt(r.bill_date.split("-")[0], 10);
      if (!byMonth[mm]) byMonth[mm] = [];
      byMonth[mm].push(r.total);
    });
    const monthAvgs = Object.entries(byMonth)
      .map(([mm, vals]) => ({ mm: parseInt(mm, 10), avg: avg(vals) }))
      .sort((a, b) => b.avg - a.avg);
    if (monthAvgs.length >= 3) {
      const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const top = monthAvgs[0];
      insights.push({
        id: "seasonal",
        severity: "info",
        text: `Based on your history, ${MONTHS[top.mm - 1]} tends to be your most expensive month (avg ${formatDollar(top.avg)}).`,
      });
    }
  }

  return insights;
}

// ---------------------------------------------------------------------------
// computeBillDecomposition
// ---------------------------------------------------------------------------

/**
 * Returns null if the change is within ±5% (not worth showing).
 */
export function computeBillDecomposition(
  latest: DashboardRow,
  prev: DashboardRow
): DecompositionResult | null {
  const totalDelta = latest.total - prev.total;
  if (prev.total === 0 || Math.abs(totalDelta / prev.total) < 0.05) return null;

  const hasElecData =
    latest.kwh > 0 &&
    prev.kwh > 0 &&
    latest.cost_per_kwh !== null &&
    prev.cost_per_kwh !== null;

  let usageContribution = 0;
  let rateContribution = 0;

  if (hasElecData) {
    const kwhDelta = latest.kwh - prev.kwh;
    const rateDelta = latest.cost_per_kwh! - prev.cost_per_kwh!;
    usageContribution = kwhDelta * prev.cost_per_kwh!;
    rateContribution = prev.kwh * rateDelta;
  }

  // Billing days contribution
  let daysContribution = 0;
  if (prev.days > 0 && latest.days > 0 && latest.days !== prev.days) {
    const prevCostPerDay = prev.total / prev.days;
    daysContribution = prevCostPerDay * (latest.days - prev.days);
  }

  const accounted = usageContribution + rateContribution + daysContribution;
  const residual = totalDelta - accounted;

  return {
    totalDelta,
    usageContribution,
    rateContribution,
    daysContribution,
    residual,
    hasElecData,
  };
}

// ---------------------------------------------------------------------------
// computeHeatmapData
// ---------------------------------------------------------------------------

export function computeHeatmapData(rows: DashboardRow[]): {
  cells: HeatmapCell[];
  years: number[];
  minTotal: number;
  maxTotal: number;
} {
  const cells: HeatmapCell[] = rows
    .filter((r) => r.bill_date)
    .map((r) => {
      const [mm, , yyyy] = r.bill_date.split("-");
      return {
        year: parseInt(yyyy, 10),
        month: parseInt(mm, 10),
        total: r.total,
        label: r.month,
      };
    });

  if (cells.length === 0) {
    return { cells: [], years: [], minTotal: 0, maxTotal: 0 };
  }

  const years = Array.from(new Set(cells.map((c) => c.year))).sort((a, b) => a - b);
  const totals = cells.map((c) => c.total);
  const minTotal = Math.min(...totals);
  const maxTotal = Math.max(...totals);

  return { cells, years, minTotal, maxTotal };
}
