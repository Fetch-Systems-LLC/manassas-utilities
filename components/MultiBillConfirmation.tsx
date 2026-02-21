"use client";

import { useEffect, useState } from "react";
import { ParseResult, ParsedBill } from "@/lib/types";
import { getBill } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, RefreshCw, AlertTriangle, XCircle } from "lucide-react";

interface RowState {
  result: ParseResult;
  isDuplicate: boolean;
  selected: boolean;
}

interface Props {
  results: ParseResult[];
  onSave: (bills: ParsedBill[]) => void;
  onDiscard: () => void;
}

const fmt = (n: number | null | undefined) =>
  n != null ? `$${n.toFixed(2)}` : "—";

const buildId = (bill: ParsedBill) =>
  `${bill.meta.bill_date ?? "unknown"}-${bill.meta.account_number ?? "unknown"}`;

export function MultiBillConfirmation({ results, onSave, onDiscard }: Props) {
  const [rows, setRows] = useState<RowState[]>([]);
  const [checking, setChecking] = useState(true);

  // Check every valid bill against IndexedDB for duplicates
  useEffect(() => {
    async function check() {
      const checked = await Promise.all(
        results.map(async (result) => {
          if (!result.bill) return { result, isDuplicate: false, selected: false };
          const existing = await getBill(buildId(result.bill));
          return { result, isDuplicate: !!existing, selected: !existing };
        })
      );
      setRows(checked);
      setChecking(false);
    }
    check();
  }, [results]);

  const toggle = (i: number) =>
    setRows((prev) =>
      prev.map((r, idx) => (idx === i ? { ...r, selected: !r.selected } : r))
    );

  const allSelectable = rows.filter((r) => r.result.bill !== null);
  const allSelected = allSelectable.every((r) => r.selected);
  const toggleAll = () => {
    const next = !allSelected;
    setRows((prev) =>
      prev.map((r) => (r.result.bill ? { ...r, selected: next } : r))
    );
  };

  const selectedBills = rows
    .filter((r) => r.selected && r.result.bill)
    .map((r) => r.result.bill as ParsedBill);

  const errorCount = results.filter((r) => r.error).length;
  const dupCount = rows.filter((r) => r.isDuplicate && r.result.bill).length;

  if (checking) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground text-sm">
          Checking for duplicates…
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* Summary header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>
                {results.length} Bill{results.length !== 1 ? "s" : ""} Parsed
              </CardTitle>
              <CardDescription className="mt-1 flex flex-wrap gap-2">
                <span>{allSelectable.length} ready to save</span>
                {dupCount > 0 && (
                  <Badge variant="outline" className="text-yellow-700 border-yellow-400">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    {dupCount} duplicate{dupCount !== 1 ? "s" : ""}
                  </Badge>
                )}
                {errorCount > 0 && (
                  <Badge variant="outline" className="text-destructive border-destructive/50">
                    <XCircle className="h-3 w-3 mr-1" />
                    {errorCount} failed
                  </Badge>
                )}
              </CardDescription>
            </div>
            {allSelectable.length > 1 && (
              <Button variant="ghost" size="sm" onClick={toggleAll}>
                {allSelected ? "Deselect all" : "Select all"}
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Bill rows */}
      <div className="rounded-lg border divide-y overflow-hidden">
        {rows.map((row, i) => {
          const { result, isDuplicate, selected } = row;
          const { bill, error, filename } = result;

          if (error) {
            return (
              <div key={i} className="flex items-center gap-3 px-4 py-3 bg-destructive/5">
                <XCircle className="h-5 w-5 text-destructive shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{filename}</p>
                  <p className="text-xs text-destructive mt-0.5">{error}</p>
                </div>
                <Badge variant="destructive">Error</Badge>
              </div>
            );
          }

          if (!bill) return null;

          const total = bill.summary.grand_total ?? bill.summary.current_charges;

          return (
            <div
              key={i}
              className={cn(
                "flex items-center gap-3 px-4 py-3 transition-colors",
                selected ? "bg-background" : "bg-muted/30",
                isDuplicate && selected && "bg-yellow-50 dark:bg-yellow-900/10"
              )}
            >
              <Checkbox
                checked={selected}
                onCheckedChange={() => toggle(i)}
                aria-label={`Select ${filename}`}
              />

              <div className="flex-1 min-w-0 grid grid-cols-2 sm:grid-cols-5 gap-x-4 gap-y-0.5 items-center">
                {/* Filename + date */}
                <div className="col-span-2 sm:col-span-1 min-w-0">
                  <p className="text-sm font-medium truncate">{filename}</p>
                  <p className="text-xs text-muted-foreground">{bill.meta.bill_date ?? "—"}</p>
                </div>

                {/* Service totals */}
                <div className="text-sm text-right sm:text-left">
                  <span className="text-xs text-muted-foreground block">Electric</span>
                  <span className="font-mono">{fmt(bill.electric.total)}</span>
                </div>
                <div className="text-sm text-right sm:text-left">
                  <span className="text-xs text-muted-foreground block">Water/Sewer</span>
                  <span className="font-mono">
                    {fmt((bill.water.total ?? 0) + (bill.sewer.total ?? 0))}
                  </span>
                </div>
                <div className="text-sm text-right sm:text-left">
                  <span className="text-xs text-muted-foreground block">Other</span>
                  <span className="font-mono">
                    {fmt((bill.refuse.total ?? 0) + (bill.stormwater.total ?? 0))}
                  </span>
                </div>

                {/* Total */}
                <div className="text-right">
                  <span className="text-xs text-muted-foreground block sm:hidden">Total</span>
                  <Badge variant="secondary" className="font-mono text-sm">
                    {fmt(total)}
                  </Badge>
                </div>
              </div>

              {isDuplicate ? (
                <Badge variant="outline" className="shrink-0 text-yellow-700 border-yellow-400 text-xs">
                  Duplicate
                </Badge>
              ) : (
                <Badge variant="outline" className="shrink-0 text-green-700 border-green-400 text-xs">
                  New
                </Badge>
              )}
            </div>
          );
        })}
      </div>

      <Separator />

      {/* Actions */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {selectedBills.length} bill{selectedBills.length !== 1 ? "s" : ""} selected
          {rows.some((r) => r.isDuplicate && r.selected) && (
            <span className="ml-1 text-yellow-600 dark:text-yellow-400">
              (includes duplicates — will overwrite)
            </span>
          )}
        </p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={onDiscard}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Start Over
          </Button>
          <Button
            onClick={() => onSave(selectedBills)}
            disabled={selectedBills.length === 0}
          >
            <CheckCircle className="mr-2 h-4 w-4" />
            Save {selectedBills.length > 0 ? `${selectedBills.length} ` : ""}
            Bill{selectedBills.length !== 1 ? "s" : ""}
          </Button>
        </div>
      </div>
    </div>
  );
}

// cn helper inline to avoid another import
function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
