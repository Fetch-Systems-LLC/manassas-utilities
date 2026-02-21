"use client";

import { ParsedBill } from "@/lib/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle, RefreshCw, Zap, Droplets, Trash2, CloudRain, Waves } from "lucide-react";

interface Props {
  bill: ParsedBill;
  onSave: () => void;
  onDiscard: () => void;
  isDuplicate?: boolean;
  onConfirmReplace?: () => void;
}

const fmt = (n: number | null | undefined) =>
  n != null ? `$${n.toFixed(2)}` : "—";

const num = (n: number | null | undefined) =>
  n != null ? n.toLocaleString() : "—";

function ServiceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono font-medium">{value}</span>
    </div>
  );
}

function ServiceCard({
  icon,
  title,
  total,
  children,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  total: string;
  children: React.ReactNode;
  color: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className={`flex items-center gap-2 font-semibold ${color}`}>
            {icon}
            {title}
          </div>
          <Badge variant="secondary" className="font-mono text-base px-3 py-1">
            {total}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <Separator className="mb-3" />
        {children}
      </CardContent>
    </Card>
  );
}

export function BillConfirmation({ bill, onSave, onDiscard, isDuplicate, onConfirmReplace }: Props) {
  const { meta, summary, electric, water, sewer, refuse, stormwater } = bill;

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-xl">Bill Parsed Successfully</CardTitle>
              <CardDescription className="mt-1">
                {meta.service_address} &mdash; Account {meta.account_number}
              </CardDescription>
            </div>
            <Badge className="text-sm px-3 py-1">
              Due {meta.due_date}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            {[
              { label: "Previous Balance", value: fmt(summary.previous_balance) },
              { label: "Payments Made", value: fmt(summary.payments_made) },
              { label: "Current Charges", value: fmt(summary.current_charges) },
              { label: "Amount Due", value: fmt(summary.amount_due) },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-lg bg-background p-3">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-lg font-bold font-mono">{value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Service breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ServiceCard
          icon={<Zap className="h-4 w-4" />}
          title="Electric"
          total={fmt(electric.total)}
          color="text-yellow-600 dark:text-yellow-400"
        >
          <ServiceRow label="Usage" value={`${num(electric.usage_kwh)} kWh`} />
          <ServiceRow label="Billing Days" value={num(electric.days)} />
          <ServiceRow label="Service Charge" value={fmt(electric.service_charge)} />
          <ServiceRow label="Tax" value={fmt(electric.tax)} />
          <ServiceRow label="Residential Electric" value={fmt(electric.residential)} />
          <ServiceRow label="Power Cost Adjustment" value={fmt(electric.power_cost_adj)} />
          <Separator className="my-2" />
          <ServiceRow label="Meter" value={electric.meter ?? "—"} />
          <ServiceRow
            label="Reading"
            value={electric.prev_reading && electric.present_reading
              ? `${num(electric.prev_reading)} → ${num(electric.present_reading)}`
              : "—"}
          />
        </ServiceCard>

        <div className="space-y-4">
          <ServiceCard
            icon={<Droplets className="h-4 w-4" />}
            title="Water"
            total={fmt(water.total)}
            color="text-blue-600 dark:text-blue-400"
          >
            <ServiceRow label="Usage" value={`${num(water.usage)} units`} />
            <ServiceRow label="Residential Service" value={fmt(water.residential_service)} />
            <ServiceRow label="Water Charge" value={fmt(water.water_charge)} />
            <Separator className="my-2" />
            <ServiceRow label="Meter" value={water.meter ?? "—"} />
            <ServiceRow
              label="Reading"
              value={water.prev_reading && water.present_reading
                ? `${num(water.prev_reading)} → ${num(water.present_reading)}`
                : "—"}
            />
          </ServiceCard>

          <ServiceCard
            icon={<Waves className="h-4 w-4" />}
            title="Sewer"
            total={fmt(sewer.total)}
            color="text-teal-600 dark:text-teal-400"
          >
            <ServiceRow label="UOSA Charge" value={fmt(sewer.uosa_charge)} />
            <ServiceRow label="Usage Charge" value={fmt(sewer.usage_charge)} />
            <ServiceRow label="Sewer Charge" value={fmt(sewer.sewer_charge)} />
          </ServiceCard>
        </div>

        <ServiceCard
          icon={<Trash2 className="h-4 w-4" />}
          title="Refuse"
          total={fmt(refuse.total)}
          color="text-orange-600 dark:text-orange-400"
        >
          <ServiceRow label="Residential/Commercial" value={fmt(refuse.charge)} />
        </ServiceCard>

        <ServiceCard
          icon={<CloudRain className="h-4 w-4" />}
          title="Stormwater"
          total={fmt(stormwater.total)}
          color="text-slate-600 dark:text-slate-400"
        >
          <ServiceRow label="Residential" value={fmt(stormwater.charge)} />
        </ServiceCard>
      </div>

      {/* Duplicate warning */}
      {isDuplicate && (
        <div className="flex items-start gap-3 rounded-lg border border-yellow-400/50 bg-yellow-50 dark:bg-yellow-900/10 px-4 py-3">
          <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <p className="font-semibold text-yellow-800 dark:text-yellow-300">Bill already saved</p>
            <p className="text-yellow-700 dark:text-yellow-400 mt-0.5">
              A bill for <strong>{meta.bill_date}</strong> is already in your history. Do you want to replace it?
            </p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 justify-end">
        <Button variant="outline" onClick={onDiscard}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Upload Different Bill
        </Button>
        {isDuplicate ? (
          <Button variant="destructive" onClick={onConfirmReplace}>
            <CheckCircle className="mr-2 h-4 w-4" />
            Replace Existing Bill
          </Button>
        ) : (
          <Button onClick={onSave}>
            <CheckCircle className="mr-2 h-4 w-4" />
            Save to My History
          </Button>
        )}
      </div>
    </div>
  );
}
