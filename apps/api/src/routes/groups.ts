import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { db } from "@finances/db";
import { CreateGroupSchema, UpdateGroupSchema, UpdateMemberRoleSchema } from "@finances/validations";
import { requireAuth, type AuthVariables } from "../middleware/auth";
import { getGroupRole, notifyGroupMembers } from "../lib/groups";
import { canAddGroupMember, isFamilyModuleAllowed } from "../lib/plan-limits";

const app = new Hono<{ Variables: AuthVariables }>();

app.use("*", requireAuth);

app.get("/", async (c) => {
  const userId = c.get("userId");

  const memberships = await db.groupMember.findMany({
    where: { userId },
    include: {
      group: { include: { _count: { select: { members: true } } } },
    },
  });

  return c.json(
    memberships.map((m) => ({
      id: m.group.id,
      name: m.group.name,
      ownerId: m.group.ownerId,
      inviteCode: m.group.inviteCode,
      createdAt: m.group.createdAt,
      role: m.role,
      memberCount: m.group._count.members,
    }))
  );
});

app.post("/", zValidator("json", CreateGroupSchema), async (c) => {
  const userId = c.get("userId");

  if (!(await isFamilyModuleAllowed(userId))) {
    return c.json(
      { error: "Criar grupos disponível apenas no plano Família. Faça upgrade para usar." },
      403
    );
  }

  const { name } = c.req.valid("json");

  const group = await db.$transaction(async (tx) => {
    const created = await tx.group.create({ data: { name, ownerId: userId } });
    await tx.groupMember.create({ data: { groupId: created.id, userId, role: "owner" } });
    return created;
  });

  return c.json({ ...group, role: "owner", memberCount: 1 }, 201);
});

app.get("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");

  const role = await getGroupRole(userId, id);
  if (!role) return c.json({ error: "Grupo não encontrado" }, 403);

  const group = await db.group.findUnique({
    where: { id },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { joinedAt: "asc" },
      },
    },
  });
  if (!group) return c.json({ error: "Grupo não encontrado" }, 404);

  return c.json({
    id: group.id,
    name: group.name,
    ownerId: group.ownerId,
    inviteCode: group.inviteCode,
    createdAt: group.createdAt,
    role,
    members: group.members.map((m) => ({
      userId: m.userId,
      name: m.user.name,
      email: m.user.email,
      role: m.role,
      joinedAt: m.joinedAt,
    })),
  });
});

app.patch("/:id", zValidator("json", UpdateGroupSchema), async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const data = c.req.valid("json");

  const role = await getGroupRole(userId, id);
  if (!role || !["owner", "admin"].includes(role)) {
    return c.json({ error: "Sem permissão" }, 403);
  }

  const group = await db.group.update({ where: { id }, data });
  return c.json(group);
});

app.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");

  const role = await getGroupRole(userId, id);
  if (role !== "owner") return c.json({ error: "Sem permissão" }, 403);

  await db.$transaction([
    db.financialAccount.updateMany({ where: { groupId: id }, data: { groupId: null } }),
    db.transaction.updateMany({ where: { groupId: id }, data: { groupId: null } }),
    db.budget.updateMany({ where: { groupId: id }, data: { groupId: null } }),
    db.goal.updateMany({ where: { groupId: id }, data: { groupId: null } }),
    db.group.delete({ where: { id } }),
  ]);

  return c.json({ success: true });
});

app.get("/:id/invite-link", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");

  const role = await getGroupRole(userId, id);
  if (!role || !["owner", "admin"].includes(role)) {
    return c.json({ error: "Sem permissão" }, 403);
  }

  const group = await db.group.findUnique({ where: { id }, select: { inviteCode: true } });
  if (!group) return c.json({ error: "Grupo não encontrado" }, 404);

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return c.json({ inviteLink: `${baseUrl}/groups/join/${group.inviteCode}` });
});

app.post("/join/:inviteCode", async (c) => {
  const userId = c.get("userId");
  const inviteCode = c.req.param("inviteCode");

  const group = await db.group.findUnique({ where: { inviteCode } });
  if (!group) return c.json({ error: "Convite inválido" }, 404);

  const existing = await db.groupMember.findUnique({
    where: { groupId_userId: { groupId: group.id, userId } },
  });
  if (existing) return c.json({ id: group.id, name: group.name, role: existing.role });

  if (!(await canAddGroupMember(group.id))) {
    return c.json(
      { error: "O grupo atingiu o limite de membros do plano do dono. Peça para ele fazer upgrade." },
      403
    );
  }

  await db.groupMember.create({ data: { groupId: group.id, userId, role: "member" } });

  const user = await db.user.findUnique({ where: { id: userId }, select: { name: true } });
  void notifyGroupMembers(
    group.id,
    {
      type: "group_activity",
      title: "Novo membro no grupo",
      body: `${user?.name ?? "Alguém"} entrou no grupo "${group.name}".`,
      link: `/groups/${group.id}`,
    },
    userId
  );

  return c.json({ id: group.id, name: group.name, role: "member" }, 201);
});

app.delete("/:id/members/:memberUserId", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const memberUserId = c.req.param("memberUserId");

  const role = await getGroupRole(userId, id);
  if (!role) return c.json({ error: "Grupo não encontrado" }, 403);

  const targetRole = await getGroupRole(memberUserId, id);
  if (!targetRole) return c.json({ error: "Membro não encontrado" }, 404);
  if (targetRole === "owner") return c.json({ error: "O owner não pode ser removido" }, 400);

  const isSelf = userId === memberUserId;
  if (!isSelf && !["owner", "admin"].includes(role)) {
    return c.json({ error: "Sem permissão" }, 403);
  }

  await db.groupMember.delete({ where: { groupId_userId: { groupId: id, userId: memberUserId } } });
  return c.json({ success: true });
});

app.patch(
  "/:id/members/:memberUserId",
  zValidator("json", UpdateMemberRoleSchema),
  async (c) => {
    const userId = c.get("userId");
    const id = c.req.param("id");
    const memberUserId = c.req.param("memberUserId");
    const { role: newRole } = c.req.valid("json");

    const role = await getGroupRole(userId, id);
    if (role !== "owner") return c.json({ error: "Sem permissão" }, 403);
    if (userId === memberUserId) return c.json({ error: "Não é possível alterar a própria role" }, 400);
    if (newRole === "owner") return c.json({ error: "Não é possível criar um segundo owner" }, 400);

    const member = await db.groupMember.update({
      where: { groupId_userId: { groupId: id, userId: memberUserId } },
      data: { role: newRole },
    });

    return c.json(member);
  }
);

app.get("/:id/dashboard", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const { year, month } = c.req.query();

  const role = await getGroupRole(userId, id);
  if (!role) return c.json({ error: "Grupo não encontrado" }, 403);

  const y = parseInt(year ?? new Date().getFullYear().toString());
  const m = parseInt(month ?? (new Date().getMonth() + 1).toString());
  const startDate = new Date(y, m - 1, 1);
  const endDate = new Date(y, m, 0);

  const [income, expense, byCategory] = await Promise.all([
    db.transaction.aggregate({
      where: { groupId: id, type: "income", date: { gte: startDate, lte: endDate }, isIgnored: false },
      _sum: { amount: true },
    }),
    db.transaction.aggregate({
      where: { groupId: id, type: "expense", date: { gte: startDate, lte: endDate }, isIgnored: false },
      _sum: { amount: true },
    }),
    db.transaction.groupBy({
      by: ["categoryId"],
      where: { groupId: id, type: "expense", date: { gte: startDate, lte: endDate }, isIgnored: false },
      _sum: { amount: true },
      orderBy: { _sum: { amount: "desc" } },
      take: 10,
    }),
  ]);

  const categoryIds = byCategory.map((r) => r.categoryId).filter((cid): cid is string => cid !== null);
  const categories = await db.category.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true, name: true, icon: true, color: true },
  });
  const catMap = Object.fromEntries(categories.map((cat) => [cat.id, cat]));

  const incomeAmount = Number(income._sum.amount ?? 0);
  const expenseAmount = Number(expense._sum.amount ?? 0);

  return c.json({
    year: y,
    month: m,
    income: incomeAmount,
    expense: expenseAmount,
    balance: incomeAmount - expenseAmount,
    byCategory: byCategory.map((r) => ({
      category: r.categoryId ? catMap[r.categoryId] : null,
      total: Number(r._sum.amount ?? 0),
    })),
  });
});

// ── Ranking de gamificação entre membros do grupo ─────────────────────────────

app.get("/:id/leaderboard", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");

  const role = await getGroupRole(userId, id);
  if (!role) return c.json({ error: "Grupo não encontrado" }, 403);

  const members = await db.groupMember.findMany({
    where: { groupId: id },
    include: { user: { select: { id: true, name: true } } },
  });

  const profiles = await db.gamificationProfile.findMany({
    where: { userId: { in: members.map((m) => m.userId) } },
    select: { userId: true, points: true, level: true, activeBadge: true },
  });
  const profileByUserId = Object.fromEntries(profiles.map((p) => [p.userId, p]));

  const ranking = members
    .map((m) => {
      const profile = profileByUserId[m.userId];
      return {
        userId: m.userId,
        name: m.user.name,
        points: profile?.points ?? 0,
        level: profile?.level ?? 1,
        activeBadge: profile?.activeBadge ?? null,
      };
    })
    .sort((a, b) => b.points - a.points);

  return c.json(ranking);
});

export default app;
