import { leftoverUpdateSchema } from "@/schemas/leftovers";
import { apiError, readJson } from "@/server/api";
import { HttpError, requireUserId } from "@/server/authz";
import { getPrisma } from "@/server/prisma";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId(); const { id } = await params; const input = leftoverUpdateSchema.parse(await readJson(request)); const db = getPrisma();
    const current = await db.leftover.findFirst({ where: { id, userId } });
    if (!current) throw new HttpError(404, "La sobra no existe.");
    const leftover = await db.leftover.update({ where: { id }, data: { ...input, expirationDate: input.expirationDate === undefined ? undefined : input.expirationDate ? new Date(input.expirationDate) : null } });
    return Response.json({ leftover });
  } catch (error) { return apiError(error); }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId(); const { id } = await params; const deleted = await getPrisma().leftover.deleteMany({ where: { id, userId } });
    if (!deleted.count) throw new HttpError(404, "La sobra no existe.");
    return new Response(null, { status: 204 });
  } catch (error) { return apiError(error); }
}
