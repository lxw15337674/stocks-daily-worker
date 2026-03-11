import type { ReactNode } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type ArchiveTableCardProps = {
  title: string;
  description: string;
  toolbar?: ReactNode;
  state: "loading" | "empty" | "ready";
  loadingMessage: string;
  emptyMessage: string;
  children?: ReactNode;
};

export function ArchiveTableCard(props: ArchiveTableCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>{props.title}</CardTitle>
        <CardDescription>{props.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {props.toolbar}
        {props.state === "loading" ? (
          <p className="empty">{props.loadingMessage}</p>
        ) : props.state === "empty" ? (
          <p className="empty">{props.emptyMessage}</p>
        ) : (
          props.children
        )}
      </CardContent>
    </Card>
  );
}
