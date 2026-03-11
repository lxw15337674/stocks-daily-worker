import type { Language } from "@/lib/i18n";
import CryptoAdminPage from "@/components/crypto/admin-page";

export default async function LocalizedCryptoAdminPage(props: {
  params: Promise<{ lang: Language }>;
}) {
  const { lang } = await props.params;

  return <CryptoAdminPage lang={lang} />;
}
