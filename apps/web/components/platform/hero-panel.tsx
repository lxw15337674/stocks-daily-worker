import type { ReactNode } from "react";

import { Card, CardHeader, CardTitle } from "@/components/ui/card";

type HeroPanelProps = {
  eyebrow?: string;
  title: string;
  summary?: ReactNode;
  badges?: ReactNode;
  children?: ReactNode;
};

export function HeroPanel(props: HeroPanelProps) {
  return (
    <Card className="hero-card">
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            {props.eyebrow ? <p className="eyebrow">{props.eyebrow}</p> : null}
            <CardTitle className="mt-2 text-3xl">{props.title}</CardTitle>
            {props.summary ? <div className="hero-summary">{props.summary}</div> : null}
          </div>
          {props.badges ? <div className="flex flex-wrap gap-2">{props.badges}</div> : null}
        </div>
        {props.children}
      </CardHeader>
    </Card>
  );
}
