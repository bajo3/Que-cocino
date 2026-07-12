import * as React from "react";
import { cn } from "@/lib/utils";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default" | "secondary" | "outline" | "ghost" | "danger"; size?: "sm" | "md" | "lg" };
export function Button({ className, variant = "default", size = "md", ...props }: Props) {
  return <button className={cn("inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50", { "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90": variant === "default", "bg-secondary text-secondary-foreground hover:bg-secondary/75": variant === "secondary", "border border-border bg-card hover:bg-muted": variant === "outline", "hover:bg-muted": variant === "ghost", "bg-destructive text-white hover:bg-destructive/90": variant === "danger", "h-9 px-3 text-sm": size === "sm", "h-11 px-4 text-sm": size === "md", "h-13 px-6 text-base": size === "lg" }, className)} {...props} />;
}
