"use client";

import { SWRConfig } from "swr";
import type { SWRConfiguration } from "swr";

const swrConfig: SWRConfiguration = {
  dedupingInterval: 30_000,
  revalidateOnFocus: false,
  keepPreviousData: true,
  shouldRetryOnError: true,
  errorRetryCount: 2,
  errorRetryInterval: 1000
};

export function SwrProvider(props: { children: React.ReactNode }) {
  return <SWRConfig value={swrConfig}>{props.children}</SWRConfig>;
}

