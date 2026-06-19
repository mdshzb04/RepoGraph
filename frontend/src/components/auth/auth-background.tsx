"use client";

import LightRays from "@/components/backgrounds/light-rays";

export function AuthBackground() {
  return (
    <div className="auth-rays" aria-hidden>
      <LightRays
        raysOrigin="top-center"
        raysColor="#ffffff"
        raysSpeed={1}
        lightSpread={0.5}
        rayLength={3}
        fadeDistance={1}
        saturation={1}
        followMouse
        mouseInfluence={0.1}
        noiseAmount={0}
        distortion={0}
      />
    </div>
  );
}
