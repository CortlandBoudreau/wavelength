import React from "react";
import { View, Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import WaveLogo from "../components/WaveLogo";
import { useAuth } from "../context/AuthContext";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "../navigation/AuthStack";

interface Props {
  navigation: NativeStackNavigationProp<AuthStackParamList, "Landing">;
}

const FEATURES = [
  { icon: "flask-outline",     text: "AI-summarised science news daily" },
  { icon: "pricetag-outline",  text: "Hashtags and angles ready for posting" },
  { icon: "star-outline",      text: "Save and track stories you've used" },
];

export default function Landing({ navigation }: Props) {
  const { loginAsGuest } = useAuth();

  return (
    <View style={{ flex: 1, backgroundColor: "#0f1e2d" }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 1, paddingHorizontal: 28, justifyContent: "space-between", paddingBottom: 16 }}>

          {/* Logo + hero */}
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <WaveLogo size="lg" />
            <Text style={{
              color: "#a0b4c8", fontSize: 15, textAlign: "center",
              marginTop: 16, lineHeight: 22,
            }}>
              Science news, curated and summarised{"\n"}for science creators
            </Text>

            {/* Feature list */}
            <View style={{ marginTop: 40, width: "100%", gap: 14 }}>
              {FEATURES.map((f) => (
                <View key={f.text} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View style={{
                    width: 36, height: 36, borderRadius: 18,
                    backgroundColor: "rgba(74,158,219,0.15)",
                    alignItems: "center", justifyContent: "center",
                  }}>
                    <Ionicons name={f.icon as any} size={18} color="#4A9EDB" />
                  </View>
                  <Text style={{ color: "#c8d8e8", fontSize: 14, flex: 1 }}>{f.text}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* CTAs */}
          <View style={{ gap: 10 }}>
            {/* Primary — starts onboarding */}
            <Pressable
              onPress={() => navigation.navigate("Interests")}
              style={({ pressed }) => ({
                backgroundColor: pressed ? "#2c7cb8" : "#4A9EDB",
                borderRadius: 14,
                paddingVertical: 16,
                alignItems: "center",
              })}
            >
              <Text style={{ color: "#ffffff", fontWeight: "700", fontSize: 16 }}>
                Let's Get Started
              </Text>
            </Pressable>

            {/* Sign in */}
            <Pressable
              onPress={() => navigation.navigate("Login")}
              style={{
                borderWidth: 1.5,
                borderColor: "rgba(74,158,219,0.35)",
                borderRadius: 14,
                paddingVertical: 16,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#7ec8f0", fontWeight: "600", fontSize: 16 }}>
                Sign In
              </Text>
            </Pressable>

            {/* Guest */}
            <Pressable onPress={loginAsGuest} style={{ paddingVertical: 10, alignItems: "center" }}>
              <Text style={{ color: "#5a7a94", fontSize: 14 }}>Continue as Guest</Text>
            </Pressable>
          </View>

        </View>
      </SafeAreaView>
    </View>
  );
}
