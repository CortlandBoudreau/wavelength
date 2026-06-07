import React from "react";
import { View, Text, Image } from "react-native";

interface Props {
  /** sm = icon only | md = icon + wordmark | lg = icon + wordmark + tagline */
  size?: "sm" | "md" | "lg";
}

const SIZES = {
  sm: { tile: 40, word: 0,  tag: 0  },
  md: { tile: 48, word: 22, tag: 0  },
  lg: { tile: 64, word: 30, tag: 11 },
};

const waveIcon = require("../../assets/wave-logo.png");

/**
 * WaveLength logo — uses the wave icon asset with a white tile background
 * (so it looks sharp on both dark and light screens) plus the wordmark.
 */
export default function WaveLogo({ size = "md" }: Props) {
  const s = SIZES[size];
  const t = s.tile;
  const radius = Math.round(t * 0.22);
  // Image sits with a little padding inside the tile
  const imgSize = Math.round(t * 0.82);

  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>

      {/* ── Icon tile ─────────────────────────────────────── */}
      <View
        style={{
          width: t,
          height: t,
          borderRadius: radius,
          backgroundColor: "#ffffff",
          alignItems: "center",
          justifyContent: "center",
          marginRight: size === "sm" ? 0 : 12,
          // Subtle shadow so it lifts off the dark background
          shadowColor: "#000",
          shadowOpacity: 0.25,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 2 },
          elevation: 4,
        }}
      >
        <Image
          source={waveIcon}
          style={{ width: imgSize, height: imgSize }}
          resizeMode="contain"
        />
      </View>

      {/* ── Wordmark ──────────────────────────────────────── */}
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
            <Text style={{ color: "#7ec8f0" }}>Length</Text>
          </Text>
          {size === "lg" && (
            <Text
              style={{
                color: "rgba(126,200,240,0.70)",
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
