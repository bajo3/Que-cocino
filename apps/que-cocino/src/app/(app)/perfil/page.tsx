import { requirePageUser } from "@/server/authz";
import { getPrisma } from "@/server/prisma";
import { ProfileForm } from "@/components/profile-form";

export const dynamic = "force-dynamic";
export default async function ProfilePage() { const user = await requirePageUser(); const preferences = await getPrisma().userPreferences.findUnique({ where: { userId: user.id } }); return <ProfileForm name={user.name ?? ""} email={user.email ?? ""} initial={JSON.parse(JSON.stringify(preferences))} />; }
