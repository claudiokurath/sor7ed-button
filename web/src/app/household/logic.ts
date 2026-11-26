export type Assignee = "A" | "B" | "shared";
export type Frequency = "daily" | "weekly" | "monthly" | "yearly";

export interface Responsibility {
  id: string;
  name: string;
  assignee: Assignee;
  frequency: Frequency;
  createdAt: number;
}

export interface Household {
  version: 1;
  names: { A: string; B: string };
  items: Responsibility[];
}

export const STORAGE_KEY = "sor7ed-household-v1";
const LEGACY_KEY = "load-tasks";

export const FREQ: Record<Frequency, { label: string; perWeek: number; formula: string }> = {
  daily: { label: "Daily", perWeek: 7, formula: "7 per week" },
  weekly: { label: "Weekly", perWeek: 1, formula: "1 per week" },
  monthly: { label: "Monthly", perWeek: 12 / 52, formula: "12 / 52 per week" },
  yearly: { label: "Yearly", perWeek: 1 / 52, formula: "1 / 52 per week" },
};

export const FREQ_ORDER: Frequency[] = ["daily", "weekly", "monthly", "yearly"];
export const emptyHousehold = (): Household => ({ version: 1, names: { A: "", B: "" }, items: [] });
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

const LEGACY_WEIGHT: Record<string, Frequency> = {
  "0.5": "daily",
  "1": "weekly",
  "2": "monthly",
  "4": "yearly",
};

const isAssignee = (value: unknown): value is Assignee =>
  value === "A" || value === "B" || value === "shared";
const isFrequency = (value: unknown): value is Frequency =>
  typeof value === "string" && value in FREQ;

export type LoadResult = { data: Household; error: string | null; migrated: number };

export function loadHousehold(): LoadResult {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return { data: emptyHousehold(), error: "Browser storage is unavailable. Changes will not survive a reload.", migrated: 0 };
  }

  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      const items: Responsibility[] = Array.isArray(parsed.items)
        ? parsed.items
            .filter((item: any) => item && typeof item.name === "string" && item.name.trim())
            .map((item: any) => ({
              id: String(item.id ?? uid()),
              name: item.name,
              assignee: isAssignee(item.assignee) ? item.assignee : "shared",
              frequency: isFrequency(item.frequency) ? item.frequency : "weekly",
              createdAt: Number(item.createdAt) || Date.now(),
            }))
        : [];
      return {
        data: {
          version: 1,
          names: { A: String(parsed.names?.A ?? ""), B: String(parsed.names?.B ?? "") },
          items,
        },
        error: null,
        migrated: 0,
      };
    } catch {
      return {
        data: emptyHousehold(),
        error: "Saved data could not be read. Your previous data was left untouched.",
        migrated: 0,
      };
    }
  }

  try {
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (!legacy) return { data: emptyHousehold(), error: null, migrated: 0 };
    const parsed = JSON.parse(legacy);
    if (!Array.isArray(parsed)) return { data: emptyHousehold(), error: null, migrated: 0 };
    const items: Responsibility[] = parsed
      .filter((item: any) => item && typeof item.name === "string" && item.name.trim())
      .map((item: any) => ({
        id: String(item.id ?? uid()),
        name: String(item.name).trim(),
        assignee: isAssignee(item.assignee) ? item.assignee : "shared",
        frequency: LEGACY_WEIGHT[String(Number(item.weight))] ?? "weekly",
        createdAt: Number(item.id) || Date.now(),
      }));
    return { data: { ...emptyHousehold(), items }, error: null, migrated: items.length };
  } catch {
    return { data: emptyHousehold(), error: "Older saved responsibilities could not be read.", migrated: 0 };
  }
}

export function saveHousehold(household: Household): string | null {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(household));
    return null;
  } catch (error) {
    return error instanceof DOMException && /quota/i.test(error.name)
      ? "Browser storage is full. The latest change is visible but was not saved."
      : "Could not save to this browser. The latest change is visible but may be lost after a reload.";
  }
}

export function computeLoad(items: Responsibility[]) {
  let a = 0;
  let b = 0;
  for (const item of items) {
    const weight = FREQ[item.frequency].perWeek;
    if (item.assignee === "A") a += weight;
    else if (item.assignee === "B") b += weight;
    else {
      a += weight / 2;
      b += weight / 2;
    }
  }
  const total = a + b;
  return { a, b, total, shareA: total ? a / total : 0.5, diff: Math.abs(a - b) };
}

export const fmt = (value: number) => (value === 0 ? "0" : value < 10 ? value.toFixed(2) : value.toFixed(1));

export const EXAMPLE: Array<Omit<Responsibility, "id" | "createdAt">> = [
  { name: "Cook dinner", assignee: "A", frequency: "daily" },
  { name: "Dishes and kitchen reset", assignee: "B", frequency: "daily" },
  { name: "School run", assignee: "shared", frequency: "daily" },
  { name: "Plan the weekly meal list", assignee: "A", frequency: "weekly" },
  { name: "Laundry", assignee: "A", frequency: "weekly" },
  { name: "Bins out", assignee: "B", frequency: "weekly" },
  { name: "Pay household bills", assignee: "B", frequency: "monthly" },
  { name: "Track school forms and trips", assignee: "A", frequency: "monthly" },
  { name: "Car service and MOT", assignee: "B", frequency: "yearly" },
  { name: "Birthday gifts for family", assignee: "A", frequency: "yearly" },
];
