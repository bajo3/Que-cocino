import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { z } from "zod";
import { getPrisma } from "@/server/prisma";

const credentialsSchema = z.object({ email: z.string().email(), password: z.string().min(8).max(200) });

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [Credentials({
    credentials: { email: { label: "Email", type: "email" }, password: { label: "Contraseña", type: "password" } },
    authorize: async (raw) => {
      const parsed = credentialsSchema.safeParse(raw);
      if (!parsed.success) return null;
      const user = await getPrisma().user.findUnique({ where: { email: parsed.data.email.toLocaleLowerCase() } });
      if (!user?.passwordHash || !(await compare(parsed.data.password, user.passwordHash))) return null;
      return { id: user.id, email: user.email, name: user.name, image: user.image };
    },
  })],
  callbacks: {
    jwt: ({ token, user }) => { if (user?.id) token.userId = user.id; return token; },
    session: ({ session, token }) => { if (session.user && token.userId) session.user.id = token.userId; return session; },
  },
});
