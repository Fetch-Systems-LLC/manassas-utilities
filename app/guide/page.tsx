import { redirect } from "next/navigation";
import { Nav } from "@/components/Nav";
import { GuideStepImage } from "@/components/GuideStepImage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Download,
  Chrome,
  MousePointerClick,
  FolderOpen,
  ExternalLink,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";

function Step({
  number,
  icon: Icon,
  title,
  children,
}: {
  number: number;
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-5">
      <div className="flex flex-col items-center">
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary text-primary-foreground font-bold text-sm shrink-0">
          {number}
        </div>
        <div className="w-px flex-1 bg-border mt-3" />
      </div>
      <div className="pb-12 flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-3">
          <Icon className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">{title}</h2>
        </div>
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function GuidePage() {
  if (process.env.NEXT_PUBLIC_ENABLE_GUIDE !== "true") {
    redirect("/");
  }

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-3xl px-4 py-12 space-y-2">

        {/* Hero */}
        <div className="text-center space-y-3 mb-12">
          <Badge variant="secondary" className="mb-1">Chrome Extension</Badge>
          <h1 className="text-4xl font-bold tracking-tight">
            How to Download All Your Invoices
          </h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            The Manassas Bill Downloader extension lets you grab every invoice
            from InvoiceCloud in one click — no manual downloading required.
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <Button asChild>
              <a
                href="https://github.com/calebmabry/manassas-utils/releases/latest"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Download className="mr-2 h-4 w-4" />
                Download Extension
              </a>
            </Button>
            <Button asChild variant="outline">
              <Link href="/">
                Upload Bills to Tracker
              </Link>
            </Button>
          </div>
        </div>

        {/* What you'll need */}
        <Card className="mb-10">
          <CardContent className="pt-5 pb-5">
            <p className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
              Before you start
            </p>
            <ul className="space-y-2 text-sm">
              {[
                "Google Chrome or Microsoft Edge (any recent version)",
                "Your City of Manassas InvoiceCloud login credentials",
                "The extension zip file downloaded from GitHub (step 1)",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Steps */}
        <div>

          <Step number={1} icon={Download} title="Download & Install the Extension">
            <ol className="space-y-3 text-sm text-muted-foreground list-none">
              <li className="flex gap-2">
                <span className="font-semibold text-foreground w-5 shrink-0">1.</span>
                Go to the{" "}
                <a
                  href="https://github.com/calebmabry/manassas-utils/releases/latest"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-2 inline-flex items-center gap-1"
                >
                  latest GitHub release <ExternalLink className="h-3 w-3" />
                </a>{" "}
                and download <strong className="text-foreground">manassas-bill-downloader.zip</strong>.
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-foreground w-5 shrink-0">2.</span>
                Unzip the file — you'll get a folder called <code className="bg-muted px-1 rounded text-xs">extension</code>.
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-foreground w-5 shrink-0">3.</span>
                Open <code className="bg-muted px-1 rounded text-xs">chrome://extensions</code> in your browser.
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-foreground w-5 shrink-0">4.</span>
                Toggle <strong className="text-foreground">Developer mode</strong> on (top-right corner).
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-foreground w-5 shrink-0">5.</span>
                Click <strong className="text-foreground">Load unpacked</strong> and select the unzipped <code className="bg-muted px-1 rounded text-xs">extension</code> folder.
              </li>
            </ol>
            <GuideStepImage
              src="/guide/step-1-load-unpacked.png"
              alt="Chrome Extensions page with Developer mode enabled and Load unpacked button highlighted"
              label="step-1-load-unpacked.png"
            />
          </Step>

          <Step number={2} icon={Chrome} title="Navigate to InvoiceCloud">
            <p className="text-sm text-muted-foreground">
              Log in to your City of Manassas InvoiceCloud account and navigate
              to the <strong className="text-foreground">Bills</strong> or{" "}
              <strong className="text-foreground">Invoice History</strong> page
              where the table of past invoices is listed. It doesn't matter which
              page of the table you're on — the extension will automatically jump
              back to page 1 before collecting links.
            </p>
            <GuideStepImage
              src="/guide/step-2-invoicecloud.png"
              alt="InvoiceCloud billing history page showing a table of invoices with pagination"
              label="step-2-invoicecloud.png"
            />
          </Step>

          <Step number={3} icon={MousePointerClick} title="Open the Extension">
            <p className="text-sm text-muted-foreground">
              Click the <strong className="text-foreground">puzzle piece icon</strong> in
              your browser toolbar to open the extensions menu, then click{" "}
              <strong className="text-foreground">Manassas Bill Downloader</strong>. To
              keep it visible in your toolbar, click the pin icon next to it.
            </p>
            <GuideStepImage
              src="/guide/step-3-open-popup.png"
              alt="Chrome toolbar with extensions menu open, showing Manassas Bill Downloader with a pin icon"
              label="step-3-open-popup.png"
            />
          </Step>

          <Step number={4} icon={Download} title='Click "Download All Bills"'>
            <p className="text-sm text-muted-foreground mb-3">
              The popup will show the{" "}
              <strong className="text-foreground">Download All Bills</strong> button.
              Click it and the extension will:
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {[
                "Scan every page of your invoice table automatically",
                "Skip any bills already saved to your Downloads folder",
                "Download each PDF one at a time into a Manassas Bills/ folder",
                "Show a green dot next to each bill as it completes",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <GuideStepImage
              src="/guide/step-4-downloading.png"
              alt="Extension popup showing download progress with green dots next to completed bills"
              label="step-4-downloading.png"
            />
            <p className="text-xs text-muted-foreground mt-3">
              You can close and reopen the popup at any time — it remembers where
              it left off for the rest of your browser session.
            </p>
          </Step>

          <Step number={5} icon={FolderOpen} title="Find Your Bills">
            <p className="text-sm text-muted-foreground">
              All downloaded PDFs are saved to a{" "}
              <strong className="text-foreground">Manassas Bills/</strong> folder
              inside your Downloads directory. Files are named{" "}
              <code className="bg-muted px-1 rounded text-xs">YYYY-MM-DD_BillNumber.pdf</code>{" "}
              so they sort chronologically.
            </p>
            <GuideStepImage
              src="/guide/step-5-folder.png"
              alt="Finder / File Explorer showing the Manassas Bills folder with chronologically named PDF files"
              label="step-5-folder.png"
            />
          </Step>

          {/* Final step — no connector line needed */}
          <div className="flex gap-5">
            <div className="flex flex-col items-center">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-green-600 text-white font-bold text-sm shrink-0">
                <CheckCircle2 className="h-5 w-5" />
              </div>
            </div>
            <div className="pb-4 flex-1">
              <h2 className="text-xl font-semibold mb-2">Upload to the Tracker</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Now head back to the Bill Tracker, drop in your downloaded PDFs,
                and let the dashboard show you how your costs have changed over time.
              </p>
              <Button asChild>
                <Link href="/">
                  <Download className="mr-2 h-4 w-4" />
                  Upload Bills Now
                </Link>
              </Button>
            </div>
          </div>

        </div>

        {/* Tips footer */}
        <Card className="mt-4 border-blue-200 bg-blue-50 dark:bg-blue-900/10 dark:border-blue-800">
          <CardContent className="pt-5 pb-5 space-y-2">
            <p className="text-sm font-semibold">Tips</p>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              <li>• The extension only works on <strong className="text-foreground">invoicecloud.com</strong> pages — the button stays disabled elsewhere.</li>
              <li>• Already downloaded a bill? The extension detects it and skips the download automatically.</li>
              <li>• If a download fails (shown in red), click <strong className="text-foreground">Download Again</strong> — the extension will retry only the failed files.</li>
            </ul>
          </CardContent>
        </Card>

      </main>
    </>
  );
}
