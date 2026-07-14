import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getAuthenticatedUser } from "@/server/session-user";

const getPageUser = cache(async () => {
  const user = getAuthenticatedUser(await auth());
  if (!user) redirect("/login");
  return user;
});

export async function requirePageUser() {
  return getPageUser();
}

export async function requireUserId() {
  const user = getAuthenticatedUser(await auth());
  if (!user) throw new HttpError(401, "Tenés que iniciar sesión.");
  return user.id;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
