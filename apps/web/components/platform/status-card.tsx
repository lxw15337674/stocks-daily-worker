import type { ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type StatusCardProps = {
  title: string;
  body: string;
  children?: ReactNode;
};

export function StatusCard(props: StatusCardProps) {
  return (
    <main className="page-shell">
      <Card>
        <CardHeader>
          <CardTitle>{props.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>{props.body}</p>
          {props.children}
        </CardContent>
      </Card>
    </main>
  );
}
