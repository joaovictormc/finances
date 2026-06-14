import { createMiddleware } from "hono/factory";
import { auth } from "../lib/auth";

export type AuthVariables = {
  userId: string;
  sessionId: string;
};

export const requireAuth = createMiddleware<{ Variables: AuthVariables }>(
  async (c, next) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });

    if (!session) {
      return c.json({ error: "Não autenticado" }, 401);
    }

    c.set("userId", session.user.id);
    c.set("sessionId", session.session.id);
    await next();
  }
);
