"use client";

import SideRays from "@/components/backgrounds/side-rays";

export function AuthBackground() {
  return (
    <div className="auth-rays" aria-hidden>
      <SideRays
        speed={2.5}
        rayColor1="#EAB308"
        rayColor2="#96c8ff"
        intensity={2}
        spread={2}
        origin="top-right"
        tilt={0}
        saturation={1.5}
        blend={0.75}
        falloff={1.6}
        opacity={1}
      />
    </div>
  );
}
