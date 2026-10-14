import { db } from "@finances/db";
import type { CreateCategory, UpdateCategory } from "@finances/validations";

const select = {
  id: true,
  name: true,
  icon: true,
  color: true,
  type: true,
  parentId: true,
  isSystem: true,
  userId: true,
} as const;

type CategoryRow = { id: string; name: string; type: string; parentId: string | null };

/**
 * Já existe categoria com esse nome visível pro usuário, no mesmo tipo e no
 * mesmo nível? Duas "Pets" lado a lado no select só confundem — e a de sistema
 * conta, pra ninguém recriar "Alimentação".
 */
async function nameTaken(
  userId: string,
  name: string,
  type: string,
  parentId: string | null,
  ignoreId?: string
): Promise<boolean> {
  const existing = await db.category.findFirst({
    where: {
      OR: [{ isSystem: true }, { userId }],
      type,
      parentId,
      name: { equals: name, mode: "insensitive" },
      ...(ignoreId && { id: { not: ignoreId } }),
    },
    select: { id: true },
  });
  return existing !== null;
}

export type CreateCategoryResult =
  | { ok: true; category: Awaited<ReturnType<typeof db.category.create>> }
  | { ok: false; reason: "mae_invalida" | "nome_duplicado" };

export async function createUserCategory(userId: string, data: CreateCategory): Promise<CreateCategoryResult> {
  let parent: CategoryRow | null = null;
  if (data.parentId) {
    parent = await db.category.findFirst({
      where: { id: data.parentId, OR: [{ isSystem: true }, { userId }] },
      select: { id: true, name: true, type: true, parentId: true },
    });
    // Mãe de outro usuário, de outro tipo, ou que já é subcategoria: a tela
    // só mostra dois níveis (principal → sub), um terceiro sumiria do select.
    if (!parent || parent.type !== data.type || parent.parentId !== null) {
      return { ok: false, reason: "mae_invalida" };
    }
  }

  if (await nameTaken(userId, data.name, data.type, parent?.id ?? null)) {
    return { ok: false, reason: "nome_duplicado" };
  }

  const category = await db.category.create({
    data: {
      userId,
      name: data.name,
      type: data.type,
      icon: data.icon ?? null,
      color: data.color ?? null,
      parentId: parent?.id ?? null,
      isSystem: false,
    },
    select,
  });
  return { ok: true, category } as CreateCategoryResult;
}

export type UpdateCategoryResult =
  | { ok: true; category: Awaited<ReturnType<typeof db.category.update>> }
  | { ok: false; reason: "nao_encontrada" | "nome_duplicado" };

export async function updateUserCategory(
  userId: string,
  id: string,
  data: UpdateCategory
): Promise<UpdateCategoryResult> {
  // `userId` no filtro: categoria de sistema (userId null) ou de outra pessoa
  // simplesmente não é encontrada.
  const current = await db.category.findFirst({
    where: { id, userId, isSystem: false },
    select: { id: true, name: true, type: true, parentId: true },
  });
  if (!current) return { ok: false, reason: "nao_encontrada" };

  if (data.name && (await nameTaken(userId, data.name, current.type, current.parentId, id))) {
    return { ok: false, reason: "nome_duplicado" };
  }

  const category = await db.category.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.icon !== undefined && { icon: data.icon }),
      ...(data.color !== undefined && { color: data.color }),
    },
    select,
  });
  return { ok: true, category } as UpdateCategoryResult;
}

export type DeleteCategoryResult =
  | { ok: true; uncategorizedTransactions: number }
  | { ok: false; reason: "nao_encontrada" | "tem_subcategorias" | "usada_em_orcamento"; count?: number };

/**
 * Exclui uma categoria do usuário. Transações e contas recorrentes que a
 * usavam ficam "Sem categoria" — o lançamento continua, só perde o rótulo.
 * Orçamento não: sem a categoria ele passaria a somar *todos* os gastos e
 * mudaria de sentido calado, então a exclusão é recusada até o usuário
 * ajustar o orçamento.
 */
export async function deleteUserCategory(userId: string, id: string): Promise<DeleteCategoryResult> {
  const current = await db.category.findFirst({ where: { id, userId, isSystem: false }, select: { id: true } });
  if (!current) return { ok: false, reason: "nao_encontrada" };

  const [children, budgets] = await Promise.all([
    db.category.count({ where: { parentId: id } }),
    db.budget.count({ where: { categoryId: id } }),
  ]);
  if (children > 0) return { ok: false, reason: "tem_subcategorias", count: children };
  if (budgets > 0) return { ok: false, reason: "usada_em_orcamento", count: budgets };

  const [transactions] = await db.$transaction([
    db.transaction.updateMany({ where: { categoryId: id }, data: { categoryId: null } }),
    db.recurringBill.updateMany({ where: { categoryId: id }, data: { categoryId: null } }),
    db.category.delete({ where: { id } }),
  ]);
  return { ok: true, uncategorizedTransactions: transactions.count };
}
