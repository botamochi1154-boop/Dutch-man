import { Skeleton } from "@/components/ui/misc";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="読み込み中">
      <Skeleton className="mb-2 h-4 w-28" />
      <Skeleton className="mb-6 h-7 w-56" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-44 rounded-2xl lg:col-span-2" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-1">
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
        </div>
      </div>
      <Skeleton className="mb-3 mt-8 h-4 w-24" />
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-16 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
