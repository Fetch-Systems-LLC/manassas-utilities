# Manassas Utility Bill Analyzer — Project Plan

A free, privacy-first web app that lets Manassas residents upload their City of Manassas Utilities PDF bills, automatically extract the data with a **zero-cost Python parser**, and visualize spending trends over time.

---

## The Problem

The City of Manassas Utilities portal shows individual invoices but provides no:
- Year-over-year cost comparison
- Trend charts across service categories
- Alerts for unusual cost spikes
- Easy breakdown of what's driving a high bill (electric vs. water vs. sewer, etc.)

---

## What the Bill Contains (Parsed from Sample)

From the first page of each PDF we can reliably extract:

| Field | Example |
|---|---|
| Account Number | 990394267-001 |
| Bill Date | 01-28-2026 |
| Due Date | 02-19-2026 |
| Service Address | 8443 Kirby St |
| **Electricity** | |
| Meter Number | 312-168-965 |
| Present / Previous Reading | 257657 / 252347 |
| Usage (kWh) | 5310 |
| Billing Days | 34 |
| Electric Service Charge | $16.17 |
| Electric Tax | $6.87 |
| Residential Electric | $522.50 |
| Power Cost Adjustment | $81.14 |
| Electric Service Total | $626.68 |
| **Water** | |
| Meter Number | 46-435-048 |
| Usage (units) | 4 |
| Residential Water Service | $15.20 |
| Water Charge | $11.87 |
| Water Service Total | $27.07 |
| **Sewer** | |
| UOSA Charge Residential | $31.80 |
| Residential Sewer Usage | $13.08 |
| Residential Sewer Charge | $10.17 |
| Sewer Service Total | $55.05 |
| **Refuse** | |
| Refuse Residential/Commercial | $31.59 |
| Refuse Service Total | $31.59 |
| **Stormwater** | |
| Stormwater Residential | $9.35 |
| Stormwater Service Total | $9.35 |
| **Summary** | |
| Total Current Charges | $749.74 |
| Previous Balance | $442.82 |
| Payments Made | $442.82 |
| Amount Due | $749.74 |

---

## Core Features

### Phase 1 — Upload & Parse
- Drag-and-drop or file-picker PDF upload
- Python parser extracts all fields from page 1 — **$0 per parse, forever**
- Show a parsed confirmation screen so users can verify / correct any field
- Store parsed bills locally in the browser (IndexedDB) — **no bill data is ever stored on the server**

### Phase 2 — Dashboard & Trends
- Timeline chart: Total bill by month across all uploaded bills
- Stacked bar chart: Breakdown by service (Electric / Water / Sewer / Refuse / Stormwater)
- Usage chart: kWh and water usage over time (separate from dollar cost)
- YoY comparison: Side-by-side same month, previous year vs. current year
- Rate analysis: Cost-per-kWh and cost-per-water-unit trends (catches rate hikes even when usage is flat)

### Phase 3 — Insights & Alerts
- Flag bills that are >15% above your 12-month average
- Identify which service category drove a spike
- "Power Cost Adjustment" tracker (this line fluctuates and often surprises people)
- Estimated next bill projection based on rolling average

### Phase 4 — Community (Optional / Future)
- Anonymous opt-in data sharing to see neighborhood averages
- Community-wide rate change detection
- Exportable CSV/JSON of your own data

---

## Privacy Model

**All data stays on your device.**

- The PDF is sent to the Python parser only to extract numbers — the file is never written to disk server-side and is discarded immediately after parsing
- Parsed bill data is saved to browser IndexedDB (survives page reloads, private to your browser)
- No user accounts, no login, no analytics, no tracking
- An "Export my data" button lets users back up history as JSON
- An "Import data" button lets them restore it on a new device

---

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend Framework | Next.js (App Router) | Free Vercel hosting, simple file upload handling |
| **PDF Parsing** | **Python + pdfplumber** | **Free, runs server-side, handles complex multi-column layouts well** |
| Parse API | Vercel Python Serverless Function | Ships alongside the Next.js app, no separate server to manage |
| Client Storage | IndexedDB via `idb` library | Persistent, large capacity, privacy-safe |
| Charts | Recharts | Lightweight, React-native, free |
| Styling | Tailwind CSS | Fast to build, no cost |
| Hosting | Vercel (free tier) | 100GB bandwidth/mo, Python + Node serverless functions included |
| Domain (optional) | Cloudflare (free proxy) + cheap `.com` | ~$10/yr if desired |

**Running cost: $0.** No API keys, no pay-per-parse.

---

## Why pdfplumber?

The City of Manassas bill is a structured PDF with actual embedded text (not a scanned image), which means text-based parsing is fast and reliable. `pdfplumber` is the right tool because it:

- Extracts text with **x/y coordinates**, allowing us to distinguish the left column (electric) from the right column (water/sewer) without ambiguity
- Handles multi-column layouts that trip up simpler parsers
- Is pure Python with no system dependencies (works on Vercel's serverless runtime)
- Is MIT licensed and actively maintained

Parsing strategy for this specific bill layout:
1. Extract all text blocks with their bounding boxes from page 1
2. Split into left half (x < page midpoint) and right half for the two-column section
3. Use regex against known label strings (`ELECTRIC SERVICE TOTAL`, `WATER SERVICE TOTAL`, etc.) to find values
4. Parse the header table (account number, dates, balances) from the top section separately

---

## Architecture

```
User's Browser
├── PDF file uploaded via drag-and-drop
│   └── POST multipart/form-data → /api/parse_bill (Python serverless fn)
│                                   └── pdfplumber reads page 1 in-memory
│                                       └── regex extracts all fields → JSON
│                                           └── PDF bytes discarded, JSON returned
│
├── Parsed JSON displayed for user confirmation / correction
│   └── Confirmed → saved to IndexedDB
│
└── Dashboard reads IndexedDB → renders Recharts visualizations
```

No database. No user accounts. No ongoing costs.

---

## Python Parser Design (`api/parse_bill.py`)

```python
# Pseudocode — real implementation will be built from this
import pdfplumber, re
from http.server import BaseHTTPRequestHandler

PATTERNS = {
    "electric_total":        r"ELECTRIC SERVICE TOTAL\s+\$?([\d,]+\.\d{2})",
    "water_total":           r"WATER SERVICE TOTAL\s+\$?([\d,]+\.\d{2})",
    "sewer_total":           r"SEWER SERVICE TOTAL\s+\$?([\d,]+\.\d{2})",
    "refuse_total":          r"REFUSE SERVICE TOTAL\s+\$?([\d,]+\.\d{2})",
    "stormwater_total":      r"STORMWATER SERVICE TOTAL\s+\$?([\d,]+\.\d{2})",
    "grand_total":           r"TOTAL CURRENT CHARGES THIS BILL\s+\$?([\d,]+\.\d{2})",
    "electric_usage":        r"USAGE\s+(\d+)",          # left column
    "electric_days":         r"DAYS\s+(\d+)",
    "power_cost_adjustment": r"POWER COST ADJUSTMENT\s+\$?([\d,]+\.\d{2})",
    "residential_electric":  r"RESIDENTIAL ELECTRIC\s+\$?([\d,]+\.\d{2})",
    "electric_tax":          r"ELECTRIC TAX\s+\$?([\d,]+\.\d{2})",
    "electric_service_charge": r"ELECTRIC SERVICE CHARGE\s+\$?([\d,]+\.\d{2})",
    "water_usage":           r"USAGE\s+(\d+)",          # right column
    "residential_water":     r"RESIDENTIAL WATER SERVICE\s+\$?([\d,]+\.\d{2})",
    "water_charge":          r"WATER CHARGE\s+\$?([\d,]+\.\d{2})",
    "uosa_charge":           r"UOSA CHARGE RESIDENTIAL\s+\$?([\d,]+\.\d{2})",
    "sewer_usage":           r"RESIDENTIAL SEWER USAGE\s+\$?([\d,]+\.\d{2})",
    "sewer_charge":          r"RESIDENTIAL SEWER CHARGE\s+\$?([\d,]+\.\d{2})",
    "refuse_charge":         r"REFUSE RESIDENTIAL/COMMERCIAL\s+\$?([\d,]+\.\d{2})",
    "stormwater_charge":     r"STORMWATER RESIDENTIAL\s+\$?([\d,]+\.\d{2})",
    "account_number":        r"(\d{9}-\d{3})",
    "bill_date":             r"BILL DATE[:\s]+([\d-]+)",
    "due_date":              r"DUE DATE[:\s]+([\d-]+)",
    "previous_balance":      r"PREVIOUS\s+BALANCE\s+\$?([\d,]+\.\d{2})",
    "payments_made":         r"PAYMENTS\s+MADE\s+\$?([\d,]+\.\d{2})",
    "amount_due":            r"CURRENT AMOUNT DUE BY[^\$]+\$?([\d,]+\.\d{2})",
}

def parse_bill(pdf_bytes: bytes) -> dict:
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        page = pdf.pages[0]
        full_text = page.extract_text()
        mid_x = page.width / 2
        left_text  = page.crop((0, 0, mid_x, page.height)).extract_text()
        right_text = page.crop((mid_x, 0, page.width, page.height)).extract_text()
    # Apply patterns, handle left vs. right column for usage fields
    # Return structured dict
```

The two-column split ensures "USAGE" in the electric section and "USAGE" in the water section don't collide.

---

## Free Hosting Setup

### Vercel (Recommended — supports Python serverless natively)

```
manassas-utils/
├── api/
│   └── parse_bill.py        ← Vercel detects Python, runs as serverless fn
├── requirements.txt         ← pdfplumber + dependencies
├── app/
│   ├── page.tsx             ← Upload UI
│   └── dashboard/page.tsx   ← Charts
├── lib/
│   ├── db.ts                ← IndexedDB helpers
│   └── charts.tsx           ← Recharts components
├── components/
│   ├── UploadDropzone.tsx
│   ├── BillConfirmation.tsx
│   └── TrendChart.tsx
└── PLAN.md
```

**Deploy steps:**
1. `git push` to GitHub
2. Connect repo to [vercel.com](https://vercel.com) — zero config needed
3. App is live at `yourapp.vercel.app`
4. Every future `git push` auto-deploys

**`requirements.txt`:**
```
pdfplumber==0.11.4
```
That's it — one dependency, ~2MB, well within Vercel's limits.

---

## Implementation Phases & Milestones

| Phase | Deliverable |
|---|---|
| 0 | Repo setup, Next.js scaffold, Vercel deploy (empty shell live) |
| 1 | Python parser: `parse_bill.py` with full field extraction + unit tests |
| 2 | Upload UI → calls `/api/parse_bill` → shows confirmation screen |
| 3 | IndexedDB storage + bill history list page |
| 4 | Dashboard: total timeline, stacked service breakdown, usage charts |
| 5 | YoY comparison view + spike detection alerts |
| 6 | Polish: mobile layout, export/import JSON, "how to get your PDFs" guide |

---

## Community Rollout Ideas

- Share on Nextdoor Manassas and local Facebook groups
- Submit to the City of Manassas community newsletter
- Add a "How to download your bills" walkthrough (screenshots of the utility portal)
- Keep the GitHub repo public so neighboring cities (Manassas Park, Woodbridge, etc.) can fork it for their own bill formats

---

## Open Questions to Decide

1. **Community data sharing** — opt-in anonymized aggregation in Phase 4, or keep fully local forever?
2. **App name** — `ManassasBillTracker`? `NovaBillCheck`? Something else?
3. **Account multi-support** — should one browser support multiple service addresses (e.g., landlords with multiple properties)?
4. **Parser fallback** — if pdfplumber can't extract a field (e.g., a scanned/image PDF), show a manual entry form rather than failing silently?
