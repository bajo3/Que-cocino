import { Skeleton } from "@/components/ui/skeleton";
export default function Loading() { return <div className="space-y-6"><Skeleton className="h-20 w-2/3" /><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Skeleton className="h-48" /><Skeleton className="h-48" /><Skeleton className="h-48" /></div></div>; }
