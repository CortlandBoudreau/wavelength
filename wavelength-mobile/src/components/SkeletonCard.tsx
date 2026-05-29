import React, { useEffect, useRef } from "react";
import { Animated, View, StyleSheet } from "react-native";

export default function SkeletonCard() {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, [opacity]);

  return (
    <View style={styles.wrapper}>
      <Animated.View style={[styles.card, { opacity }]}>
        <View style={[styles.line, { width: "75%", marginBottom: 8 }]} />
        <View style={[styles.line, { width: "100%", marginBottom: 6 }]} />
        <View style={[styles.line, { width: "85%", marginBottom: 14 }]} />
        <View style={styles.footer}>
          <View style={styles.pill} />
          <View style={[styles.line, { width: 90 }]} />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: 14,
    marginBottom: 0,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    elevation: 4,
    shadowColor: "#1a2a3a",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.10,
    shadowRadius: 10,
    borderWidth: 1,
    borderColor: "#edf0f4",
  },
  line: {
    height: 12,
    backgroundColor: "#e0e7ef",
    borderRadius: 6,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  pill: {
    height: 22,
    width: 80,
    backgroundColor: "#e8f4fd",
    borderRadius: 20,
  },
});
