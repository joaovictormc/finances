import { Hono } from "hono";
import { CHANGELOG_PLATFORMS, type ChangelogPlatform } from "@finances/validations";
import { requireAuth, type AuthVariables } from "../middleware/auth";
import { listPublishedReleases, markChangelogSeen, unseenReleases } from "../lib/changelog";

/** Novidades publicadas, para a tela "Novidades" e a janela "O que há de novo". */
const app = new Hono<{ Variables: AuthVariables }>();

app.use("*", requireAuth);

/** ?platform=web|android|ios: só o que vale para quem pergunta. */
function platformParam(value: string | undefined): ChangelogPlatform | undefined {
  return (CHANGELOG_PLATFORMS as readonly string[]).includes(value ?? "") ? (value as ChangelogPlatform) : undefined;
}

app.get("/", async (c) => c.json(await listPublishedReleases(platformParam(c.req.query("platform")))));

app.get("/unseen", async (c) =>
  c.json(await unseenReleases(c.get("userId"), platformParam(c.req.query("platform"))))
);

app.post("/seen", async (c) => {
  await markChangelogSeen(c.get("userId"));
  return c.json({ success: true });
});

export default app;
