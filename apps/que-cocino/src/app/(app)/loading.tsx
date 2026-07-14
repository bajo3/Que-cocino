import { Skeleton } from "@/components/ui/skeleton";

export default function AppLoading() {
  return <div className="space-y-6" aria-label="Cargando sección">
    <div className="space-y-3"><Skeleton className="h-4 w-28" /><Skeleton className="h-9 w-64" /><Skeleton className="h-5 w-full max-w-xl" /></div>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Skeleton className="h-44" /><Skeleton className="h-44" /><Skeleton className="h-44" /></div>
    <Skeleton className="h-56 w-full" />
  </div>;
}
