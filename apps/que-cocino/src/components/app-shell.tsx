"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { ChefHat, CircleUserRound, ClipboardList, CookingPot, History, Home, LogOut, PackageOpen, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const links = [{ href: "/", label: "Inicio", icon: Home }, { href: "/despensa", label: "Mi despensa", icon: PackageOpen }, { href: "/cocinar", label: "Qué cocino", icon: CookingPot }, { href: "/compras", label: "Compras", icon: ClipboardList }, { href: "/historial", label: "Historial", icon: History }, { href: "/perfil", label: "Perfil", icon: CircleUserRound }];

export function AppShell({ userName, children }: { userName?: string | null; children: React.ReactNode }) {
  const path = usePathname();
  return <div className="min-h-dvh bg-background text-foreground">
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-card/95 p-5 backdrop-blur lg:flex">
      <Link href="/" prefetch className="mb-8 flex items-center gap-3 px-2"><span className="grid size-11 place-items-center rounded-2xl bg-primary text-primary-foreground"><ChefHat className="size-6" /></span><span><strong className="block text-lg tracking-tight">Qué Cocino</strong><small className="text-muted-foreground">Tu cocina, sin vueltas</small></span></Link>
      <nav className="space-y-1">{links.map(({ href, label, icon: Icon }) => <Link key={href} href={href} prefetch className={cn("flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold transition", path === href || href !== "/" && path.startsWith(href) ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")}><Icon className="size-5" />{label}</Link>)}</nav>
      <div className="mt-auto rounded-2xl bg-muted p-3"><p className="truncate text-sm font-bold">{userName || "Mi cocina"}</p><Button variant="ghost" size="sm" className="mt-1 w-full justify-start px-0 text-muted-foreground" onClick={() => signOut({ callbackUrl: "/login" })}><LogOut className="size-4" />Cerrar sesión</Button></div>
    </aside>
    <main className="mx-auto min-h-dvh max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:ml-64 lg:px-10 lg:pb-10 lg:pt-9">{children}</main>
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 px-2 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur lg:hidden"><div className="mx-auto grid max-w-lg grid-cols-5">{links.slice(0, 5).map(({ href, label, icon: Icon }) => <Link key={href} href={href} prefetch className={cn("flex min-w-0 flex-col items-center gap-1 rounded-xl px-1 py-1.5 text-[10px] font-semibold", path === href || href !== "/" && path.startsWith(href) ? "text-primary" : "text-muted-foreground")}><Icon className="size-5" /><span className="truncate">{label}</span></Link>)}</div></nav>
    <Link href="/despensa?add=true" className="fixed bottom-24 right-4 z-30 grid size-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg lg:hidden" aria-label="Agregar alimento"><Plus /></Link>
  </div>;
}
