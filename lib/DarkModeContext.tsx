"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

type ThemeMode = "dark" | "light";

type DarkModeContextType = {
  isDark: boolean;
  mode: ThemeMode;
  mounted: boolean;
  toggle: () => void;
};

const STORAGE_KEY = "whiteboard-theme";

const DarkModeContext = createContext<DarkModeContextType | undefined>(
  undefined,
);

function getPreferredMode(): ThemeMode {
  if (typeof window === "undefined") {
    return "dark";
  }

  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved === "dark" || saved === "light") {
    return saved;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function DarkModeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mode, setMode] = useState<ThemeMode>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const nextMode = getPreferredMode();
    setMode(nextMode);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const root = document.documentElement;
    root.dataset.theme = mode;
    window.localStorage.setItem(STORAGE_KEY, mode);
  }, [mode, mounted]);

  const value = useMemo(
    () => ({
      isDark: mode === "dark",
      mode,
      mounted,
      toggle: () =>
        setMode((current) => (current === "dark" ? "light" : "dark")),
    }),
    [mode, mounted],
  );

  return (
    <DarkModeContext.Provider value={value}>
      {children}
    </DarkModeContext.Provider>
  );
}

export function useDarkMode() {
  const context = useContext(DarkModeContext);

  if (!context) {
    throw new Error("useDarkMode must be used within DarkModeProvider");
  }

  return context;
}
