export interface BillMeta {
  account_number: string | null;
  bill_date: string | null;
  due_date: string | null;
  service_address: string | null;
}

export interface BillSummary {
  previous_balance: number | null;
  adjustments: number | null;
  payments_made: number | null;
  unpaid_balance: number | null;
  current_charges: number | null;
  amount_due: number | null;
  grand_total: number | null;
}

export interface ElectricService {
  meter: string | null;
  present_reading: number | null;
  prev_reading: number | null;
  usage_kwh: number | null;
  days: number | null;
  rate: number | null;
  service_charge: number | null;
  tax: number | null;
  residential: number | null;
  power_cost_adj: number | null;
  total: number | null;
}

export interface WaterService {
  meter: string | null;
  present_reading: number | null;
  prev_reading: number | null;
  usage: number | null;
  residential_service: number | null;
  water_charge: number | null;
  total: number | null;
}

export interface SewerService {
  uosa_charge: number | null;
  usage_charge: number | null;
  sewer_charge: number | null;
  total: number | null;
}

export interface RefuseService {
  charge: number | null;
  total: number | null;
}

export interface StormwaterService {
  charge: number | null;
  total: number | null;
}

export interface ParsedBill {
  meta: BillMeta;
  summary: BillSummary;
  electric: ElectricService;
  water: WaterService;
  sewer: SewerService;
  refuse: RefuseService;
  stormwater: StormwaterService;
}

export interface StoredBill {
  id: string; // bill_date + account_number
  parsed_at: string;
  bill: ParsedBill;
}

export interface ParseResult {
  filename: string;
  bill: ParsedBill | null;
  error: string | null;
}
