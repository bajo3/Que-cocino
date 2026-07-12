"use client";
import { X } from "lucide-react";
import { Button } from "./button";

export function Modal({ open, onClose, title, description, children }: { open: boolean; onClose: () => void; title: string; description?: string; children: React.ReactNode }) {
  if (!open) return null;
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/35 p-0 backdrop-blur-[2px] sm:items-center sm:p-6" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section role="dialog" aria-modal="true" aria-label={title} className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-border bg-card p-5 shadow-2xl sm:max-w-2xl sm:rounded-3xl sm:p-6">
      <div className="mb-5 flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold">{title}</h2>{description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}</div><Button type="button" variant="ghost" size="sm" aria-label="Cerrar" onClick={onClose}><X className="size-4" /></Button></div>
      {children}
    </section>
  </div>;
}
