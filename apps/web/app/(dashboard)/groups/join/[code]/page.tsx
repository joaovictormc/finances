import { redirect } from "next/navigation";
import { serverApiPost } from "@/lib/api-server";

export default async function JoinGroupPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  let groupId: string | null = null;
  try {
    const result = await serverApiPost<{ id: string }>(`/api/groups/join/${code}`);
    groupId = result.id;
  } catch {
    redirect("/groups?error=invite-invalido");
  }

  redirect(`/groups/${groupId}`);
}
