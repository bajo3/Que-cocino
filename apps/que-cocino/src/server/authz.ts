import { auth } from "@/auth";

export async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new HttpError(401, "Tenés que iniciar sesión.");
  return session.user.id;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
