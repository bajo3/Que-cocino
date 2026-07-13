"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { ChefHat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/form-controls";

type Fields = { name: string; email: string; password: string };
export default function RegisterPage() {
  const router = useRouter(); const [error, setError] = useState(""); const { register, handleSubmit, formState: { isSubmitting } } = useForm<Fields>();
  const submit = handleSubmit(async (values) => { setError(""); const response = await fetch("/api/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(values) }); const data = await response.json(); if (!response.ok) return setError(data.error ?? "No pudimos crear la cuenta."); const result = await signIn("credentials", { email: values.email, password: values.password, redirect: false }); if (result?.error) return setError("La cuenta fue creada, pero no pudimos iniciar sesión."); router.push("/"); router.refresh(); });
  return <main className="grid min-h-dvh place-items-center px-4 py-10"><div className="w-full max-w-md"><div className="mb-7 text-center"><span className="mx-auto mb-4 grid size-16 place-items-center rounded-3xl bg-primary text-primary-foreground shadow-lg"><ChefHat className="size-8" /></span><h1 className="text-4xl font-extrabold tracking-[-.05em]">Qué Cocino</h1><p className="mt-2 text-muted-foreground">Creá tu cocina personal.</p></div><Card><CardContent className="p-6 sm:p-7"><form onSubmit={submit} className="space-y-4"><div><Label htmlFor="name">Nombre</Label><Input id="name" autoComplete="name" {...register("name", { required: true, minLength: 2 })} /></div><div><Label htmlFor="email">Email</Label><Input id="email" type="email" autoComplete="email" {...register("email", { required: true })} /></div><div><Label htmlFor="password">Contraseña</Label><Input id="password" type="password" autoComplete="new-password" {...register("password", { required: true, minLength: 8 })} /></div>{error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">{error}</p>}<Button className="w-full" size="lg" disabled={isSubmitting}>{isSubmitting ? "Creando…" : "Crear mi cuenta"}</Button></form><p className="mt-5 text-center text-sm text-muted-foreground">¿Ya tenés cuenta? <Link href="/login" className="font-semibold text-primary hover:underline">Ingresar</Link></p></CardContent></Card></div></main>;
}
