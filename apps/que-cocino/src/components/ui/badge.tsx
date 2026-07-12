import * as React from "react";
import { cn } from "@/lib/utils";
export function Badge({ className, tone = "neutral", ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: "neutral" | "green" | "amber" | "red" }) { return <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold", { "bg-muted text-muted-foreground": tone === "neutral", "bg-primary/10 text-primary": tone === "green", "bg-amber-100 text-amber-800": tone === "amber", "bg-red-100 text-red-700": tone === "red" }, className)} {...props} />; }
