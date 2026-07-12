"use client";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) { return <Card className="mx-auto mt-20 max-w-lg"><CardContent className="py-10 text-center"><AlertTriangle className="mx-auto mb-4 size-10 text-amber-600" /><h2 className="text-xl font-bold">No pudimos cargar tu cocina</h2><p className="my-3 text-sm text-muted-foreground">Revisá la conexión a la base de datos e intentá nuevamente.</p><Button onClick={reset}>Reintentar</Button></CardContent></Card>; }
