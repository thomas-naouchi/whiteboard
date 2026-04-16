"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useDarkMode } from "@/lib/DarkModeContext";

export function DarkModeToggle() {
  const { isDark, mode, mounted, toggle } = useDarkMode();
  const reduceMotion = useReducedMotion();

  return (
    <motion.button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      title={`Switch to ${isDark ? "light" : "dark"} mode`}
      initial={false}
      whileHover={reduceMotion ? undefined : { y: -1, scale: 1.01 }}
      whileTap={reduceMotion ? undefined : { scale: 0.98 }}
      transition={{ type: "spring", stiffness: 260, damping: 20 }}
    >
      <span className="theme-toggle-icon-wrap" aria-hidden="true">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={mode}
            className="theme-toggle-icon"
            initial={reduceMotion ? { opacity: 1 } : { opacity: 0, rotate: -24, scale: 0.7 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, rotate: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, rotate: 24, scale: 0.7 }}
            transition={{ duration: 0.22 }}
          >
            {isDark ? (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                <path
                  d="M21 12.79A9 9 0 1 1 11.21 3c-.12.37-.21.76-.21 1.17A8.79 8.79 0 0 0 19.83 13c.41 0 .8-.09 1.17-.21Z"
                  fill="currentColor"
                />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                <circle cx="12" cy="12" r="4.5" fill="currentColor" />
                <path
                  d="M12 2.5v2.2M12 19.3v2.2M21.5 12h-2.2M4.7 12H2.5M18.72 5.28l-1.56 1.56M6.84 17.16l-1.56 1.56M18.72 18.72l-1.56-1.56M6.84 6.84 5.28 5.28"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </motion.span>
        </AnimatePresence>
      </span>

      <span className="sr-only">
        {mounted ? (isDark ? "Dark mode enabled" : "Light mode enabled") : "Theme"}
      </span>
    </motion.button>
  );
}
