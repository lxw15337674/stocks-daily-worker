import type { ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type MetricGridProps = {
  children: ReactNode;
  className?: string;
};

type MetricCardProps = {
  title: string;
  value: ReactNode;
  description?: ReactNode;
  valueClassName?: string;
};

export function MetricGrid(props: MetricGridProps) {
  return <section className={props.className ?? "grid gap-4 md:grid-cols-2 xl:grid-cols-4"}>{props.children}</section>;
}

export function MetricCard(props: MetricCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{props.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={props.valueClassName ?? "text-2xl font-semibold"}>{props.value}</div>
        {props.description ? <div className="meta mt-2">{props.description}</div> : null}
      </CardContent>
    </Card>
  );
}
