"use client";

import { openDB, DBSchema, IDBPDatabase } from "idb";
import { StoredBill } from "./types";

const DB_NAME = "manassas-bills";
const DB_VERSION = 1;
const STORE = "bills";

interface BillsDB extends DBSchema {
  bills: {
    key: string;
    value: StoredBill;
    indexes: { by_date: string };
  };
}

let dbPromise: Promise<IDBPDatabase<BillsDB>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<BillsDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("by_date", "bill.meta.bill_date");
      },
    });
  }
  return dbPromise;
}

export async function getBill(id: string): Promise<StoredBill | undefined> {
  const db = await getDB();
  return db.get(STORE, id);
}

export async function saveBill(stored: StoredBill): Promise<void> {
  const db = await getDB();
  await db.put(STORE, stored);
}

export async function getAllBills(): Promise<StoredBill[]> {
  const db = await getDB();
  const all = await db.getAll(STORE);
  // Bill dates are MM-DD-YYYY — convert to YYYY-MM-DD for correct chronological sort
  const toSortKey = (d: string | null) => {
    if (!d) return "";
    const [mm, dd, yyyy] = d.split("-");
    return `${yyyy}-${mm}-${dd}`;
  };
  return all.sort((a, b) => {
    const da = toSortKey(a.bill.meta.bill_date);
    const db2 = toSortKey(b.bill.meta.bill_date);
    return da < db2 ? -1 : da > db2 ? 1 : 0;
  });
}

export async function deleteBill(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE, id);
}

export async function exportBills(): Promise<string> {
  const bills = await getAllBills();
  return JSON.stringify(bills, null, 2);
}

export async function importBills(json: string): Promise<number> {
  const bills: StoredBill[] = JSON.parse(json);
  const db = await getDB();
  const tx = db.transaction(STORE, "readwrite");
  for (const bill of bills) {
    await tx.store.put(bill);
  }
  await tx.done;
  return bills.length;
}
