import type { ReactNode } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";

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
        {props.state === "ready" ? (
          props.children
        ) : (
          <Empty className="border border-dashed border-border/70 bg-background/20 py-8">
            <EmptyHeader>
              <EmptyTitle>{props.state === "loading" ? props.loadingMessage : props.emptyMessage}</EmptyTitle>
            </EmptyHeader>
          </Empty>
        )}
      </CardContent>
    </Card>
  );
}
