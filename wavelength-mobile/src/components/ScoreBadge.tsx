import React from "react";
import { View, Text } from "react-native";

interface Props {
  score: number | null | undefined;
}

function scoreColor(score: number): string {
  if (score >= 8) return "#22c55e";
  if (score >= 5) return "#f59e0b";
  return "#6b7280";
}

export default function ScoreBadge({ score }: Props) {
  // No score yet — render nothing rather than "⚡ /10"
  if (score == null || score === 0) return null;

  const color = scoreColor(score);
  return (
    <View
      style={{
        borderWidth: 1.5,
        borderColor: color,
        borderRadius: 20,
        paddingHorizontal: 7,
        paddingVertical: 2,
      }}
    >
      <Text style={{ color, fontSize: 11, fontWeight: "700", letterSpacing: 0.2 }}>
        ⚡ {score}/10
      </Text>
    </View>
  );
}
