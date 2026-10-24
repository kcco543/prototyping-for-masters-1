"use client";

/**
 * The moving colour field behind the homepage: a slowly rippling "water
 * plane" of colour from ShaderGradient (MIT, by ruucm), the same renderer and
 * settings Prompt Bond uses for its light scene (components/ui/prompt-bond.tsx,
 * `ShaderScene`), recoloured with the homepage's own palette.
 *
 * It's only ever loaded by HomeAtmosphere.tsx, after the page has painted
 * and only where WebGL works, so it never delays the page or breaks it.
 *
 * Performance, as in Prompt Bond:
 *   - pixelDensity 1: one canvas pixel per CSS pixel, even on retina
 *     screens (the field is soft, so nobody can tell)
 *   - powerPreference "low-power": a laptop can use its battery-saving GPU
 *   - FramePolicy: while `moving` is false (tab hidden, reduced motion)
 *     the canvas stops drawing new frames altogether
 */

import { useThree } from "@react-three/fiber";
import { ShaderGradient, ShaderGradientCanvas } from "@shadergradient/react";
import { useEffect } from "react";

/*
  Prompt Bond's light preset (sourcePresets.light + sceneOverrides.light),
  with the homepage's colours instead of its blue-white:
    color1  lavender-soft #e4def3
    color2  cream         #f8f2e4
    color3  blush, a lighter cousin of --pink (#f2c9c6)
  and slower, gentler waves (uSpeed .06 instead of .1), so the colours
  drift like light through tissue paper rather than water. The lights shade
  the colours down a little, so they start lighter than the page tokens and
  the brightness is raised (1.15 → 1.5): otherwise cream turns grey.
*/
const FIELD = {
  control: "props",
  type: "waterPlane",
  animate: "on",
  shader: "defaults",
  lightType: "3d", // built-in lights only: nothing is downloaded (the "env" type would fetch light maps)
  grain: "off",
  brightness: 1.5,
  reflection: 0.1,
  color1: "#ece6fa",
  color2: "#fdf6e8",
  color3: "#fbe4dc",
  cAzimuthAngle: 180,
  cPolarAngle: 120,
  cDistance: 1.5,
  cameraZoom: 1,
  positionX: 0,
  positionY: 0,
  positionZ: 0,
  rotationX: 0,
  rotationY: 0,
  rotationZ: -90,
  uAmplitude: 0,
  uDensity: 1,
  uFrequency: 5.5,
  uSpeed: 0.06,
  uStrength: 1.2,
  uTime: 0.2,
  range: "disabled",
  rangeStart: 0,
  rangeEnd: 40,
  wireframe: false,
  toggleAxis: false,
  zoomOut: false,
  enableTransition: false,
} as const;

/** Draw every frame while moving; otherwise only when something changes (Prompt Bond's FramePolicy). */
function FramePolicy({ moving }: { moving: boolean }) {
  const setFrameloop = useThree((s) => s.setFrameloop);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    setFrameloop(moving ? "always" : "demand");
    invalidate();
  }, [moving, setFrameloop, invalidate]);
  return null;
}

export default function ShaderField({ moving }: { moving: boolean }) {
  return (
    <ShaderGradientCanvas
      style={{ position: "absolute", inset: 0 }}
      pixelDensity={1}
      fov={45}
      pointerEvents="none"
      powerPreference="low-power"
      lazyLoad={false}
    >
      <ShaderGradient {...FIELD} />
      <FramePolicy moving={moving} />
    </ShaderGradientCanvas>
  );
}
