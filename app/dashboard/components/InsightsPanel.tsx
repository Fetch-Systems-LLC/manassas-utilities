import { AlertTriangle, Info, Lightbulb, TrendingDown } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Insight, InsightSeverity } from "@/lib/analytics";

const SEVERITY_CONFIG: Record<
  InsightSeverity,
  { card: string; icon: string; Icon: React.ElementType }
> = {
  info: {
    card: "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/10",
    icon: "text-blue-600 dark:text-blue-400",
    Icon: Info,
  },
  positive: {
    card: "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/10",
    icon: "text-green-600 dark:text-green-400",
    Icon: TrendingDown,
  },
  warning: {
    card: "border-yellow-300 bg-yellow-50 dark:border-yellow-700 dark:bg-yellow-900/10",
    icon: "text-yellow-600 dark:text-yellow-400",
    Icon: AlertTriangle,
  },
};

interface InsightsPanelProps {
  insights: Insight[];
}

export function InsightsPanel({ insights }: InsightsPanelProps) {
  if (insights.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Lightbulb className="h-4 w-4" />
          Insights
        </CardTitle>
        <CardDescription>Auto-detected patterns in your bill history</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {insights.map((insight) => {
          const { card, icon, Icon } = SEVERITY_CONFIG[insight.severity];
          return (
            <div
              key={insight.id}
              className={`flex items-start gap-3 rounded-lg border p-3 ${card}`}
            >
              <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${icon}`} />
              <p className="text-sm leading-relaxed">{insight.text}</p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
