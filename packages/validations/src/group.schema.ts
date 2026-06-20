import { z } from "zod";

export const GroupRoleSchema = z.enum(["owner", "admin", "member", "viewer"]);

export const CreateGroupSchema = z.object({
  name: z.string().min(1, "Nome obrigatório").max(100),
});

export const UpdateGroupSchema = CreateGroupSchema.partial();

export const UpdateMemberRoleSchema = z.object({
  role: GroupRoleSchema,
});

export type CreateGroup = z.infer<typeof CreateGroupSchema>;
export type UpdateGroup = z.infer<typeof UpdateGroupSchema>;
export type GroupRole = z.infer<typeof GroupRoleSchema>;
export type UpdateMemberRole = z.infer<typeof UpdateMemberRoleSchema>;
