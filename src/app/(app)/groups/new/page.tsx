import { PageHeader } from "@/components/app/bits";
import { Card } from "@/components/ui/card";
import { GroupForm } from "@/components/group/group-form";

export const metadata = { title: "グループを作成" };

export default function NewGroupPage() {
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="グループを作成" description="作成したら、招待リンクを送ってメンバーを招待します。" back={{ href: "/groups", label: "グループ" }} />
      <Card className="p-5 sm:p-6">
        <GroupForm />
      </Card>
    </div>
  );
}
