import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getAuthenticatedUser } from "@/server/session-user";

export async function requirePageUser() {
  const user = getAuthenticatedUser(await auth());
  if (!user) redirect("/login");
  return user;
}

export async function requireUserId() {
  const user = getAuthenticatedUser(await auth());
  if (!user) throw new HttpError(401, "Tenés que iniciar sesión.");
  return user.id;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
