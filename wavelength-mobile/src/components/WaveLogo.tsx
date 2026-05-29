import React from "react";
import { View, Text } from "react-native";

interface Props {
  /** sm = icon only | md = icon + wordmark | lg = icon + wordmark + tagline */
  size?: "sm" | "md" | "lg";
}

const SIZES = {
  sm: { tile: 40, word: 0,  tag: 0  },
  md: { tile: 48, word: 22, tag: 0  },
  lg: { tile: 56, word: 28, tag: 10 },
};

/**
 * Relative bar heights for the waveform icon (0–1).
 * Two gentle peaks — reads as a frequency / wavelength, not a burger menu.
 */
const BARS = [0.35, 0.7, 1, 0.65, 0.35, 0.65, 1, 0.7, 0.35];

export default function WaveLogo({ size = "md" }: Props) {
  const s = SIZES[size];

  const tileInner  = s.tile * 0.62;   // usable height inside tile
  const barWidth   = Math.round(s.tile * 0.055);
  const barGap     = Math.round(s.tile * 0.038);
  const barRadius  = Math.ceil(barWidth / 2);

  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>

      {/* Icon tile */}
      <View
        style={{
          backgroundColor: "#0f1e2d",
          borderRadius: 10,
          width: s.tile,
          height: s.tile,
          alignItems: "center",
          justifyContent: "center",
          marginRight: size === "sm" ? 0 : 12,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          {BARS.map((ratio, i) => (
            <View
              key={i}
              style={{
                width: barWidth,
                height: Math.max(3, Math.round(tileInner * ratio)),
                backgroundColor: "#4A9EDB",
                borderRadius: barRadius,
                marginRight: i < BARS.length - 1 ? barGap : 0,
              }}
            />
          ))}
        </View>
      </View>

      {/* Wordmark */}
      {size !== "sm" && (
        <View style={{ justifyContent: "center" }}>
          <Text
            style={{
              color: "#4A9EDB",
              fontSize: s.word,
              fontWeight: "800",
              letterSpacing: 0.4,
              lineHeight: s.word + 4,
            }}
          >
            WaveLength
          </Text>
          {size === "lg" && (
            <Text
              style={{
                color: "#6a9ab8",
                fontSize: s.tag,
                letterSpacing: 2.5,
                marginTop: 2,
                fontWeight: "600",
              }}
            >
              SCIENCE · CREATOR
            </Text>
          )}
        </View>
      )}

    </View>
  );
}
