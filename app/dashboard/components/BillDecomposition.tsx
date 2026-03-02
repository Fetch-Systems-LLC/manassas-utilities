import { Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { DecompositionResult } from "@/lib/analytics";

function signedDollar(v: number): string {
  const abs = Math.abs(v).toFixed(2);
  return v >= 0 ? `+$${abs}` : `-$${abs}`;
}

interface DecompositionRowProps {
  label: string;
  value: number;
  maxAbs: number;
}

function DecompositionRow({ label, value, maxAbs }: DecompositionRowProps) {
  if (Math.abs(value) < 0.01) return null;
  const widthPct = maxAbs > 0 ? Math.min(100, (Math.abs(value) / maxAbs) * 100) : 0;
  const isPositive = value > 0;
  return (
    <div className="flex items-center gap-3">
      <div className="w-36 text-xs text-muted-foreground text-right shrink-0">{label}</div>
      <div className="flex-1 bg-muted rounded-full h-2 relative">
        <div
          className={`absolute top-0 h-2 rounded-full ${isPositive ? "bg-red-400" : "bg-green-400"}`}
          style={{ width: `${widthPct}%` }}
        />
      </div>
      <div
        className={`w-20 text-xs font-mono text-right shrink-0 ${isPositive ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}
      >
        {signedDollar(value)}
      </div>
    </div>
  );
}

interface BillDecompositionProps {
  result: DecompositionResult;
  latestMonth: string;
  prevMonth: string;
}

export function BillDecomposition({ result, latestMonth, prevMonth }: BillDecompositionProps) {
  const { totalDelta, usageContribution, rateContribution, daysContribution, residual, hasElecData } = result;
  const dir = totalDelta > 0 ? "up" : "down";
  const abs = Math.abs(totalDelta).toFixed(2);

  const contributions = [
    ...(hasElecData
      ? [
          { label: "Electric usage", value: usageContribution },
          { label: "Electric rate", value: rateContribution },
        ]
      : []),
    { label: "Billing days", value: daysContribution },
    ...(Math.abs(residual) >= 1 ? [{ label: "Other services", value: residual }] : []),
  ];

  const maxAbs = Math.max(...contributions.map((c) => Math.abs(c.value)));

  return (
    <Card className="border-indigo-200 border-dashed dark:border-indigo-800">
      <CardHeader className="pb-2 pt-4">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Zap className="h-4 w-4 text-indigo-500" />
          Why did your bill go {dir}?
        </CardTitle>
        <CardDescription>
          {prevMonth} → {latestMonth}: ${abs} {dir}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 pb-4">
        {contributions.length > 0 ? (
          <div className="space-y-2 pt-1">
            {contributions.map((c) => (
              <DecompositionRow key={c.label} label={c.label} value={c.value} maxAbs={maxAbs} />
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Not enough usage data to break down the change by category.
          </p>
        )}
        {!hasElecData && (
          <p className="text-xs text-muted-foreground pt-1">
            Upload bills with electric usage (kWh) for a full breakdown.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
