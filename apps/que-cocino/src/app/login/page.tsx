"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { ChefHat, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/form-controls";

type LoginFields = { email: string; password: string };
export default function LoginPage() {
  const router = useRouter(); const [error, setError] = useState(""); const { register, handleSubmit, formState: { isSubmitting } } = useForm<LoginFields>({ defaultValues: { email: "demo@quecocino.app", password: "demo1234" } });
  const submit = handleSubmit(async (values) => { setError(""); const result = await signIn("credentials", { ...values, redirect: false }); if (result?.error) setError("Email o contraseña incorrectos."); else { router.push("/"); router.refresh(); } });
  return <main className="grid min-h-dvh place-items-center px-4 py-10"><div className="w-full max-w-md"><div className="mb-7 text-center"><span className="mx-auto mb-4 grid size-16 place-items-center rounded-3xl bg-primary text-primary-foreground shadow-lg"><ChefHat className="size-8" /></span><h1 className="text-4xl font-extrabold tracking-[-.05em]">Qué Cocino</h1><p className="mt-2 text-muted-foreground">Cociná mejor con lo que ya tenés.</p></div><Card><CardContent className="p-6 sm:p-7"><div className="mb-5 flex items-center gap-2 rounded-2xl bg-secondary px-4 py-3 text-sm text-secondary-foreground"><Sparkles className="size-4 shrink-0" />La cuenta demo ya está lista para probar el flujo completo.</div><form onSubmit={submit} className="space-y-4"><div><Label htmlFor="email">Email</Label><Input id="email" type="email" autoComplete="email" {...register("email", { required: true })} /></div><div><Label htmlFor="password">Contraseña</Label><Input id="password" type="password" autoComplete="current-password" {...register("password", { required: true, minLength: 8 })} /></div>{error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">{error}</p>}<Button className="w-full" size="lg" disabled={isSubmitting}>{isSubmitting ? "Ingresando…" : "Entrar a mi cocina"}</Button></form><p className="mt-5 text-center text-sm text-muted-foreground">¿Primera vez? <Link href="/register" className="font-semibold text-primary hover:underline">Crear una cuenta</Link></p></CardContent></Card><p className="mt-5 text-center text-xs leading-5 text-muted-foreground">La información nutricional es estimada y no reemplaza consejo profesional.</p></div></main>;
}
