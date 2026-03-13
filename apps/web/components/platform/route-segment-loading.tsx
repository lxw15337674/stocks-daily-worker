import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type RouteSegmentLoadingProps = {
  title: string;
  description: string;
};

export function RouteSegmentLoading(props: RouteSegmentLoadingProps) {
  return (
    <main className="page-shell">
      <Card>
        <CardHeader>
          <CardTitle>{props.title}</CardTitle>
          <CardDescription>{props.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-28 w-full" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Skeleton className="h-36 w-full" />
            <Skeleton className="h-36 w-full" />
            <Skeleton className="h-36 w-full" />
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
