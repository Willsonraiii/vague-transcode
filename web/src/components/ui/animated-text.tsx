"use client";

import React, { useEffect, useRef } from "react";

export interface AnimatedTextProps {
  text: string;
  fontSize?: number | string;
  minWeight?: number;
  maxWeight?: number;
  animationDuration?: number;
  delayMultiplier?: number;
  phaseOffset?: number;
  reverse?: boolean;
  justify?: boolean;
  className?: string;
  color?: string;
  letterSpacing?: string;
}

export function AnimatedText({
  text = "",
  fontSize = 150,
  minWeight = 100,
  maxWeight = 850,
  animationDuration = 1.6,
  delayMultiplier = 0.22,
  phaseOffset = 0,
  reverse = false,
  justify = false,
  className = "",
  color,
  letterSpacing,
}: AnimatedTextProps) {
  const containerRef = useRef<HTMLParagraphElement>(null);
  const chars = String(text).split("");
  const numLetters = chars.length;

  // Generate unique keyframe name per weight range to avoid collisions across multiple instances
  const animKey = `breath_${Math.round(minWeight)}_${Math.round(maxWeight)}`;

  useEffect(() => {
    if (!containerRef.current) return;

    const spans = containerRef.current.querySelectorAll<HTMLSpanElement>(".anim-char");
    spans.forEach((span, i) => {
      const idx = reverse ? numLetters - 1 - i : i;
      const mappedIndex = idx - numLetters / 2;
      const delay = (mappedIndex * delayMultiplier + phaseOffset).toFixed(3);
      span.style.animationDelay = `${delay}s`;
    });
  }, [text, delayMultiplier, phaseOffset, reverse, numLetters]);

  const characters = chars.map((char, index) => {
    const idx = reverse ? numLetters - 1 - index : index;
    const mappedIndex = idx - numLetters / 2;
    const initialDelay = (mappedIndex * delayMultiplier + phaseOffset).toFixed(3);

    return (
      <span
        key={index}
        className="anim-char"
        aria-hidden="true"
        style={{
          display: "inline-block",
          animation: `${animKey} ${animationDuration}s alternate cubic-bezier(0.37, 0, 0.63, 1) infinite`,
          animationDelay: `${initialDelay}s`,
          animationFillMode: "both",
          fontVariationSettings: `"wght" ${minWeight}`,
          lineHeight: 1,
          willChange: "font-variation-settings",
          background: "transparent",
        }}
      >
        {char === " " ? "\u00A0" : char}
      </span>
    );
  });

  return (
    <div
      className={`animated-text-wrap ${className}`}
      style={{
        display: justify ? "flex" : "inline-flex",
        width: justify ? "100%" : "auto",
        alignItems: "center",
        justifyContent: justify ? "space-between" : "flex-start",
        background: "transparent",
        padding: 0,
        margin: 0,
      }}
    >
      <p
        ref={containerRef}
        aria-label={text}
        className="font-sans m-0"
        style={{
          fontSize: typeof fontSize === "number" ? `${fontSize}px` : fontSize,
          fontFeatureSettings: '"wght"',
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif",
          lineHeight: 0.95,
          color: color || "currentColor",
          WebkitTextFillColor: color || "currentColor",
          letterSpacing: letterSpacing || "normal",
          display: justify ? "flex" : "inline-flex",
          justifyContent: justify ? "space-between" : "flex-start",
          width: justify ? "100%" : "auto",
          alignItems: "center",
          margin: 0,
          padding: 0,
          background: "transparent",
        }}
      >
        {characters}
        <style>{`
          @keyframes ${animKey} {
            0% {
              font-variation-settings: "wght" ${minWeight};
            }
            100% {
              font-variation-settings: "wght" ${maxWeight};
            }
          }
        `}</style>
      </p>
    </div>
  );
}

export default AnimatedText;
