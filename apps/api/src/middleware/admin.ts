import { createMiddleware } from "hono/factory";
import { db } from "@finances/db";
import type { AuthVariables } from "./auth";

export const requireAdmin = createMiddleware<{ Variables: AuthVariables }>(
  async (c, next) => {
    const userId = c.get("userId");
    const user = await db.user.findUnique({ where: { id: userId }, select: { role: true } });

    if (user?.role !== "admin") {
      return c.json({ error: "Acesso restrito" }, 403);
    }

    await next();
  }
);
