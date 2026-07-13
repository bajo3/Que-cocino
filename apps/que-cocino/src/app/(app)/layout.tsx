import { AppShell } from "@/components/app-shell";
import { requirePageUser } from "@/server/authz";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser();
  return <AppShell userName={user.name}>{children}</AppShell>;
}
