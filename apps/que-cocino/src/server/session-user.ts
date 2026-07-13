type SessionUser = {
  id?: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

export function getAuthenticatedUser(
  session: { user?: SessionUser | null } | null | undefined,
) {
  const id = session?.user?.id;
  if (!id) return null;

  return { ...session.user, id };
}
