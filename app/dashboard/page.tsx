"use client";

import { useEffect, useMemo, useState } from "react";
import { Nav } from "@/components/Nav";
import { getAllBills } from "@/lib/db";
import { StoredBill } from "@/lib/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { AlertTriangle, TrendingUp, TrendingDown, Minus, Upload, X } from "lucide-react";
import Link from "next/link";
import { InsightsPanel } from "./components/InsightsPanel";
import { BillDecomposition } from "./components/BillDecomposition";
import { SpendingHeatmap } from "./components/SpendingHeatmap";
import {
  computeInsights,
  computeBillDecomposition,
  computeHeatmapData,
  type DashboardRow,
} from "@/lib/analytics";
import { formatDollar } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SERVICE_COLORS = {
  electric:   "#eab308",
  water:      "#3b82f6",
  sewer:      "#14b8a6",
  refuse:     "#f97316",
  stormwater: "#64748b",
};

const SERVICE_KEYS = ["electric", "water", "sewer", "refuse", "stormwater"] as const;
type ServiceKey = typeof SERVICE_KEYS[number];

type RangeOption = 3 | 6 | 12 | null | "custom";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Bill dates MM-DD-YYYY → YYYY-MM-DD (for HTML date input comparison) */
function billDateToISO(dateStr: string): string {
  const [mm, dd, yyyy] = dateStr.split("-");
  return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}

/** Bill dates are MM-DD-YYYY → "Jan '26" */
function formatMonth(dateStr: string | null) {
  if (!dateStr) return "?";
  const [mm, , yyyy] = dateStr.split("-");
  return new Date(Number(yyyy), Number(mm) - 1).toLocaleDateString("en-US", {
    month: "short",
    year: "2-digit",
  });
}

function safePct(a: number, b: number): number | null {
  return b === 0 ? null : ((a - b) / b) * 100;
}

function avg(nums: (number | null | undefined)[]) {
  const valid = nums.filter((n): n is number => n != null && !isNaN(n));
  return valid.length === 0 ? 0 : valid.reduce((a, b) => a + b, 0) / valid.length;
}

// Recharts passes `unknown` through formatters — guard it.
const dollarFmt = (v: unknown) =>
  typeof v === "number" ? formatDollar(v) : String(v ?? "");

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TrendBadge({ pct }: { pct: number | null }) {
  if (pct === null) return <Badge variant="outline">N/A</Badge>;
  if (Math.abs(pct) < 3)
    return (
      <Badge variant="secondary">
        <Minus className="h-3 w-3 mr-1" />Flat
      </Badge>
    );
  if (pct > 0)
    return (
      <Badge variant="destructive">
        <TrendingUp className="h-3 w-3 mr-1" />+{pct.toFixed(1)}%
      </Badge>
    );
  return (
    <Badge className="bg-green-600 hover:bg-green-700">
      <TrendingDown className="h-3 w-3 mr-1" />{pct.toFixed(1)}%
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const [bills, setBills]           = useState<StoredBill[]>([]);
  const [loading, setLoading]       = useState(true);
  const [range, setRange]           = useState<RangeOption>(null);
  const [customStart, setCustomStart] = useState<string>("");
  const [customEnd, setCustomEnd]     = useState<string>("");
  const [stacked, setStacked]       = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [yoyYearA, setYoyYearA]     = useState<number | null>(null);
  const [yoyYearB, setYoyYearB]     = useState<number | null>(null);

  useEffect(() => {
    getAllBills().then((b) => { setBills(b); setLoading(false); });
  }, []);

  // ── Derived chart data ────────────────────────────────────────────────────

  const allData = useMemo(
    () =>
      bills.map((s) => ({
        month:          formatMonth(s.bill.meta.bill_date),
        bill_date:      s.bill.meta.bill_date ?? "",
        electric:       s.bill.electric.total ?? 0,
        water:          s.bill.water.total ?? 0,
        sewer:          s.bill.sewer.total ?? 0,
        refuse:         s.bill.refuse.total ?? 0,
        stormwater:     s.bill.stormwater.total ?? 0,
        total:          s.bill.summary.grand_total ?? s.bill.summary.current_charges ?? 0,
        kwh:            s.bill.electric.usage_kwh ?? 0,
        water_usage:    s.bill.water.usage ?? 0,
        power_cost_adj: s.bill.electric.power_cost_adj ?? 0,
        days:           s.bill.electric.days ?? 30,
      })),
    [bills]
  );

  const data = useMemo(() => {
    if (range === "custom") {
      return allData.filter((d) => {
        if (!d.bill_date) return false;
        const iso = billDateToISO(d.bill_date);
        if (customStart && iso < customStart) return false;
        if (customEnd && iso > customEnd) return false;
        return true;
      });
    }
    return range ? allData.slice(-range) : allData;
  }, [allData, range, customStart, customEnd]);

  const effData = useMemo(
    () =>
      data.map((d) => ({
        ...d,
        cost_per_kwh:   d.kwh > 0          ? +(d.electric / d.kwh).toFixed(4)           : null,
        cost_per_water: d.water_usage > 0  ? +(d.water / d.water_usage).toFixed(2)       : null,
        pca_pct:        d.electric > 0     ? +((d.power_cost_adj / d.electric) * 100).toFixed(1) : null,
        cost_per_day:   d.days > 0         ? +(d.total / d.days).toFixed(2)              : null,
      })),
    [data]
  );

  // All-history efficiency rows (not range-filtered) — used for analytics baselines
  const allEffData = useMemo<DashboardRow[]>(
    () =>
      allData.map((d) => ({
        ...d,
        cost_per_kwh:   d.kwh > 0         ? +(d.electric / d.kwh).toFixed(4)                    : null,
        cost_per_water: d.water_usage > 0 ? +(d.water / d.water_usage).toFixed(2)               : null,
        pca_pct:        d.electric > 0    ? +((d.power_cost_adj / d.electric) * 100).toFixed(1) : null,
        cost_per_day:   d.days > 0        ? +(d.total / d.days).toFixed(2)                       : null,
      })),
    [allData]
  );

  // ── Analytics computations ─────────────────────────────────────────────────
  const insights = useMemo(
    () => computeInsights(effData as DashboardRow[], allEffData),
    [effData, allEffData]
  );

  const decomposition = useMemo(() => {
    const last = effData[effData.length - 1];
    const prev = effData[effData.length - 2];
    if (!last || !prev) return null;
    return computeBillDecomposition(last as DashboardRow, prev as DashboardRow);
  }, [effData]);

  const heatmapData = useMemo(
    () => computeHeatmapData(allEffData),
    [allEffData]
  );

  const periodTotals = useMemo(
    () =>
      SERVICE_KEYS.reduce(
        (acc, k) => ({ ...acc, [k]: data.reduce((s, d) => s + d[k], 0) }),
        {} as Record<ServiceKey, number>
      ),
    [data]
  );

  // ── Summary stats ─────────────────────────────────────────────────────────

  const totals     = data.map((d) => d.total);
  const avgTotal   = avg(totals);
  const totalSpent = totals.reduce((a, b) => a + b, 0);
  const latest     = data[data.length - 1];
  const prev       = data[data.length - 2] ?? null;
  const momPct     = prev ? safePct(latest?.total ?? 0, prev.total) : null;
  const spikes     = data.filter((d) => d.total > avgTotal * 1.15);
  const bestMonth  = data.length ? data.reduce((a, b) => (a.total < b.total ? a : b)) : null;
  const worstMonth = data.length ? data.reduce((a, b) => (a.total > b.total ? a : b)) : null;

  const serviceAvgs = SERVICE_KEYS.map((k) => ({
    key:   k,
    name:  k.charAt(0).toUpperCase() + k.slice(1),
    color: SERVICE_COLORS[k],
    value: avg(data.map((d) => d[k])),
  })).filter((s) => s.value > 0);

  // ── YoY ──────────────────────────────────────────────────────────────────

  const allYears = useMemo(() => {
    const years = new Set<number>();
    bills.forEach((b) => {
      const yyyy = b.bill.meta.bill_date?.split("-")[2];
      if (yyyy) years.add(Number(yyyy));
    });
    return Array.from(years).sort((a, b) => b - a); // descending
  }, [bills]);

  // Default to the two most recent years whenever bills load
  const effectiveYearA = yoyYearA ?? allYears[0] ?? null;
  const effectiveYearB = yoyYearB ?? allYears[1] ?? null;

  const yoyData = useMemo(() => {
    if (!effectiveYearA || !effectiveYearB) return [];
    const map: Record<string, { month: string; yearA?: number; yearB?: number }> = {};
    bills.forEach((s) => {
      const date = s.bill.meta.bill_date;
      if (!date) return;
      const [mm, , yyyy] = date.split("-");
      const year = Number(yyyy);
      if (year !== effectiveYearA && year !== effectiveYearB) return;
      const label = new Date(2000, Number(mm) - 1).toLocaleDateString("en-US", { month: "short" });
      if (!map[mm]) map[mm] = { month: label };
      const total = s.bill.summary.grand_total ?? s.bill.summary.current_charges ?? 0;
      if (year === effectiveYearA) map[mm].yearA = total;
      if (year === effectiveYearB) map[mm].yearB = total;
    });
    // Sort by calendar month so Jan → Dec always left to right
    return Object.entries(map)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([, v]) => v)
      .filter((d) => d.yearA != null || d.yearB != null);
  }, [bills, effectiveYearA, effectiveYearB]);

  // ── Selected bill detail ──────────────────────────────────────────────────

  const selectedBill = useMemo(
    () => (selectedDate ? bills.find((b) => b.bill.meta.bill_date === selectedDate) ?? null : null),
    [bills, selectedDate]
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleChartClick = (d: any) => {
    const date = d?.activePayload?.[0]?.payload?.bill_date as string | undefined;
    if (!date) return;
    setSelectedDate((prev) => (prev === date ? null : date));
  };

  // ── Guards ────────────────────────────────────────────────────────────────

  if (loading)
    return (
      <>
        <Nav />
        <main className="mx-auto max-w-5xl px-4 py-16 text-center text-muted-foreground">
          Loading…
        </main>
      </>
    );

  if (bills.length === 0)
    return (
      <>
        <Nav />
        <main className="mx-auto max-w-5xl px-4 py-16 text-center space-y-4">
          <p className="text-muted-foreground text-lg">
            No bills yet — upload at least one to see your dashboard.
          </p>
          <Button asChild>
            <Link href="/">
              <Upload className="mr-2 h-4 w-4" />Upload a Bill
            </Link>
          </Button>
        </main>
      </>
    );

  if (!latest) return null;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-5xl px-4 py-10 space-y-8">

        {/* Header */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold">Dashboard</h1>
              <p className="text-muted-foreground text-sm mt-1 flex items-center gap-2 flex-wrap">
                <span>{bills.length} bill{bills.length !== 1 ? "s" : ""} analyzed</span>
                <span className="opacity-40">·</span>
                <span>
                  Latest:{" "}
                  <span className="font-medium text-foreground font-mono">{formatDollar(latest.total)}</span>
                  {" "}in {latest.month}
                </span>
                <TrendBadge pct={momPct} />
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {([3, 6, 12, null] as RangeOption[]).map((r) => (
                <Button
                  key={String(r)}
                  variant={range === r ? "default" : "outline"}
                  size="sm"
                  onClick={() => setRange(r)}
                >
                  {r === null ? "All time" : `Last ${r} mo`}
                </Button>
              ))}
              <Button
                variant={range === "custom" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setRange("custom");
                  if (!customStart && allData.length > 0) {
                    setCustomStart(billDateToISO(allData[0].bill_date));
                    setCustomEnd(billDateToISO(allData[allData.length - 1].bill_date));
                  }
                }}
              >
                Custom
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/">
                  <Upload className="mr-2 h-4 w-4" />Add Bill
                </Link>
              </Button>
            </div>
          </div>

          {/* Custom date range inputs */}
          {range === "custom" && (
            <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg border bg-muted/40">
              <span className="text-sm text-muted-foreground">From</span>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="border rounded-md px-2 py-1 bg-background text-foreground text-sm"
              />
              <span className="text-sm text-muted-foreground">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="border rounded-md px-2 py-1 bg-background text-foreground text-sm"
              />
              {data.length === 0 && (
                <span className="text-sm text-muted-foreground">No bills in this range</span>
              )}
            </div>
          )}
        </div>

        {/* ── CHARTS — lead with interaction ──────────────────────────── */}
        <Tabs defaultValue="total">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="total">Total Cost</TabsTrigger>
            <TabsTrigger value="breakdown">By Service</TabsTrigger>
            <TabsTrigger value="usage">Usage</TabsTrigger>
            <TabsTrigger value="efficiency">Efficiency</TabsTrigger>
            <TabsTrigger value="yoy">Year over Year</TabsTrigger>
            <TabsTrigger value="patterns">Patterns</TabsTrigger>
          </TabsList>

          {/* ── Total Cost ─────────────────────────────────────────────── */}
          <TabsContent value="total" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Total Bill Over Time</CardTitle>
                  <CardDescription>Click any point to inspect that bill</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart
                      data={data}
                      margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                      onClick={handleChartClick}
                      style={{ cursor: "pointer" }}
                    >
                      <defs>
                        <linearGradient id="totalGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis tickFormatter={(v) => `$${v}`} tick={{ fontSize: 12 }} width={60} />
                      <Tooltip formatter={dollarFmt} />
                      <ReferenceLine
                        y={avgTotal}
                        stroke="#94a3b8"
                        strokeDasharray="4 4"
                        label={{ value: "avg", position: "right", fontSize: 11 }}
                      />
                      <Area
                        type="monotone"
                        dataKey="total"
                        stroke="#6366f1"
                        fill="url(#totalGrad)"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                        name="Total"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Composition donut */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Avg Composition</CardTitle>
                  <CardDescription>Where your money goes</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center gap-3">
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie
                        data={serviceAvgs}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={70}
                        dataKey="value"
                        paddingAngle={2}
                      >
                        {serviceAvgs.map((s, i) => (
                          <Cell key={i} fill={s.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={dollarFmt} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-1.5 w-full">
                    {serviceAvgs.map((s) => (
                      <div key={s.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ background: s.color }}
                          />
                          {s.name}
                        </div>
                        <span className="font-mono font-medium">{formatDollar(s.value)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── By Service ─────────────────────────────────────────────── */}
          <TabsContent value="breakdown" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-start justify-between">
                <div>
                  <CardTitle>Cost by Service</CardTitle>
                  <CardDescription>See which services are driving changes</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => setStacked((p) => !p)}>
                  {stacked ? "Show Grouped" : "Show Stacked"}
                </Button>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart
                    data={data}
                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                    onClick={handleChartClick}
                    style={{ cursor: "pointer" }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={(v) => `$${v}`} tick={{ fontSize: 12 }} width={60} />
                    <Tooltip formatter={dollarFmt} />
                    <Legend />
                    {SERVICE_KEYS.map((key, idx, arr) => (
                      <Bar
                        key={key}
                        dataKey={key}
                        {...(stacked ? { stackId: "a" } : {})}
                        fill={SERVICE_COLORS[key]}
                        name={key.charAt(0).toUpperCase() + key.slice(1)}
                        radius={!stacked || idx === arr.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Period totals table */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Period Totals</CardTitle>
                <CardDescription>
                  {data.length} bill{data.length !== 1 ? "s" : ""} in selected range
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="divide-y text-sm">
                  {serviceAvgs.map((s) => (
                    <div key={s.name} className="flex items-center justify-between py-2.5">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0"
                          style={{ background: s.color }}
                        />
                        {s.name}
                      </div>
                      <div className="flex gap-8 text-right">
                        <div>
                          <p className="text-muted-foreground text-xs">Avg / bill</p>
                          <p className="font-mono font-medium">{formatDollar(s.value)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">Period total</p>
                          <p className="font-mono font-medium">
                            {formatDollar(periodTotals[s.key as ServiceKey])}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-between py-2.5 font-semibold">
                    <span>All services</span>
                    <div className="flex gap-8 text-right">
                      <div>
                        <p className="text-muted-foreground text-xs font-normal">Avg / bill</p>
                        <p className="font-mono">{formatDollar(avgTotal)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs font-normal">Period total</p>
                        <p className="font-mono">{formatDollar(totalSpent)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Usage ──────────────────────────────────────────────────── */}
          <TabsContent value="usage" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Electric Usage (kWh)</CardTitle>
                  <CardDescription>Usage vs. cost — divergence signals a rate change</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart
                      data={data}
                      margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                      onClick={handleChartClick}
                      style={{ cursor: "pointer" }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <ReferenceLine y={avg(data.map((d) => d.kwh))} stroke="#94a3b8" strokeDasharray="4 4" />
                      <Line type="monotone" dataKey="kwh" stroke={SERVICE_COLORS.electric} strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} name="kWh" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Water Usage (units)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart
                      data={data}
                      margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                      onClick={handleChartClick}
                      style={{ cursor: "pointer" }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <ReferenceLine y={avg(data.map((d) => d.water_usage))} stroke="#94a3b8" strokeDasharray="4 4" />
                      <Line type="monotone" dataKey="water_usage" stroke={SERVICE_COLORS.water} strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} name="Units" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Power Cost Adjustment</CardTitle>
                  <CardDescription>
                    This fluctuating pass-through fee often causes unexpected increases
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={(v) => `$${v}`} tick={{ fontSize: 11 }} width={55} />
                      <Tooltip formatter={dollarFmt} />
                      <Bar dataKey="power_cost_adj" fill="#a855f7" name="Power Cost Adj" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── Efficiency ─────────────────────────────────────────────── */}
          <TabsContent value="efficiency" className="mt-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Efficiency metrics separate <em>how much you used</em> from{" "}
              <em>what it cost per unit</em>. A rising cost-per-unit with flat usage is a
              rate hike — not a behavior change.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Cost per kWh</CardTitle>
                  <CardDescription>Electric total ÷ kWh consumed</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart
                      data={effData}
                      margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                      onClick={handleChartClick}
                      style={{ cursor: "pointer" }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={(v) => `$${v}`} tick={{ fontSize: 11 }} width={55} />
                      <Tooltip formatter={(v) => typeof v === "number" ? `$${v.toFixed(4)}/kWh` : v} />
                      <ReferenceLine y={avg(effData.map((d) => d.cost_per_kwh))} stroke="#94a3b8" strokeDasharray="4 4" />
                      <Line type="monotone" dataKey="cost_per_kwh" stroke={SERVICE_COLORS.electric} strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} name="$/kWh" connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Cost per Water Unit</CardTitle>
                  <CardDescription>Water total ÷ units consumed</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart
                      data={effData}
                      margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                      onClick={handleChartClick}
                      style={{ cursor: "pointer" }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={(v) => `$${v}`} tick={{ fontSize: 11 }} width={55} />
                      <Tooltip formatter={(v) => typeof v === "number" ? `$${v.toFixed(2)}/unit` : v} />
                      <ReferenceLine y={avg(effData.map((d) => d.cost_per_water))} stroke="#94a3b8" strokeDasharray="4 4" />
                      <Line type="monotone" dataKey="cost_per_water" stroke={SERVICE_COLORS.water} strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} name="$/unit" connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Power Cost Adj — % of Electric Bill</CardTitle>
                  <CardDescription>High % months often correlate with peak grid demand</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={effData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} width={45} />
                      <Tooltip formatter={(v) => typeof v === "number" ? `${v.toFixed(1)}%` : v} />
                      <Bar dataKey="pca_pct" fill="#a855f7" name="PCA %" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Daily Cost</CardTitle>
                  <CardDescription>Total ÷ billing days — normalizes for period length</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart
                      data={effData}
                      margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                      onClick={handleChartClick}
                      style={{ cursor: "pointer" }}
                    >
                      <defs>
                        <linearGradient id="dayGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={(v) => `$${v}`} tick={{ fontSize: 11 }} width={50} />
                      <Tooltip formatter={(v) => typeof v === "number" ? `$${v.toFixed(2)}/day` : v} />
                      <Area type="monotone" dataKey="cost_per_day" stroke="#6366f1" fill="url(#dayGrad)" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} name="$/day" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── Year over Year ─────────────────────────────────────────── */}
          <TabsContent value="yoy" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-start justify-between flex-wrap gap-3">
                <div>
                  <CardTitle>Year over Year Comparison</CardTitle>
                  <CardDescription>Same calendar month across any two years</CardDescription>
                </div>
                {allYears.length >= 2 && (
                  <div className="flex items-center gap-2 text-sm flex-wrap">
                    <select
                      value={effectiveYearA ?? ""}
                      onChange={(e) => setYoyYearA(Number(e.target.value))}
                      className="border rounded-md px-2 py-1 bg-background text-foreground text-sm"
                    >
                      {allYears.map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                    <span className="text-muted-foreground">vs</span>
                    <select
                      value={effectiveYearB ?? ""}
                      onChange={(e) => setYoyYearB(Number(e.target.value))}
                      className="border rounded-md px-2 py-1 bg-background text-foreground text-sm"
                    >
                      {allYears.map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                {allYears.length < 2 ? (
                  <p className="text-muted-foreground text-sm py-8 text-center">
                    Need bills from at least 2 different years to show this comparison.
                  </p>
                ) : yoyData.length === 0 ? (
                  <p className="text-muted-foreground text-sm py-8 text-center">
                    No bills found for either selected year.
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={yoyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis tickFormatter={(v) => `$${v}`} tick={{ fontSize: 12 }} width={60} />
                      <Tooltip formatter={dollarFmt} />
                      <Legend />
                      <Bar dataKey="yearA" fill="#6366f1" name={String(effectiveYearA)} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="yearB" fill="#94a3b8" name={String(effectiveYearB)} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          {/* ── Patterns ───────────────────────────────────────────────── */}
          <TabsContent value="patterns" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Spending Heat Map</CardTitle>
                <CardDescription>
                  Color intensity shows bill amount — blue is lower, red is higher. Reveals
                  seasonal patterns at a glance.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SpendingHeatmap
                  cells={heatmapData.cells}
                  years={heatmapData.years}
                  minTotal={heatmapData.minTotal}
                  maxTotal={heatmapData.maxTotal}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Bill detail panel — appears when a chart point is clicked */}
        {selectedBill && (
          <Card className="border-indigo-300 dark:border-indigo-700">
            <CardHeader className="flex flex-row items-start justify-between pb-3">
              <div>
                <CardTitle>
                  Bill Detail — {formatMonth(selectedBill.bill.meta.bill_date)}
                </CardTitle>
                <CardDescription>
                  Due {selectedBill.bill.meta.due_date ?? "N/A"}
                  {selectedBill.bill.meta.service_address
                    ? ` · ${selectedBill.bill.meta.service_address}`
                    : ""}
                </CardDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSelectedDate(null)}>
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {[
                  { label: "Electric",    value: selectedBill.bill.electric.total,   color: SERVICE_COLORS.electric,   sub: selectedBill.bill.electric.usage_kwh != null ? `${selectedBill.bill.electric.usage_kwh} kWh` : undefined },
                  { label: "Water",       value: selectedBill.bill.water.total,      color: SERVICE_COLORS.water,      sub: selectedBill.bill.water.usage != null ? `${selectedBill.bill.water.usage} units` : undefined },
                  { label: "Sewer",       value: selectedBill.bill.sewer.total,      color: SERVICE_COLORS.sewer,      sub: undefined },
                  { label: "Refuse",      value: selectedBill.bill.refuse.total,     color: SERVICE_COLORS.refuse,     sub: undefined },
                  { label: "Stormwater",  value: selectedBill.bill.stormwater.total, color: SERVICE_COLORS.stormwater, sub: undefined },
                ].map(({ label, value, color, sub }) => (
                  <div key={label} className="border-l-4 pl-3 py-1 space-y-0.5" style={{ borderLeftColor: color }}>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-xl font-bold font-mono">
                      {value != null ? formatDollar(value) : "—"}
                    </p>
                    {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t text-sm">
                <div className="flex flex-wrap gap-4 text-muted-foreground">
                  <span>
                    Power Cost Adj:{" "}
                    <span className="font-mono font-medium text-foreground">
                      {selectedBill.bill.electric.power_cost_adj != null
                        ? formatDollar(selectedBill.bill.electric.power_cost_adj)
                        : "—"}
                    </span>
                  </span>
                  {selectedBill.bill.electric.days != null && (
                    <span>{selectedBill.bill.electric.days} billing days</span>
                  )}
                  {selectedBill.bill.electric.days != null && (
                    <span>
                      ≈{" "}
                      <span className="font-mono font-medium text-foreground">
                        {formatDollar(
                          (selectedBill.bill.summary.grand_total ??
                            selectedBill.bill.summary.current_charges ??
                            0) / selectedBill.bill.electric.days
                        )}
                        /day
                      </span>
                    </span>
                  )}
                </div>
                <p className="text-xl font-bold font-mono">
                  Total:{" "}
                  {formatDollar(
                    selectedBill.bill.summary.grand_total ??
                      selectedBill.bill.summary.current_charges ??
                      0
                  )}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── BY THE NUMBERS ───────────────────────────────────────────── */}
        <div className="flex items-center gap-4 pt-2">
          <div className="flex-1 border-t" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">By the numbers</span>
          <div className="flex-1 border-t" />
        </div>

        {/* KPI row 1 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {[
            { label: "Latest Bill",    value: formatDollar(latest.total),                                                   sub: latest.month,                            badge: null },
            { label: "Month over Month", value: momPct != null ? `${momPct > 0 ? "+" : ""}${momPct.toFixed(1)}%` : "N/A", sub: "vs prior bill",                         badge: <TrendBadge pct={momPct} /> },
            { label: "Period Average", value: formatDollar(avgTotal),                                                        sub: `${data.length} bills`,                  badge: null },
            { label: "Total Spent",    value: `$${totalSpent.toFixed(0)}`,                                                  sub: range === "custom" ? "custom range" : range ? `last ${range} mo` : "all time", badge: null },
            { label: "High Months",    value: String(spikes.length),                                                         sub: ">15% above avg",                        badge: null },
          ].map(({ label, value, sub, badge }) => (
            <Card key={label}>
              <CardHeader className="pb-1 pt-4 px-4">
                <CardDescription className="text-xs">{label}</CardDescription>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-2xl font-bold font-mono">{value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
                {badge && <div className="mt-2">{badge}</div>}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* KPI row 2 — per-service averages */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {serviceAvgs.map((s) => (
            <Card key={s.name} className="border-l-4" style={{ borderLeftColor: s.color }}>
              <CardContent className="px-3 py-3">
                <p className="text-xs text-muted-foreground">{s.name} avg</p>
                <p className="text-lg font-bold font-mono">{formatDollar(s.value)}</p>
                <p className="text-xs text-muted-foreground">
                  {avgTotal > 0 ? ((s.value / avgTotal) * 100).toFixed(0) : 0}% of bill
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── INSIGHTS ─────────────────────────────────────────────────── */}
        {(insights.length > 0 || latest.total > avgTotal * 1.15 || decomposition) && (
          <div className="flex items-center gap-4 pt-2">
            <div className="flex-1 border-t" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Insights</span>
            <div className="flex-1 border-t" />
          </div>
        )}

        <InsightsPanel insights={insights} />

        {/* Spike alert */}
        {latest.total > avgTotal * 1.15 && (
          <Card className="border-yellow-400/50 bg-yellow-50 dark:bg-yellow-900/10">
            <CardContent className="flex items-center gap-3 py-4">
              <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0" />
              <p className="text-sm">
                Your latest bill ({formatDollar(latest.total)}) is{" "}
                <strong>{((latest.total / avgTotal - 1) * 100).toFixed(0)}% above</strong>{" "}
                your {range === "custom" ? "range" : range ? `${range}-month` : ""} average. Electric accounts for{" "}
                <strong>{formatDollar(latest.electric)}</strong>.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Bill change decomposition */}
        {decomposition && prev && (
          <BillDecomposition
            result={decomposition}
            latestMonth={latest.month}
            prevMonth={prev.month}
          />
        )}

        {/* ── HIGHLIGHTS ───────────────────────────────────────────────── */}
        {data.length >= 3 && bestMonth && worstMonth && (
          <>
            <div className="flex items-center gap-4 pt-2">
              <div className="flex-1 border-t" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Highlights</span>
              <div className="flex-1 border-t" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Card className="border-green-300 bg-green-50 dark:bg-green-900/10">
                <CardContent className="py-3 px-4">
                  <p className="text-xs text-muted-foreground mb-1">Lowest bill</p>
                  <p className="font-bold text-green-700 dark:text-green-400 font-mono text-lg">
                    {formatDollar(bestMonth.total)}
                  </p>
                  <p className="text-xs text-muted-foreground">{bestMonth.month}</p>
                </CardContent>
              </Card>
              <Card className="border-red-300 bg-red-50 dark:bg-red-900/10">
                <CardContent className="py-3 px-4">
                  <p className="text-xs text-muted-foreground mb-1">Highest bill</p>
                  <p className="font-bold text-red-700 dark:text-red-400 font-mono text-lg">
                    {formatDollar(worstMonth.total)}
                  </p>
                  <p className="text-xs text-muted-foreground">{worstMonth.month}</p>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </main>
    </>
  );
}
