"use client";

import { useState } from "react";
import { Nav } from "@/components/Nav";
import { UploadDropzone } from "@/components/UploadDropzone";
import { MultiBillConfirmation } from "@/components/MultiBillConfirmation";
import { ParsedBill, ParseResult, StoredBill } from "@/lib/types";
import { saveBill } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { CheckCircle, BarChart3, Download, Puzzle } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

import { SupportDialog } from "@/components/SupportDialog";
import { Card, CardContent } from "@/components/ui/card";

const buildId = (bill: ParsedBill) =>
  `${bill.meta.bill_date ?? "unknown"}-${bill.meta.account_number ?? "unknown"}`;

export default function HomePage() {
  const [results, setResults] = useState<ParseResult[] | null>(null);
  const [savedCount, setSavedCount] = useState(0);

  const handleSave = async (bills: ParsedBill[]) => {
    await Promise.all(
      bills.map((bill) =>
        saveBill({ id: buildId(bill), parsed_at: new Date().toISOString(), bill } as StoredBill)
      )
    );
    setSavedCount(bills.length);
  };

  const handleDiscard = () => {
    setResults(null);
    setSavedCount(0);
  };

  const isSaved = savedCount > 0;

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-5xl px-4 py-10 space-y-8">

        {!results && !isSaved && (
          <div className="text-center space-y-5 mb-8">
            <div className="flex justify-center">
              <Image
                src="/OriginalImage.png"
                alt="Manassas water tower"
                width={140}
                height={140}
                className="rounded-2xl shadow-md"
                priority
              />
            </div>
            <div className="space-y-3">
              <h1 className="text-4xl font-bold tracking-tight">
                Track Your Manassas Utility Bills
              </h1>
              <p className="text-muted-foreground text-lg max-w-xl mx-auto">
                Upload one or more City of Manassas Utilities PDFs to see how
                your costs change over time. Completely free, completely private —
                all data stays in your browser.
              </p>
            </div>
          </div>
        )}

        {isSaved ? (
          <div className="flex flex-col items-center gap-6 py-16 text-center">
            <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-5">
              <CheckCircle className="h-12 w-12 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">
                {savedCount} Bill{savedCount !== 1 ? "s" : ""} Saved!
              </h2>
              <p className="text-muted-foreground mt-1">
                Head to your dashboard to see trends over time.
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={handleDiscard}>
                Upload More Bills
              </Button>
              <Button asChild>
                <Link href="/dashboard">
                  <BarChart3 className="mr-2 h-4 w-4" />
                  View Dashboard
                </Link>
              </Button>
            </div>
          </div>
        ) : results ? (
          <MultiBillConfirmation
            results={results}
            onSave={handleSave}
            onDiscard={handleDiscard}
          />
        ) : (
          <UploadDropzone onResults={setResults} />
        )}

        {!results && !isSaved && process.env.NEXT_PUBLIC_ENABLE_GUIDE === "true" && (
          <Card className="border-primary/20 bg-primary/5 dark:bg-primary/10">
            <CardContent className="pt-5 pb-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 shrink-0">
                  <Puzzle className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">Have lots of bills to upload?</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    The free Chrome extension downloads all your InvoiceCloud invoices in one click — no manual work required.
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button asChild size="sm" variant="outline">
                    <Link href="/guide">See How It Works</Link>
                  </Button>
                  <Button asChild size="sm">
                    <a
                      href="https://github.com/calebmabry/manassas-utils/releases/latest"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Download className="mr-1.5 h-3.5 w-3.5" />
                      Get the Extension
                    </a>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {!results && !isSaved && (
          <div className="pt-10 border-t flex flex-col items-center gap-4">
            <p className="text-center text-xs text-muted-foreground">
              Your PDFs are sent only to parse the numbers and are never stored on
              any server. All bill data is saved locally in your browser.
            </p>
            <div className="flex gap-4 text-xs font-medium text-muted-foreground">
              <SupportDialog>
                <button className="hover:text-foreground transition-colors underline underline-offset-4">
                  Support Email
                </button>
              </SupportDialog>
              <a href="https://github.com/calebmabry/manassas-utils" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors underline underline-offset-4">
                View on GitHub
              </a>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
