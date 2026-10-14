import { z } from "zod";

// Categoria personalizada do usuário. As de sistema (seed) não passam por aqui:
// não podem ser criadas nem alteradas pela API.
export const CategoryTypeSchema = z.enum(["income", "expense"]);

const name = z.string().trim().min(1, "Informe o nome da categoria").max(40, "Nome com no máximo 40 caracteres");
// Um emoji (alguns ocupam vários code units, como 👨‍👩‍👧 ou bandeiras).
const icon = z.string().trim().max(16, "Use um emoji como ícone").optional().nullable();
const color = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida")
  .optional()
  .nullable();

export const CreateCategorySchema = z.object({
  name,
  type: CategoryTypeSchema,
  icon,
  color,
  /** Categoria principal (de sistema ou do usuário) — vira subcategoria dela. */
  parentId: z.string().min(1).optional().nullable(),
});

// Tipo e categoria-mãe ficam fixos depois de criada: mudar movia transações
// já lançadas de "gasto" pra "receita", ou de um grupo do gráfico pra outro.
export const UpdateCategorySchema = z.object({ name: name.optional(), icon, color });

export type CreateCategory = z.infer<typeof CreateCategorySchema>;
export type UpdateCategory = z.infer<typeof UpdateCategorySchema>;
