import type { LucideIcon } from "lucide-react";
import { Briefcase, Store, Palette, Laptop2, Wrench, Receipt } from "lucide-react";

export const CLIENT_CATEGORIES = [
  { value: "consultoria", label: "Consultoría y servicios profesionales" },
  { value: "comercio", label: "Comercio y ventas" },
  { value: "diseno", label: "Diseño y creatividad" },
  { value: "tecnologia", label: "Tecnología y marketing digital" },
  { value: "taller", label: "Taller y manufactura" },
  { value: "otro", label: "Otro" },
] as const;

export type ClientCategory = (typeof CLIENT_CATEGORIES)[number]["value"];

const CLIENT_CATEGORY_ICONS: Record<string, LucideIcon> = {
  consultoria: Briefcase,
  comercio: Store,
  diseno: Palette,
  tecnologia: Laptop2,
  taller: Wrench,
};

export function clientCategoryIcon(category?: string | null): LucideIcon {
  if (!category) return Receipt;
  return CLIENT_CATEGORY_ICONS[category] ?? Receipt;
}
