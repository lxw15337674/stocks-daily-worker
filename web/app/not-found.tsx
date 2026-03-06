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
        <CardContent className="space-y-2">
          <Button asChild className="w-full">
            <Link href="/">返回首页</Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href="/archive">历史日报</Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href="/stocks">股票管理</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
