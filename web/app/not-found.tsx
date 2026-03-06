import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function NotFoundPage() {
  return (
    <main className="page-shell">
      <Card>
        <CardHeader>
          <CardTitle>未找到对应日报</CardTitle>
          <CardDescription>请确认日期格式为 YYYY-MM-DD，并且该交易日已经生成报告。</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/">返回首页</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
