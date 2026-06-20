import { db } from "@finances/db";
import { sendNotification, type NotificationInput } from "./notifications";

export async function getUserGroupIds(userId: string): Promise<string[]> {
  const memberships = await db.groupMember.findMany({
    where: { userId },
    select: { groupId: true },
  });
  return memberships.map((m) => m.groupId);
}

export async function getGroupRole(userId: string, groupId: string): Promise<string | null> {
  const membership = await db.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
  });
  return membership?.role ?? null;
}

export async function hasGroupRole(
  userId: string,
  groupId: string,
  allowed: string[]
): Promise<boolean> {
  const role = await getGroupRole(userId, groupId);
  return role !== null && allowed.includes(role);
}

export async function notifyGroupMembers(
  groupId: string,
  input: NotificationInput,
  excludeUserId?: string
) {
  const members = await db.groupMember.findMany({
    where: { groupId, ...(excludeUserId && { userId: { not: excludeUserId } }) },
    select: { userId: true },
  });

  await Promise.all(members.map((m) => sendNotification(m.userId, input)));
}
