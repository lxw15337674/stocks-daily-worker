import { notFound, redirect } from "next/navigation";

import { isValidReportDate } from "@/lib/date";

type ReportDatePageProps = {
  params: Promise<{ date: string }>;
};

export default async function ReportDatePage(props: ReportDatePageProps) {
  const { date: rawDate } = await props.params;
  const date = rawDate?.trim();
  if (!date || !isValidReportDate(date)) {
    notFound();
  }

  redirect(`/?date=${date}`);
}
