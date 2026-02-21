"use client";

import { useEffect, useState } from "react";
import { Nav } from "@/components/Nav";
import { getAllBills, deleteBill, exportBills, importBills } from "@/lib/db";
import { StoredBill } from "@/lib/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, Download, Upload, BarChart3 } from "lucide-react";
import Link from "next/link";

const fmt = (n: number | null | undefined) =>
  n != null ? `$${n.toFixed(2)}` : "—";

export default function HistoryPage() {
  const [bills, setBills] = useState<StoredBill[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    setBills(await getAllBills());
    setLoading(false);
  };

  useEffect(() => { reload(); }, []);

  const handleDelete = async (id: string) => {
    await deleteBill(id);
    reload();
  };

  const handleExport = async () => {
    const json = await exportBills();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "manassas-bills.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      const count = await importBills(text);
      alert(`Imported ${count} bill(s).`);
      reload();
    };
    input.click();
  };

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-5xl px-4 py-10 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Bill History</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {bills.length} bill{bills.length !== 1 ? "s" : ""} saved locally in your browser
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleImport}>
              <Upload className="mr-2 h-4 w-4" />
              Import
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport} disabled={bills.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Button size="sm" asChild>
              <Link href="/dashboard">
                <BarChart3 className="mr-2 h-4 w-4" />
                Dashboard
              </Link>
            </Button>
          </div>
        </div>

        {loading ? (
          <p className="text-muted-foreground py-16 text-center">Loading...</p>
        ) : bills.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <p className="text-muted-foreground">No bills saved yet.</p>
            <Button asChild>
              <Link href="/">Upload Your First Bill</Link>
            </Button>
          </div>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bill Date</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead className="text-right">Electric</TableHead>
                  <TableHead className="text-right">Water</TableHead>
                  <TableHead className="text-right">Sewer</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...bills].reverse().map((stored) => {
                  const { meta, summary, electric, water, sewer } = stored.bill;
                  const total = summary.grand_total ?? summary.current_charges;
                  return (
                    <TableRow key={stored.id}>
                      <TableCell className="font-medium">{meta.bill_date ?? "—"}</TableCell>
                      <TableCell>{meta.due_date ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {meta.service_address ?? "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {fmt(electric.total)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {fmt(water.total)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {fmt(sewer.total)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary" className="font-mono">
                          {fmt(total)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(stored.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </main>
    </>
  );
}
