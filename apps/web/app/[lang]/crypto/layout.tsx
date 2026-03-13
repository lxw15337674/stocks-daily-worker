import type { Metadata } from "next";

import type { Language } from "@/lib/i18n";
import { buildAssetLayoutMetadata } from "@/lib/route-metadata";

export async function generateMetadata(props: {
  params: Promise<{ lang: Language }>;
}): Promise<Metadata> {
  const { lang } = await props.params;
  return buildAssetLayoutMetadata(lang, "crypto");
}

export default function CryptoLayout(props: { children: React.ReactNode }) {
  return props.children;
}
