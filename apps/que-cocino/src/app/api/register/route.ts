import { hash } from "bcryptjs";
import { registrationSchema } from "@/schemas/auth";
import { apiError, readJson } from "@/server/api";
import { HttpError } from "@/server/authz";
import { getPrisma } from "@/server/prisma";

export async function POST(request: Request) {
  try {
    const input = registrationSchema.parse(await readJson(request));
    const db = getPrisma(); const email = input.email.toLocaleLowerCase();
    const exists = await db.user.findUnique({ where: { email }, select: { id: true } });
    if (exists) throw new HttpError(409, "Ya existe una cuenta con ese email.");
    const user = await db.user.create({ data: { name: input.name, email, passwordHash: await hash(input.password, 12), preferences: { create: { householdSize: 2 } } }, select: { id: true, name: true, email: true } });
    return Response.json({ user }, { status: 201 });
  } catch (error) { return apiError(error); }
}
