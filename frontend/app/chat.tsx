// Abi chat screen — messages with the AIB digital assistant.
// Persists via session id; assistant knows recent transactions, transfers,
// account state and can explain SEPA timing.
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
} from "react-native-reanimated";

import { colors } from "@/src/theme";
import { api } from "@/src/api";
import { storage } from "@/src/utils/storage";

const SESSION_KEY = "abi_session_id";
const SUGGESTIONS = [
  "Where's my last transfer?",
  "Why isn't my SEPA payment instant?",
  "How do I freeze my card?",
  "Show my balance and monthly spend",
];

type Msg = { role: "user" | "assistant"; text: string; at: number };

function BackIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M15 5 L8 12 L15 19" stroke="#E1BEE7" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}
function SendIcon({ color = "#fff" }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M4 12 L20 4 L14 20 L12 13 L4 12 Z" fill={color} />
    </Svg>
  );
}
// Small sparkle mark used as Abi's avatar glyph.
function SparkleIcon({ size = 18, color = "#fff" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3 L13.6 9.2 L20 11 L13.6 12.8 L12 19 L10.4 12.8 L4 11 L10.4 9.2 Z" fill={color} />
      <Path d="M18.5 3.5 L19.2 5.8 L21.5 6.5 L19.2 7.2 L18.5 9.5 L17.8 7.2 L15.5 6.5 L17.8 5.8 Z" fill={color} opacity={0.85} />
    </Svg>
  );
}

function AbiAvatar({ size = 40 }: { size?: number }) {
  return (
    <LinearGradient
      colors={[colors.brandTertiary, colors.brandPrimary, colors.brandDeep]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: size, height: size, borderRadius: size / 2, alignItems: "center", justifyContent: "center" }}
    >
      <SparkleIcon size={size * 0.5} />
    </LinearGradient>
  );
}

function clockTime(ms: number): string {
  const d = new Date(ms);
  const h = d.getHours();
  const m = d.getMinutes();
  const hh = ((h + 11) % 12) + 1;
  const ap = h < 12 ? "am" : "pm";
  return `${hh}:${m.toString().padStart(2, "0")} ${ap}`;
}

// Lightweight inline renderer for Abi's markdown: **bold** segments.
function RichText({ text, style }: { text: string; style: any }) {
  const lines = text.split("\n");
  return (
    <View>
      {lines.map((line, li) => {
        const trimmed = line.trimStart();
        const isBullet = trimmed.startsWith("- ") || trimmed.startsWith("• ");
        const content = isBullet ? trimmed.slice(2) : line;
        const parts = content.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
        if (line.trim() === "") return <View key={li} style={{ height: 8 }} />;
        return (
          <View key={li} style={{ flexDirection: "row", marginTop: li === 0 ? 0 : 3 }}>
            {isBullet && <Text style={[style, { color: colors.brandTertiary, marginRight: 6 }]}>•</Text>}
            <Text style={[style, { flex: 1 }]}>
              {parts.map((p, pi) =>
                p.startsWith("**") && p.endsWith("**") ? (
                  <Text key={pi} style={{ fontWeight: "800" }}>{p.slice(2, -2)}</Text>
                ) : (
                  <Text key={pi}>{p}</Text>
                ),
              )}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function TypingDots() {
  const d1 = useSharedValue(0.3);
  const d2 = useSharedValue(0.3);
  const d3 = useSharedValue(0.3);
  useEffect(() => {
    const cfg = { duration: 500, easing: Easing.inOut(Easing.ease) };
    d1.value = withRepeat(withTiming(1, cfg), -1, true);
    d2.value = withDelay(160, withRepeat(withTiming(1, cfg), -1, true));
    d3.value = withDelay(320, withRepeat(withTiming(1, cfg), -1, true));
  }, []);
  const s1 = useAnimatedStyle(() => ({ opacity: d1.value }));
  const s2 = useAnimatedStyle(() => ({ opacity: d2.value }));
  const s3 = useAnimatedStyle(() => ({ opacity: d3.value }));
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 3 }}>
      <Animated.View style={[styles.typingDot, s1]} />
      <Animated.View style={[styles.typingDot, s2]} />
      <Animated.View style={[styles.typingDot, s3]} />
    </View>
  );
}

export default function Chat() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<ScrollView | null>(null);

  useEffect(() => {
    (async () => {
      let sid = await storage.getItem(SESSION_KEY);
      // On web, allow a ?sid= deep link to open a specific conversation.
      if (Platform.OS === "web" && typeof window !== "undefined") {
        const q = new URLSearchParams(window.location.search).get("sid");
        if (q) sid = q;
      }
      if (!sid) {
        sid = "abi-" + Math.random().toString(36).slice(2, 10) + "-" + Date.now();
      }
      await storage.setItem(SESSION_KEY, sid);
      setSessionId(sid);
      // Restore any prior conversation for this session so the chat feels
      // continuous instead of resetting every time it's opened.
      try {
        const hist = await api.getChat(sid);
        const prior: Msg[] = (hist?.messages || [])
          .filter((m: any) => m.role === "user" || m.role === "assistant")
          .map((m: any) => ({
            role: m.role,
            text: m.text,
            at: m.at ? new Date(m.at).getTime() || Date.now() : Date.now(),
          }));
        if (prior.length) {
          setMessages(prior);
          setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 60);
        }
      } catch {}
    })();
  }, []);

  const send = async (raw?: string) => {
    const text = (raw ?? input).trim();
    if (!text || !sessionId || busy) return;
    setInput("");
    const next: Msg[] = [...messages, { role: "user", text, at: Date.now() }];
    setMessages(next);
    setBusy(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    try {
      const r = await api.chatMessage(sessionId, text);
      setMessages([...next, { role: "assistant", text: r.reply, at: Date.now() }]);
    } catch (e: any) {
      setMessages([...next, { role: "assistant", text: "Sorry, I'm having trouble reaching the assistant right now. Please try again in a moment.", at: Date.now() }]);
    } finally {
      setBusy(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: "#000" }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} testID="chat-back">
          <BackIcon />
        </Pressable>
        <AbiAvatar size={40} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.headerTitle}>Abi</Text>
          <View style={styles.statusRow}>
            <View style={styles.onlineDot} />
            <Text style={styles.headerSub}>Online · AIB digital assistant</Text>
          </View>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 12 }}
        testID="chat-scroll"
      >
        {messages.length === 0 && (
          <View style={styles.empty}>
            <AbiAvatar size={72} />
            <Text style={styles.emptyTitle}>Hi, I'm Abi.</Text>
            <Text style={styles.emptyBody}>Ask me about your recent transfers, why SEPA takes up to 24 hours, or how to find something in the app.</Text>
            <Text style={styles.chipsLabel}>Try asking</Text>
            <View style={styles.chips}>
              {SUGGESTIONS.map((s) => (
                <Pressable key={s} style={styles.chip} onPress={() => send(s)} testID={`suggest-${s.slice(0, 10)}`}>
                  <Text style={styles.chipText}>{s}</Text>
                  <SparkleIcon size={13} color={colors.brandTertiary} />
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {messages.map((m, i) => {
          const isUser = m.role === "user";
          const prev = messages[i - 1];
          const grouped = prev && prev.role === m.role;
          return (
            <View
              key={i}
              style={[styles.bubbleRow, isUser ? styles.rowUser : styles.rowBot, { marginTop: grouped ? 4 : 14 }]}
            >
              {!isUser && (
                <View style={styles.botAvatarSlot}>
                  {!grouped ? <AbiAvatar size={28} /> : <View style={{ width: 28 }} />}
                </View>
              )}
              <View style={{ maxWidth: "80%", alignItems: isUser ? "flex-end" : "flex-start" }}>
                <View
                  style={[
                    styles.bubble,
                    isUser ? styles.bubbleUser : styles.bubbleBot,
                    isUser
                      ? { borderTopRightRadius: grouped ? 18 : 6 }
                      : { borderTopLeftRadius: grouped ? 18 : 6 },
                  ]}
                >
                  {isUser ? (
                    <Text style={styles.textUser}>{m.text}</Text>
                  ) : (
                    <RichText text={m.text} style={styles.textBot} />
                  )}
                </View>
                <Text style={[styles.timestamp, isUser ? { textAlign: "right" } : null]}>{clockTime(m.at)}</Text>
              </View>
            </View>
          );
        })}

        {busy && (
          <View style={[styles.bubbleRow, styles.rowBot, { marginTop: 14 }]}>
            <View style={styles.botAvatarSlot}>
              <AbiAvatar size={28} />
            </View>
            <View style={[styles.bubble, styles.bubbleBot, { borderTopLeftRadius: 6 }]}>
              <TypingDots />
            </View>
          </View>
        )}
      </ScrollView>

      {/* Input bar */}
      <View style={[styles.inputBar, { paddingBottom: insets.bottom + 10 }]}>
        <View style={styles.inputWrap}>
          <TextInput
            style={styles.input}
            placeholder="Message Abi…"
            placeholderTextColor={colors.muted}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={() => send()}
            returnKeyType="send"
            multiline
            testID="chat-input"
          />
        </View>
        <Pressable
          style={[styles.sendBtn, (!input.trim() || busy) && styles.sendBtnDisabled]}
          disabled={!input.trim() || busy}
          onPress={() => send()}
          testID="chat-send"
        >
          <SendIcon />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: "#0A0A0A",
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center", marginRight: 10 },
  headerTitle: { color: "#fff", fontSize: 19, fontWeight: "900", letterSpacing: 0.2 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 },
  onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.success },
  headerSub: { color: colors.muted, fontSize: 12 },

  empty: { alignItems: "center", paddingVertical: 30, paddingHorizontal: 8 },
  emptyTitle: { color: "#fff", fontSize: 24, fontWeight: "900", marginTop: 18 },
  emptyBody: { color: colors.muted, fontSize: 14, textAlign: "center", marginTop: 10, lineHeight: 21, paddingHorizontal: 20, maxWidth: 340 },
  chipsLabel: { color: colors.muted, fontSize: 11, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase", marginTop: 26, marginBottom: 4 },
  chips: { width: "100%", maxWidth: 380, gap: 10, marginTop: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surfaceSecondary,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  chipText: { color: "#EED4F5", fontSize: 14, fontWeight: "700", flex: 1, marginRight: 10 },

  bubbleRow: { flexDirection: "row", alignItems: "flex-end" },
  rowUser: { justifyContent: "flex-end" },
  rowBot: { justifyContent: "flex-start" },
  botAvatarSlot: { width: 28, marginRight: 8, alignSelf: "flex-end" },
  bubble: { paddingVertical: 11, paddingHorizontal: 14, borderRadius: 18 },
  bubbleUser: { backgroundColor: colors.brandPrimary },
  bubbleBot: { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  textUser: { color: "#fff", fontSize: 15, lineHeight: 21 },
  textBot: { color: "#F5F5F5", fontSize: 15, lineHeight: 21 },
  timestamp: { color: "#5C5C5C", fontSize: 11, marginTop: 4, marginHorizontal: 4 },

  typingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brandTertiary },

  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: "#0A0A0A",
  },
  inputWrap: {
    flex: 1,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    justifyContent: "center",
    minHeight: 46,
  },
  input: { color: "#fff", fontSize: 15, paddingVertical: 12, maxHeight: 120 },
  sendBtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  sendBtnDisabled: { backgroundColor: colors.surfaceTertiary, opacity: 0.7 },
});
