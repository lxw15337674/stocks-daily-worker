import Link from "next/link";
import { redirect } from "next/navigation";

import { DateLookupForm } from "@/components/date-lookup-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isValidReportDate } from "@/lib/date";

type ReportLookupPageProps = {
  searchParams: Promise<{ date?: string }>;
};

export default async function ReportLookupPage(props: ReportLookupPageProps) {
  const { date } = await props.searchParams;

  if (date && isValidReportDate(date)) {
    redirect(`/report/${date}`);
  }

  return (
    <main className="page-shell">
      <Card>
        <CardHeader>
          <CardTitle>按日期查询日报</CardTitle>
          <CardDescription>输入美东交易日（YYYY-MM-DD）跳转到对应报告。</CardDescription>
        </CardHeader>
        <CardContent>
          <DateLookupForm initialValue={date} />
          <div className="mt-4">
            <Button asChild variant="outline" size="sm">
              <Link href="/">返回首页</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
