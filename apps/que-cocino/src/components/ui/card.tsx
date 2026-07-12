import * as React from "react";
import { cn } from "@/lib/utils";
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) { return <div className={cn("rounded-3xl border border-border bg-card text-card-foreground shadow-[0_1px_2px_rgba(34,53,37,.04),0_12px_28px_rgba(34,53,37,.05)]", className)} {...props} />; }
export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) { return <div className={cn("p-5 pb-2 sm:p-6 sm:pb-2", className)} {...props} />; }
export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) { return <h2 className={cn("text-lg font-bold tracking-tight", className)} {...props} />; }
export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) { return <p className={cn("mt-1 text-sm leading-6 text-muted-foreground", className)} {...props} />; }
export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) { return <div className={cn("p-5 pt-3 sm:p-6 sm:pt-3", className)} {...props} />; }
