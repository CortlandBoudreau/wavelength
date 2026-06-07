import React from "react";
import { View, Text } from "react-native";

interface Props {
  /** sm = icon only | md = icon + wordmark | lg = icon + wordmark + tagline */
  size?: "sm" | "md" | "lg";
}

const SIZES = {
  sm: { tile: 40, word: 0,  tag: 0  },
  md: { tile: 48, word: 22, tag: 0  },
  lg: { tile: 60, word: 28, tag: 10 },
};

/**
 * WaveLength logo — an ocean wave icon in a deep-navy rounded tile.
 *
 * The wave is built from two layered arcs using border-radius:
 *   • A deep-teal swell (back wave)
 *   • A brighter blue crest (front wave)
 * plus a white foam dot at the crest tip.
 *
 * No external SVG library needed — pure View shapes.
 */
export default function WaveLogo({ size = "md" }: Props) {
  const s = SIZES[size];
  const t = s.tile;

  // Wave proportions relative to tile size
  const backWaveH   = Math.round(t * 0.42);   // back swell height
  const frontWaveH  = Math.round(t * 0.34);   // front crest height
  const waveWidth   = Math.round(t * 1.6);    // waves wider than tile for overflow crop
  const waveLeft    = -Math.round(t * 0.3);   // offset left so they start before the tile

  // Crest curl — small circle peeking at top-right of front wave
  const curlSize    = Math.round(t * 0.18);
  const curlRight   = Math.round(t * 0.2);
  const curlBottom  = frontWaveH - Math.round(curlSize * 0.5);

  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>

      {/* ── Icon tile ───────────────────────────────────────── */}
      <View
        style={{
          backgroundColor: "#0d1e2e",
          borderRadius: Math.round(t * 0.22),
          width: t,
          height: t,
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "flex-end",
          marginRight: size === "sm" ? 0 : 12,
          // Subtle border catches light
          borderWidth: 1,
          borderColor: "rgba(74,158,219,0.18)",
        }}
      >
        {/* Subtle radial glow at top */}
        <View
          style={{
            position: "absolute",
            top: -Math.round(t * 0.4),
            left: Math.round(t * 0.1),
            width: Math.round(t * 0.8),
            height: Math.round(t * 0.8),
            borderRadius: Math.round(t * 0.4),
            backgroundColor: "rgba(74,158,219,0.12)",
          }}
        />

        {/* Back wave — deeper teal, rounder arc */}
        <View
          style={{
            position: "absolute",
            bottom: 0,
            left: waveLeft,
            width: waveWidth,
            height: backWaveH,
            backgroundColor: "#1a6a8a",
            borderTopLeftRadius:  Math.round(backWaveH * 1.1),
            borderTopRightRadius: Math.round(backWaveH * 0.6),
          }}
        />

        {/* Front wave — bright ocean blue, sharper leading crest */}
        <View
          style={{
            position: "absolute",
            bottom: 0,
            left: waveLeft + Math.round(t * 0.08),
            width: waveWidth,
            height: frontWaveH,
            backgroundColor: "#4A9EDB",
            borderTopLeftRadius:  Math.round(frontWaveH * 1.3),
            borderTopRightRadius: Math.round(frontWaveH * 0.4),
          }}
        />

        {/* Crest foam curl — white circle at the peak of the front wave */}
        <View
          style={{
            position: "absolute",
            bottom: curlBottom,
            right: curlRight,
            width: curlSize,
            height: curlSize,
            borderRadius: curlSize / 2,
            backgroundColor: "rgba(255,255,255,0.82)",
          }}
        />

        {/* Seafloor — very dark strip at the very bottom */}
        <View
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: Math.round(t * 0.12),
            backgroundColor: "#0a1825",
          }}
        />
      </View>

      {/* ── Wordmark ──────────────────────────────────────────── */}
      {size !== "sm" && (
        <View style={{ justifyContent: "center" }}>
          <Text
            style={{
              color: "#ffffff",
              fontSize: s.word,
              fontWeight: "800",
              letterSpacing: 0.3,
              lineHeight: s.word + 4,
            }}
          >
            Wave
            <Text style={{ color: "#4A9EDB" }}>Length</Text>
          </Text>
          {size === "lg" && (
            <Text
              style={{
                color: "rgba(74,158,219,0.65)",
                fontSize: s.tag,
                letterSpacing: 2.2,
                marginTop: 3,
                fontWeight: "600",
                textTransform: "uppercase",
              }}
            >
              Science · Creator
            </Text>
          )}
        </View>
      )}

    </View>
  );
}
