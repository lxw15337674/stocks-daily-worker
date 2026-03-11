import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function NotFoundPage() {
  return (
    <main className="page-shell">
      <Card>
        <CardHeader>
          <CardTitle>Page not found</CardTitle>
          <CardDescription>页面不存在，或者对应日期的日报尚未生成。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button asChild className="w-full">
            <Link href="/zh">打开中文首页</Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href="/en">Open English home</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
