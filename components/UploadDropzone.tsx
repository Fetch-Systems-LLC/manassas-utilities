"use client";

import { useCallback, useState } from "react";
import { Upload, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { ParseResult } from "@/lib/types";

interface Props {
  onResults: (results: ParseResult[]) => void;
}

/** Returns a human-readable error string if required fields are missing, otherwise null. */
function validateBill(bill: ParseResult["bill"]): string | null {
  if (!bill) return "Parser returned no data.";

  const missing: string[] = [];

  if (!bill.meta.bill_date)      missing.push("bill date");
  if (!bill.meta.account_number) missing.push("account number");

  const hasTotal =
    bill.summary.grand_total != null || bill.summary.current_charges != null;
  if (!hasTotal) missing.push("total amount due");

  const hasService = [
    bill.electric.total,
    bill.water.total,
    bill.sewer.total,
    bill.refuse.total,
    bill.stormwater.total,
  ].some((v) => v != null);
  if (!hasService) missing.push("service charges");

  if (missing.length === 0) return null;
  return `Could not parse: ${missing.join(", ")}. This PDF may not be a City of Manassas utility bill.`;
}

async function parsePdf(file: File): Promise<ParseResult> {
  const bytes = await file.arrayBuffer();
  const res = await fetch("/api/parse_bill", {
    method: "POST",
    headers: { "Content-Type": "application/pdf" },
    body: bytes,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return { filename: file.name, bill: null, error: err.error ?? `Server error ${res.status}` };
  }
  const bill = await res.json();
  const validationError = validateBill(bill);
  if (validationError) {
    return { filename: file.name, bill: null, error: validationError };
  }
  return { filename: file.name, bill, error: null };
}

export function UploadDropzone({ onResults }: Props) {
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList).filter((f) => f.type === "application/pdf");

      if (files.length === 0) {
        setError("Only PDF files are supported.");
        return;
      }

      setError(null);
      setProgress({ done: 0, total: files.length });

      // Parse all files in parallel, track completion count as each finishes
      let done = 0;
      const results = await Promise.all(
        files.map(async (file) => {
          const result = await parsePdf(file);
          done += 1;
          setProgress({ done, total: files.length });
          return result;
        })
      );

      setProgress(null);
      onResults(results);
    },
    [onResults]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFiles(e.target.files);
    e.target.value = "";
  };

  const isParsing = progress !== null;

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={cn(
        "relative flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed p-12 transition-colors",
        isParsing
          ? "border-primary/40 bg-primary/5 cursor-wait"
          : dragging
          ? "border-primary bg-primary/5 cursor-copy"
          : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/40 cursor-pointer"
      )}
    >
      {!isParsing && (
        <input
          type="file"
          accept="application/pdf"
          multiple
          className="absolute inset-0 opacity-0 cursor-pointer"
          onChange={onInputChange}
        />
      )}

      {isParsing ? (
        <div className="flex flex-col items-center gap-4 w-full max-w-xs text-center">
          <div className="rounded-full bg-primary/10 p-4">
            <FileText className="h-8 w-8 text-primary animate-pulse" />
          </div>
          <p className="text-sm font-medium">
            Parsing {progress.done} of {progress.total} bill{progress.total !== 1 ? "s" : ""}…
          </p>
          <Progress
            value={(progress.done / progress.total) * 100}
            className="h-2 w-full"
          />
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 text-center pointer-events-none">
          <div className="rounded-full bg-primary/10 p-4">
            <Upload className="h-8 w-8 text-primary" />
          </div>
          <div>
            <p className="text-lg font-semibold">Drop your bill PDFs here</p>
            <p className="text-sm text-muted-foreground mt-1">
              Upload one or multiple — City of Manassas Utilities bills only
            </p>
          </div>
          <Button variant="outline" size="sm" className="pointer-events-none mt-1">
            <FileText className="mr-2 h-4 w-4" />
            Select PDFs
          </Button>
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive font-medium">{error}</p>
      )}
    </div>
  );
}
