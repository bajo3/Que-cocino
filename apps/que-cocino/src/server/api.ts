import { ZodError } from "zod";
import { HttpError } from "@/server/authz";

export function apiError(error: unknown) {
  if (error instanceof HttpError) return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof ZodError) return Response.json({ error: "Revisá los datos ingresados.", issues: error.issues }, { status: 400 });
  console.error(error);
  return Response.json({ error: "Ocurrió un error inesperado. Intentá nuevamente." }, { status: 500 });
}

export async function readJson(request: Request) {
  const size = Number(request.headers.get("content-length") ?? 0);
  if (size > 50_000) throw new HttpError(413, "La solicitud es demasiado grande.");
  return request.json() as Promise<unknown>;
}
