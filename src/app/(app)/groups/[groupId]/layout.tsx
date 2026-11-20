import type { ReactNode } from "react";
import { GroupChrome } from "@/components/group/group-chrome";
import { getGroupContext } from "@/lib/queries";

export default async function GroupLayout({ children, params }: { children: ReactNode; params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const { group, activeMembers, people } = await getGroupContext(groupId);
  return (
    <>
      <GroupChrome
        group={{ id: group.id, name: group.name, icon: group.icon, color: group.color }}
        memberAvatars={activeMembers.map((m) => ({
          name: people[m.user_id]?.display_name ?? "?",
          color: people[m.user_id]?.avatar_color ?? "#9aa5a0",
        }))}
      />
      {children}
    </>
  );
}
