import { getFixedT, type Language } from "@/lib/i18n";

export type AssetKey = "stocks" | "crypto" | "gold" | "bonds";

type AssetRegistryItem = {
  key: AssetKey;
  enabled: boolean;
};

export type AssetDescriptor = AssetRegistryItem & {
  label: string;
  description: string;
};

export const ASSET_REGISTRY: AssetRegistryItem[] = [
  {
    key: "stocks",
    enabled: true
  },
  {
    key: "crypto",
    enabled: true
  },
  {
    key: "gold",
    enabled: false
  },
  {
    key: "bonds",
    enabled: false
  }
];

function localizeAsset(asset: AssetRegistryItem, lang: Language): AssetDescriptor {
  const t = getFixedT(lang, "common", `assets.${asset.key}`);

  return {
    ...asset,
    label: t("label"),
    description: t("description")
  };
}

export function getLocalizedAssetRegistry(lang: Language): AssetDescriptor[] {
  return ASSET_REGISTRY.map((asset) => localizeAsset(asset, lang));
}

export function getAssetDescriptor(key: string | null | undefined, lang: Language): AssetDescriptor | null {
  const asset = ASSET_REGISTRY.find((item) => item.key === key);
  return asset ? localizeAsset(asset, lang) : null;
}
