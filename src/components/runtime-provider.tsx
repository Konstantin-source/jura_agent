"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

type RuntimeMode = "loading" | "demo" | "live";

interface RuntimeConfig {
  mode: RuntimeMode;
  supabase: { url: string; anonKey: string } | null;
}

const RuntimeContext = createContext<RuntimeConfig>({ mode: "loading", supabase: null });

export function RuntimeProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<RuntimeConfig>({ mode: "loading", supabase: null });
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/config", { cache: "no-store", signal: controller.signal })
      .then((response) => response.json())
      .then((value: { mode?: "demo" | "live"; supabase?: { url: string; anonKey: string } | null }) => {
        setConfig({ mode: value.mode ?? "live", supabase: value.supabase ?? null });
      })
      .catch(() => {
        if (!controller.signal.aborted) setConfig({ mode: "live", supabase: null });
      });
    return () => controller.abort();
  }, []);
  const value = useMemo(() => config, [config]);
  return <RuntimeContext.Provider value={value}>{children}</RuntimeContext.Provider>;
}

export function useRuntimeConfig() {
  return useContext(RuntimeContext);
}
