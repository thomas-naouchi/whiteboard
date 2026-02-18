"use client";
// Required because we use animations, mouse tracking, and hooks (client-side features)

import Link from "next/link";
import { motion, useMotionValue, useTransform } from "framer-motion";
import Particles from "react-tsparticles";
import { loadSlim } from "tsparticles-slim";
import { useCallback } from "react";

export default function Home() {
  /* -----------------------------
     Mouse position tracking
     Used to move the neon blobs
  ------------------------------ */
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  function handleMouseMove(e: React.MouseEvent) {
    mouseX.set(e.clientX);
    mouseY.set(e.clientY);
  }

  return (
    <main
      onMouseMove={handleMouseMove}
      className="relative min-h-screen overflow-hidden 
                 bg-gradient-to-br from-white via-purple-50 to-green-50 
                 flex items-center justify-center"
    >
      {/* =============================
         PARTICLE NETWORK BACKGROUND
         Floating dots connected by lines
      ============================== */}
      <ParticlesBackground />

      {/* =============================
         NOISE TEXTURE OVERLAY
         Adds subtle grain for depth
         (optional — requires /public/noise.png)
      ============================== */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.04] bg-[url('/noise.png')]" />

      {/* =============================
         FLOATING NEON BLOBS
         React slightly to mouse movement
      ============================== */}
      <Blob
        mouseX={mouseX}
        mouseY={mouseY}
        className="top-[-120px] left-[-120px]"
        color="bg-purple-400"
      />
      <Blob
        mouseX={mouseX}
        mouseY={mouseY}
        className="bottom-[-140px] right-[-140px]"
        color="bg-green-400"
      />
      <Blob
        mouseX={mouseX}
        mouseY={mouseY}
        className="top-[40%] left-[60%]"
        color="bg-purple-300"
      />

      {/* =============================
         MAIN GLASS PANEL CONTENT
      ============================== */}
      <motion.div
        initial={{ opacity: 0, y: 60, scale: 0.95 }} // animation start
        animate={{ opacity: 1, y: 0, scale: 1 }} // animation end
        transition={{ duration: 0.9 }}
        className="relative z-10 backdrop-blur-2xl bg-white/70 
                   border border-white/40 shadow-2xl 
                   rounded-3xl p-14 max-w-xl text-center"
      >
        {/* =============================
           LOGO / BRAND NAME
           Gradient text effect
        ============================== */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-6xl font-bold mb-6"
        >
          <span
            className="bg-gradient-to-r from-purple-600 to-green-500 
                           bg-clip-text text-transparent"
          >
            Whiteboard
          </span>
        </motion.h1>

        {/* =============================
           TAGLINE TEXT
        ============================== */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-gray-600 mb-10 text-lg"
        >
          Think faster. Understand deeper. Your documents — now interactive.
        </motion.p>

        {/* =============================
           MAGNETIC LAUNCH BUTTON
           Links to /chat page
        ============================== */}
        <MagneticButton />
      </motion.div>
    </main>
  );
}

/* =====================================================
   MAGNETIC BUTTON COMPONENT
   Button slightly follows cursor inside its area
===================================================== */
function MagneticButton() {
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  function handleMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();

    // Calculate cursor offset from center
    const offsetX = e.clientX - (rect.left + rect.width / 2);
    const offsetY = e.clientY - (rect.top + rect.height / 2);

    // Move button slightly toward cursor
    x.set(offsetX * 0.3);
    y.set(offsetY * 0.3);
  }

  function reset() {
    x.set(0);
    y.set(0);
  }

  return (
    <motion.div
      style={{ x, y }}
      onMouseMove={handleMove}
      onMouseLeave={reset}
      whileTap={{ scale: 0.92 }} // click effect
      className="inline-block"
    >
      <Link
        href="/chat"
        className="relative inline-block px-10 py-5 rounded-2xl 
                   font-semibold text-white text-lg shadow-lg 
                   bg-gradient-to-r from-purple-500 to-green-500 
                   hover:shadow-purple-300/50 
                   transition-all duration-300"
      >
        Launch Whiteboard →
      </Link>
    </motion.div>
  );
}

/* =====================================================
   FLOATING BLOB COMPONENT
   Neon gradient circles in background
===================================================== */
function Blob({
  className,
  color,
  mouseX,
  mouseY,
}: {
  className?: string;
  color: string;
  mouseX: any;
  mouseY: any;
}) {
  // Move blob slightly based on mouse position
  const x = useTransform(mouseX, [0, 1000], [-50, 50]);
  const y = useTransform(mouseY, [0, 800], [-50, 50]);

  return (
    <motion.div
      style={{ x, y }}
      className={`absolute w-[520px] h-[520px] 
                  rounded-full blur-3xl opacity-40 
                  ${color} ${className}`}
      animate={{
        scale: [1, 1.15, 0.9, 1], // breathing effect
      }}
      transition={{
        duration: 10,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    />
  );
}

/* =====================================================
   PARTICLES BACKGROUND COMPONENT
   Floating dots + connection lines
===================================================== */
function ParticlesBackground() {
  // Load lightweight particle engine
  const particlesInit = useCallback(async (engine: any) => {
    await loadSlim(engine);
  }, []);

  return (
    <Particles
      id="tsparticles"
      init={particlesInit}
      className="absolute inset-0"
      options={{
        particles: {
          number: { value: 40 },

          // Purple + green theme
          color: { value: ["#8b5cf6", "#22c55e"] },

          links: {
            enable: true,
            color: "#a78bfa",
            opacity: 0.2,
          },

          move: {
            enable: true,
            speed: 0.6,
          },

          opacity: {
            value: 0.4,
          },

          size: {
            value: { min: 1, max: 3 },
          },
        },

        detectRetina: true,
      }}
    />
  );
}
//Home()
//├── ParticlesBackground()  → dots + lines
//├── Blob()                 → glowing bubbles
//├── Glass Panel            → main UI
//└── MagneticButton()       → launch button
