import io
import json
import os
import re
import sys
from http.server import BaseHTTPRequestHandler

try:
    import pdfplumber
except ImportError:
    pdfplumber = None

# ---------------------------------------------------------------------------
# Debug logging — stderr only, never stdout (stdout carries the JSON result)
# Enable with:  BILL_DEBUG=1 python parse_bill.py bill.pdf
#           or: python parse_bill.py --debug bill.pdf
# ---------------------------------------------------------------------------

DEBUG = False  # set at runtime in __main__ or via env var

# Keys whose values contain PII — logged as [REDACTED] regardless of DEBUG
PII_KEYS = {"account_number", "service_address", "electric_meter", "water_meter"}


def dbg(msg: str) -> None:
    if DEBUG:
        print(f"[BILL_DEBUG] {msg}", file=sys.stderr)


def _redact_text(text: str) -> str:
    """Strip known PII patterns from raw extracted text before logging."""
    # Account numbers:  9 digits - 3 digits
    text = re.sub(r"\d{9}-\d{3}", "[ACCOUNT]", text)
    # Meter numbers inside parentheses:  Meter #XX-XXX-XXX
    text = re.sub(r"Meter #[\d-]+", "Meter #[METER]", text, flags=re.IGNORECASE)
    # Street addresses heuristic: all-caps word(s) followed by a street suffix
    text = re.sub(
        r"\b[A-Z0-9 ]+ (?:ST|DR|AVE|CT|RD|LN|WAY|BLVD|PL|CIR|PKWY)\b",
        "[ADDRESS]",
        text,
    )
    # Person names: match "FIRSTNAME MI LASTNAME" where MI is a single letter.
    # This pattern is highly specific to human names and avoids matching bill labels.
    text = re.sub(r"\b([A-Z]{2,15})\s+([A-Z])\s+([A-Z]{2,15})\b", "[NAME]", text)
    return text


def _safe_value(key: str, value) -> str:
    """Return a log-safe representation of a field value."""
    if value is None:
        return "null"
    if key in PII_KEYS:
        return "[REDACTED]"
    return repr(value)


# ---------------------------------------------------------------------------
# Field patterns — applied against extracted text
# ---------------------------------------------------------------------------

HEADER_PATTERNS = [
    ("account_number",   r"(\d{9}-\d{3})"),
    ("bill_date",        r"BILL DATE:\s*([\d-]+)"),
    ("due_date",         r"DUE DATE[:\s]+([\d-]+)"),
    ("service_address",  r"SERVICE ADDRESS\s+(.+?)(?:\n|ELECTRICITY|WATER)"),
    ("amount_due",       r"CURRENT AMOUNT DUE BY[^\$]+\$?([\d,]+\.\d{2})"),
]

LEFT_PATTERNS = [
    ("electric_meter",           r"ELECTRICITY SERVICES \(Meter #([\d-]+)\)"),
    ("electric_present_reading", r"PRESENT READING ON \d{2}/\d{2}/\d{4}\s+([\d,]+)"),
    ("electric_prev_reading",    r"PREVIOUS READING ON \d{2}/\d{2}/\d{4}\s+([\d,]+)"),
    ("electric_usage_kwh",       r"USAGE\s+([\d,]+)"),
    ("electric_days",            r"DAYS\s+(\d+)"),
    ("electric_rate",            r"RATE\s+(\S+)"),
    ("electric_service_charge",  r"ELECTRIC SERVICE CHARGE\s+\$?([\d,]+\.\d{2})"),
    ("electric_tax",             r"ELECTRIC TAX\s+\$?([\d,]+\.\d{2})"),
    ("residential_electric",     r"RESIDENTIAL ELECTRIC\s+\$?([\d,]+\.\d{2})"),
    ("power_cost_adjustment",    r"POWER COST ADJUSTMENT\s+\$?([\d,]+\.\d{2})"),
    ("electric_total",           r"ELECTRIC SERVICE TOTAL\s+\$?([\d,]+\.\d{2})"),
]

RIGHT_PATTERNS = [
    ("water_meter",              r"WATER SERVICES \(Meter #([\d-]+)\)"),
    ("water_present_reading",    r"PRESENT READING ON \d{2}/\d{2}/\d{4}\s+([\d,]+)"),
    ("water_prev_reading",       r"PREVIOUS READING ON \d{2}/\d{2}/\d{4}\s+([\d,]+)"),
    ("water_usage",              r"USAGE\s+([\d,]+)"),
    ("residential_water_service",r"RESIDENTIAL WATER SERVICE\s+\$?([\d,]+\.\d{2})"),
    ("water_charge",             r"WATER CHARGE\s+\$?([\d,]+\.\d{2})"),
    ("water_total",              r"WATER SERVICE TOTAL\s+\$?([\d,]+\.\d{2})"),
    ("uosa_charge",              r"UOSA CHARGE RESIDENTIAL\s+\$?([\d,]+\.\d{2})"),
    ("sewer_usage_charge",       r"RESIDENTIAL SEWER USAGE\s+\$?([\d,]+\.\d{2})"),
    ("sewer_charge",             r"RESIDENTIAL SEWER CHARGE\s+\$?([\d,]+\.\d{2})"),
    ("sewer_total",              r"SEWER SERVICE TOTAL\s+\$?([\d,]+\.\d{2})"),
    ("refuse_charge",            r"REFUSE RESIDENTIAL/COMMERCIAL\s+\$?([\d,]+\.\d{2})"),
    ("refuse_total",             r"REFUSE SERVICE TOTAL\s+\$?([\d,]+\.\d{2})"),
    ("stormwater_charge",        r"STORMWATER RESIDENTIAL\s+\$?([\d,]+\.\d{2})"),
    ("stormwater_total",         r"STORMWATER SERVICE TOTAL\s+\$?([\d,]+\.\d{2})"),
    ("grand_total",              r"TOTAL CURRENT CHARGES THIS BILL\s+\$?([\d,]+\.\d{2})"),
]


def _parse_dollar(value: str) -> float:
    return float(value.replace(",", ""))


def _extract(patterns: list, text: str, section_label: str = "") -> dict:
    result = {}
    for key, pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            raw = match.group(1).strip()
            try:
                result[key] = _parse_dollar(raw)
            except ValueError:
                result[key] = raw
            dbg(f"  {'✓':2} {section_label:<6} {key:<30} = {_safe_value(key, result[key])}")
        else:
            dbg(f"  {'✗':2} {section_label:<6} {key:<30}   [NO MATCH]  pattern: {pattern!r}")
    return result


def _extract_header_row(text: str) -> dict:
    """
    Parse the single summary data row that contains all 6 dollar amounts
    in column order: prev_balance, adjustments, payments, unpaid, current, amount_due, date_due.
    """
    pattern = (
        r"\d{9}-\d{3}"
        r"\s+\$?([\d,]+\.\d{2})"   # previous_balance
        r"\s+\$?([\d,]+\.\d{2})"   # adjustments
        r"\s+\$?([\d,]+\.\d{2})"   # payments_made
        r"\s+\$?([\d,]+\.\d{2})"   # unpaid_balance
        r"\s+\$?([\d,]+\.\d{2})"   # current_charges
        r"\s+\$?([\d,]+\.\d{2})"   # amount_due_col
        r"\s+([\d-]+)"              # date_due
    )
    m = re.search(pattern, text)
    if not m:
        dbg("  ✗ HEADER row   [NO MATCH] — could not parse summary table row")
        return {}

    keys = ["previous_balance", "adjustments", "payments_made",
            "unpaid_balance", "current_charges", "amount_due_col", "date_due"]
    result = {}
    for key, raw in zip(keys, m.groups()):
        try:
            result[key] = _parse_dollar(raw)
        except ValueError:
            result[key] = raw
        dbg(f"  ✓ HEADER {key:<30} = {_safe_value(key, result[key])}")
    return result


def parse_bill(pdf_bytes: bytes) -> dict:
    if pdfplumber is None:
        raise RuntimeError("pdfplumber is not installed")

    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        page = pdf.pages[0]
        full_text = page.extract_text(layout=True) or ""

        mid_x = float(page.width) / 2.0
        left_crop  = page.crop((0,     0, mid_x,            float(page.height)))
        right_crop = page.crop((mid_x, 0, float(page.width), float(page.height)))

        left_text  = left_crop.extract_text(layout=True)  or ""
        right_text = right_crop.extract_text(layout=True) or ""

    dbg(f"Page size: {page.width:.1f} x {page.height:.1f}  |  mid_x={mid_x:.1f}")
    dbg(f"Full text length: {len(full_text)} chars")
    dbg(f"Left column length: {len(left_text)} chars")
    dbg(f"Right column length: {len(right_text)} chars")

    if DEBUG:
        dbg("--- FULL TEXT (PII redacted) ---")
        for line in _redact_text(full_text).splitlines():
            dbg(f"  {line}")
        dbg("--- LEFT COLUMN (PII redacted) ---")
        for line in _redact_text(left_text).splitlines():
            dbg(f"  {line}")
        dbg("--- RIGHT COLUMN (PII redacted) ---")
        for line in _redact_text(right_text).splitlines():
            dbg(f"  {line}")
        dbg("--- PATTERN MATCHES ---")

    data: dict = {}
    data.update(_extract(HEADER_PATTERNS, full_text, "FULL"))
    data.update(_extract_header_row(full_text))
    data.update(_extract(LEFT_PATTERNS,   left_text,  "LEFT"))
    data.update(_extract(RIGHT_PATTERNS,  right_text, "RIGHT"))

    result = {
        "meta": {
            "account_number":  data.get("account_number"),
            "bill_date":       data.get("bill_date"),
            "due_date":        data.get("due_date"),
            "service_address": data.get("service_address"),
        },
        "summary": {
            "previous_balance": data.get("previous_balance"),
            "adjustments":      data.get("adjustments"),
            "payments_made":    data.get("payments_made"),
            "unpaid_balance":   data.get("unpaid_balance"),
            "current_charges":  data.get("current_charges"),
            "amount_due":       data.get("amount_due") or data.get("amount_due_col"),
            "grand_total":      data.get("grand_total"),
        },
        "electric": {
            "meter":            data.get("electric_meter"),
            "present_reading":  data.get("electric_present_reading"),
            "prev_reading":     data.get("electric_prev_reading"),
            "usage_kwh":        data.get("electric_usage_kwh"),
            "days":             data.get("electric_days"),
            "rate":             data.get("electric_rate"),
            "service_charge":   data.get("electric_service_charge"),
            "tax":              data.get("electric_tax"),
            "residential":      data.get("residential_electric"),
            "power_cost_adj":   data.get("power_cost_adjustment"),
            "total":            data.get("electric_total"),
        },
        "water": {
            "meter":               data.get("water_meter"),
            "present_reading":     data.get("water_present_reading"),
            "prev_reading":        data.get("water_prev_reading"),
            "usage":               data.get("water_usage"),
            "residential_service": data.get("residential_water_service"),
            "water_charge":        data.get("water_charge"),
            "total":               data.get("water_total"),
        },
        "sewer": {
            "uosa_charge":  data.get("uosa_charge"),
            "usage_charge": data.get("sewer_usage_charge"),
            "sewer_charge": data.get("sewer_charge"),
            "total":        data.get("sewer_total"),
        },
        "refuse": {
            "charge": data.get("refuse_charge"),
            "total":  data.get("refuse_total"),
        },
        "stormwater": {
            "charge": data.get("stormwater_charge"),
            "total":  data.get("stormwater_total"),
        },
    }

    if DEBUG:
        dbg("--- NULL FIELDS SUMMARY ---")
        for section, fields in result.items():
            for field, val in fields.items():
                if val is None:
                    dbg(f"  NULL  {section}.{field}")

    return result


# ---------------------------------------------------------------------------
# Vercel serverless handler
# ---------------------------------------------------------------------------

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)

            result = parse_bill(body)
            payload = json.dumps(result).encode()

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(payload)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(payload)

        except Exception as exc:
            error = json.dumps({"error": str(exc)}).encode()
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(error)))
            self.end_headers()
            self.wfile.write(error)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def log_message(self, format, *args):
        pass


# ---------------------------------------------------------------------------
# Local dev / test entrypoint
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    args = sys.argv[1:]

    if "--debug" in args or os.environ.get("BILL_DEBUG", "").lower() in ("1", "true"):
        DEBUG = True
        args = [a for a in args if a != "--debug"]

    if "--stdin" in args or not args:
        pdf_bytes = sys.stdin.buffer.read()
    else:
        with open(args[0], "rb") as f:
            pdf_bytes = f.read()

    result = parse_bill(pdf_bytes)
    print(json.dumps(result))
