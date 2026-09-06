"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

type RuntimeMode = "loading" | "demo" | "live";

interface RuntimeConfig {
  mode: RuntimeMode;
  storage: "local";
  setupRequired: boolean;
  setupAvailable: boolean;
}

const RuntimeContext = createContext<RuntimeConfig>({
  mode: "loading",
  storage: "local",
  setupRequired: false,
  setupAvailable: false,
});

export function RuntimeProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<RuntimeConfig>({
    mode: "loading",
    storage: "local",
    setupRequired: false,
    setupAvailable: false,
  });
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/config", { cache: "no-store", signal: controller.signal })
      .then((response) => response.json())
      .then((value: Partial<Omit<RuntimeConfig, "mode">> & { mode?: "demo" | "live" }) => {
        setConfig({
          mode: value.mode ?? "live",
          storage: "local",
          setupRequired: value.setupRequired ?? false,
          setupAvailable: value.setupAvailable ?? false,
        });
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setConfig({ mode: "live", storage: "local", setupRequired: false, setupAvailable: false });
        }
      });
    return () => controller.abort();
  }, []);
  const value = useMemo(() => config, [config]);
  return <RuntimeContext.Provider value={value}>{children}</RuntimeContext.Provider>;
}

export function useRuntimeConfig() {
  return useContext(RuntimeContext);
}
