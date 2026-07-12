import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatQuantity(value: number, unit: string) {
  return `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(value)} ${unit}`;
}

export function formatDate(value?: string | Date | null) {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}
