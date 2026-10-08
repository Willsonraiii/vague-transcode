"use client";
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

export { ShutterText } from "./hero-shutter-text.jsx";

interface HeroTextProps {
  text?: string;
  className?: string;
  showControls?: boolean;
  onRefresh?: () => void;
}

export default function HeroText({
  text = "IMMERSE",
  className = "",
  showControls = false,
  onRefresh,
}: HeroTextProps) {
  const [count, setCount] = useState(0);
  const words = String(text).split(" ");
  let globalCharIndex = 0;

  const handleRefresh = () => {
    setCount((c) => c + 1);
    if (onRefresh) onRefresh();
  };

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center w-full transition-colors duration-700",
        className
      )}
      style={{ position: "relative" }}
    >
      {/* Immersive Background Grid */}
      <div
        className="absolute inset-0 opacity-[0.05] pointer-events-none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          pointerEvents: "none",
          opacity: 0.05,
          backgroundImage: `linear-gradient(to right, #888 1px, transparent 1px), linear-gradient(to bottom, #888 1px, transparent 1px)`,
          backgroundSize: "clamp(20px, 5vw, 60px) clamp(20px, 5vw, 60px)",
        }}
      />

      {/* Main Text Container */}
      <div
        className="relative z-10 w-full px-4 flex flex-col items-center"
        style={{ position: "relative", zIndex: 10, width: "100%" }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={count}
            className="flex flex-wrap justify-center items-center w-full"
            style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", alignItems: "center" }}
          >
            {words.map((word, wIdx) => (
              <span
                key={wIdx}
                style={{
                  display: "inline-block",
                  whiteSpace: "nowrap",
                  marginRight: wIdx < words.length - 1 ? "0.3em" : "0",
                }}
              >
                {word.split("").map((char) => {
                  const i = globalCharIndex++;
                  return (
                    <div
                      key={i}
                      style={{
                        position: "relative",
                        display: "inline-block",
                        overflow: "hidden",
                        padding: "0 0.04em",
                        lineHeight: 1,
                      }}
                    >
                      {/* Main Character */}
                      <motion.span
                        initial={{ opacity: 0, filter: "blur(10px)" }}
                        animate={{ opacity: 1, filter: "blur(0px)" }}
                        transition={{ delay: i * 0.04 + 0.2, duration: 0.7 }}
                        style={{
                          display: "inline-block",
                          lineHeight: 1,
                          fontWeight: 900,
                          color: "#ffffff",
                          fontSize: "clamp(2rem, 5vw, 4rem)",
                        }}
                      >
                        {char}
                      </motion.span>

                      {/* Top Slice Layer */}
                      <motion.span
                        initial={{ x: "-100%", opacity: 0 }}
                        animate={{ x: "100%", opacity: [0, 1, 0] }}
                        transition={{
                          duration: 0.65,
                          delay: i * 0.04,
                          ease: "easeInOut",
                        }}
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          height: "100%",
                          pointerEvents: "none",
                          lineHeight: 1,
                          fontWeight: 900,
                          color: "#38bdf8",
                          fontSize: "clamp(2rem, 5vw, 4rem)",
                          clipPath: "polygon(0 0, 100% 0, 100% 35%, 0 35%)",
                        }}
                      >
                        {char}
                      </motion.span>

                      {/* Middle Slice Layer */}
                      <motion.span
                        initial={{ x: "100%", opacity: 0 }}
                        animate={{ x: "-100%", opacity: [0, 1, 0] }}
                        transition={{
                          duration: 0.65,
                          delay: i * 0.04 + 0.08,
                          ease: "easeInOut",
                        }}
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          height: "100%",
                          pointerEvents: "none",
                          lineHeight: 1,
                          fontWeight: 900,
                          color: "#cbd5e1",
                          fontSize: "clamp(2rem, 5vw, 4rem)",
                          clipPath: "polygon(0 35%, 100% 35%, 100% 65%, 0 65%)",
                        }}
                      >
                        {char}
                      </motion.span>

                      {/* Bottom Slice Layer */}
                      <motion.span
                        initial={{ x: "-100%", opacity: 0 }}
                        animate={{ x: "100%", opacity: [0, 1, 0] }}
                        transition={{
                          duration: 0.65,
                          delay: i * 0.04 + 0.16,
                          ease: "easeInOut",
                        }}
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          height: "100%",
                          pointerEvents: "none",
                          lineHeight: 1,
                          fontWeight: 900,
                          color: "#38bdf8",
                          fontSize: "clamp(2rem, 5vw, 4rem)",
                          clipPath: "polygon(0 65%, 100% 65%, 100% 100%, 0 100%)",
                        }}
                      >
                        {char}
                      </motion.span>
                    </div>
                  );
                })}
              </span>
            ))}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Floating UI Controls */}
      {showControls && (
        <div className="flex flex-col items-center gap-2 mt-4 z-20">
          <motion.button
            whileHover={{ scale: 1.1, rotate: 180 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleRefresh}
            className="p-3 bg-zinc-900 text-white rounded-full shadow-2xl transition-colors duration-300"
            style={{
              padding: "0.75rem",
              background: "#18181b",
              color: "#ffffff",
              borderRadius: "9999px",
              border: "1px solid rgba(255,255,255,0.15)",
              cursor: "pointer",
            }}
          >
            <RefreshCw size={20} />
          </motion.button>
          <p
            className="text-[10px] uppercase tracking-[0.5em] font-bold text-zinc-400"
            style={{
              fontSize: "10px",
              letterSpacing: "0.5em",
              fontWeight: "bold",
              color: "#94a3b8",
              textTransform: "uppercase",
            }}
          >
            Click to re-shutter
          </p>
        </div>
      )}
    </div>
  );
}
