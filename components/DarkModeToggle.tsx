"use client";

import { motion } from "framer-motion";
import { useDarkMode } from "@/lib/DarkModeContext";

export function DarkModeToggle() {
  const { isDark, toggle } = useDarkMode();

  const springTransition = {
    type: "spring",
    stiffness: 200,
    damping: 25,
  };

  return (
    <motion.button
      onClick={toggle}
      className="dark-mode-toggle"
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      transition={springTransition}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
    >
      {/* Sun Icon */}
      <motion.svg
        className="toggle-icon toggle-sun"
        viewBox="0 0 24 24"
        width="18"
        height="18"
        initial={{ opacity: isDark ? 0 : 1, rotate: isDark ? -180 : 0 }}
        animate={{ opacity: isDark ? 0 : 1, rotate: isDark ? -180 : 0 }}
        transition={{ duration: 0.4 }}
      >
        <circle cx="12" cy="12" r="5" fill="currentColor" />
        <line x1="12" y1="1" x2="12" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="12" y1="21" x2="12" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="1" y1="12" x2="3" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="21" y1="12" x2="23" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </motion.svg>

      {/* Moon Icon */}
      <motion.svg
        className="toggle-icon toggle-moon"
        viewBox="0 0 24 24"
        width="18"
        height="18"
        initial={{ opacity: isDark ? 1 : 0, rotate: isDark ? 0 : 180 }}
        animate={{ opacity: isDark ? 1 : 0, rotate: isDark ? 0 : 180 }}
        transition={{ duration: 0.4 }}
      >
        <path
          d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
          fill="currentColor"
        />
      </motion.svg>

      {/* Glow effect */}
      <motion.div
        className="toggle-glow"
        initial={false}
        animate={{
          boxShadow: isDark
            ? "0 0 12px rgba(255, 200, 100, 0.3)"
            : "0 0 12px rgba(100, 200, 255, 0.3)",
        }}
        transition={{ duration: 0.6 }}
      />
    </motion.button>
  );
}
