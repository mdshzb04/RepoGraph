"use client";

import LightRays from "@/components/backgrounds/light-rays";

export function AuthBackground() {
  return (
    <div className="auth-rays" aria-hidden>
      <div className="auth-rays-vignette" />
      <LightRays
        raysOrigin="top-center"
        raysColor="#00ffff"
        raysSpeed={1.5}
        lightSpread={0.8}
        rayLength={1.2}
        followMouse
        mouseInfluence={0.1}
        noiseAmount={0.1}
        distortion={0.05}
      />
    </div>
  );
}
