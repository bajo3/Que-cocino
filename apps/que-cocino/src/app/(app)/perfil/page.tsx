import { auth } from "@/auth";
import { getPrisma } from "@/server/prisma";
import { ProfileForm } from "@/components/profile-form";

export const dynamic = "force-dynamic";
export default async function ProfilePage() { const session = await auth(); const preferences = await getPrisma().userPreferences.findUnique({ where: { userId: session!.user.id } }); return <ProfileForm name={session!.user.name ?? ""} email={session!.user.email ?? ""} initial={JSON.parse(JSON.stringify(preferences))} />; }
