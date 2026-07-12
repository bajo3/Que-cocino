export function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: React.ReactNode }) {
  return <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div>{eyebrow && <p className="mb-1 text-sm font-bold uppercase tracking-[.18em] text-primary">{eyebrow}</p>}<h1 className="text-3xl font-extrabold tracking-[-.04em] sm:text-4xl">{title}</h1>{description && <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">{description}</p>}</div>{action}</header>;
}
