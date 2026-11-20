import { Card, CardHeader } from "@/components/ui/card";
import { GroupForm } from "@/components/group/group-form";
import { InvitePanel } from "@/components/group/invite-panel";
import { MemberManager } from "@/components/group/member-manager";
import { getGroupBalances, getGroupContext, getInvitations, getJoinRequests, getRequesterNames } from "@/lib/queries";

export const metadata = { title: "メンバー" };

export default async function MembersPage({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { groupId } = await params;
  const { created } = await searchParams;
  const { supabase, user, group, members, me, people, isAdmin } = await getGroupContext(groupId);
  const [invitations, requests, balances] = await Promise.all([
    getInvitations(supabase, groupId),
    isAdmin ? getJoinRequests(supabase, groupId) : Promise.resolve([]),
    getGroupBalances(supabase, groupId),
  ]);
  const requesterNames = await getRequesterNames(supabase, requests.map((r) => r.user_id));

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start [&>*]:min-w-0">
      <div className="space-y-4">
        <InvitePanel
          groupId={groupId}
          groupName={group.name}
          invitations={invitations}
          meId={user.id}
          isAdmin={isAdmin}
          justCreated={created === "1"}
          approvalRequired={group.join_approval_required}
        />
        {isAdmin && (
          <Card>
            <CardHeader title="グループ設定" description="管理者のみ変更できます" />
            <div className="px-5 pb-5 pt-4">
              <GroupForm group={group} />
            </div>
          </Card>
        )}
      </div>
      <div className="space-y-4">
        <MemberManager
          groupId={groupId}
          groupName={group.name}
          meId={user.id}
          myRole={me.role}
          members={members}
          people={people}
          requests={requests}
          requesterNames={requesterNames}
          balances={Object.fromEntries(balances.map((b) => [b.user_id, b.effective_balance]))}
        />
      </div>
    </div>
  );
}
