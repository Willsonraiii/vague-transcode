"use client";
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * ShutterText - Cinematic character-slicing shutter animation.
 * Breaks characters into 3 distinct horizontal slice layers with
 * opposing high-speed traversal animations and clip-paths.
 */
export function ShutterText({
  text = "IMMERSE",
  triggerKey,
  className = "",
  textClassName = "",
  textColor = "#ffffff",
  topSliceColor = "#38bdf8",
  midSliceColor = "#cbd5e1",
  botSliceColor = "#38bdf8",
  charWrapClassName = "",
}) {
  const words = String(text).split(" ");
  let globalCharIndex = 0;

  return (
    <span
      className={cn("shutter-text-root", className)}
      style={{
        display: "inline-flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "center",
        userSelect: "none",
        lineHeight: 1,
        color: textColor,
        WebkitTextFillColor: textColor,
      }}
    >
      <AnimatePresence mode="wait">
        <motion.span
          key={triggerKey !== undefined ? triggerKey : text}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.1 } }}
          transition={{ duration: 0.2 }}
          style={{
            display: "inline-flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "center",
            lineHeight: 1,
            color: textColor,
            WebkitTextFillColor: textColor,
          }}
        >
          {words.map((word, wIdx) => {
            return (
              <span
                key={wIdx}
                className="shutter-word"
                style={{
                  display: "inline-block",
                  whiteSpace: "nowrap",
                  lineHeight: 1,
                  marginRight: wIdx < words.length - 1 ? "0.3em" : "0",
                  color: textColor,
                  WebkitTextFillColor: textColor,
                }}
              >
                {word.split("").map((char) => {
                  const i = globalCharIndex++;
                  return (
                    <span
                      key={i}
                      className={cn("shutter-char-wrap", charWrapClassName)}
                      style={{
                        position: "relative",
                        display: "inline-block",
                        overflow: "hidden",
                        padding: "0 0.04em",
                        lineHeight: 1,
                        verticalAlign: "baseline",
                        color: textColor,
                        WebkitTextFillColor: textColor,
                      }}
                    >
                      {/* Main Base Character - Always solid and visible */}
                      <motion.span
                        initial={{ opacity: 0.3, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.02 + 0.05, duration: 0.4 }}
                        className={cn("shutter-char-main", textClassName)}
                        style={{
                          display: "inline-block",
                          lineHeight: 1,
                          color: textColor,
                          WebkitTextFillColor: textColor,
                          verticalAlign: "baseline",
                        }}
                      >
                        {char}
                      </motion.span>

                      {/* Top Slice Layer (0% to 35%) */}
                      <motion.span
                        initial={{ x: "-100%", opacity: 0 }}
                        animate={{ x: "100%", opacity: [0, 1, 0] }}
                        transition={{
                          duration: 0.6,
                          delay: i * 0.025,
                          ease: "easeInOut",
                        }}
                        className={cn("shutter-slice shutter-slice-top", textClassName)}
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          height: "100%",
                          pointerEvents: "none",
                          lineHeight: 1,
                          zIndex: 10,
                          color: topSliceColor,
                          WebkitTextFillColor: topSliceColor,
                          clipPath: "polygon(0 0, 100% 0, 100% 35%, 0 35%)",
                          WebkitClipPath: "polygon(0 0, 100% 0, 100% 35%, 0 35%)",
                        }}
                      >
                        {char}
                      </motion.span>

                      {/* Middle Slice Layer (35% to 65%) */}
                      <motion.span
                        initial={{ x: "100%", opacity: 0 }}
                        animate={{ x: "-100%", opacity: [0, 1, 0] }}
                        transition={{
                          duration: 0.6,
                          delay: i * 0.025 + 0.07,
                          ease: "easeInOut",
                        }}
                        className={cn("shutter-slice shutter-slice-mid", textClassName)}
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          height: "100%",
                          pointerEvents: "none",
                          lineHeight: 1,
                          zIndex: 10,
                          color: midSliceColor,
                          WebkitTextFillColor: midSliceColor,
                          clipPath: "polygon(0 35%, 100% 35%, 100% 65%, 0 65%)",
                          WebkitClipPath: "polygon(0 35%, 100% 35%, 100% 65%, 0 65%)",
                        }}
                      >
                        {char}
                      </motion.span>

                      {/* Bottom Slice Layer (65% to 100%) */}
                      <motion.span
                        initial={{ x: "-100%", opacity: 0 }}
                        animate={{ x: "100%", opacity: [0, 1, 0] }}
                        transition={{
                          duration: 0.6,
                          delay: i * 0.025 + 0.14,
                          ease: "easeInOut",
                        }}
                        className={cn("shutter-slice shutter-slice-bot", textClassName)}
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          height: "100%",
                          pointerEvents: "none",
                          lineHeight: 1,
                          zIndex: 10,
                          color: botSliceColor,
                          WebkitTextFillColor: botSliceColor,
                          clipPath: "polygon(0 65%, 100% 65%, 100% 100%, 0 100%)",
                          WebkitClipPath: "polygon(0 65%, 100% 65%, 100% 100%, 0 100%)",
                        }}
                      >
                        {char}
                      </motion.span>
                    </span>
                  );
                })}
              </span>
            );
          })}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/**
 * HeroText - Specification component from prompt with background grid,
 * corner accents, and shutter slice character animation.
 */
export default function HeroText({
  text = "IMMERSE",
  className = "",
  showControls = false,
  onRefresh,
}) {
  const [count, setCount] = useState(0);

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
        <ShutterText
          text={text}
          triggerKey={count}
          textClassName="text-[clamp(1.75rem,5vw,3.75rem)] font-black tracking-tight"
          textColor="#ffffff"
          topSliceColor="#38bdf8"
          midSliceColor="#cbd5e1"
          botSliceColor="#38bdf8"
        />
      </div>

      {/* Floating UI Controls */}
      {showControls && (
        <div
          className="flex flex-col items-center gap-2 mt-4 z-20"
          style={{ position: "relative", zIndex: 20, marginTop: "1rem" }}
        >
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

      {/* Corner Accents */}
      <div
        className="absolute top-4 left-4 border-l border-t border-zinc-200 dark:border-zinc-800 w-8 h-8 pointer-events-none"
        style={{
          position: "absolute",
          top: "1rem",
          left: "1rem",
          width: "2rem",
          height: "2rem",
          borderLeft: "1px solid rgba(255,255,255,0.1)",
          borderTop: "1px solid rgba(255,255,255,0.1)",
          pointerEvents: "none",
        }}
      />
      <div
        className="absolute bottom-4 right-4 border-r border-b border-zinc-200 dark:border-zinc-800 w-8 h-8 pointer-events-none"
        style={{
          position: "absolute",
          bottom: "1rem",
          right: "1rem",
          width: "2rem",
          height: "2rem",
          borderRight: "1px solid rgba(255,255,255,0.1)",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
