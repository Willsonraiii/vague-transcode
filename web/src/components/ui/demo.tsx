import React from "react";
import { AnimatedText } from "@/components/ui/animated-text";

export default function DemoOne() {
  return (
    <main className="p-8 flex items-center justify-center bg-black min-h-screen">
      <AnimatedText text="Font Design" fontSize={100} color="#ffffff" />
    </main>
  );
}
