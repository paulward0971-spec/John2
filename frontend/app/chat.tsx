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
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

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

type Msg = { role: "user" | "assistant"; text: string };

function BackIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M15 5 L8 12 L15 19" stroke="#E1BEE7" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}
function SendIcon({ color = "#fff" }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M4 12 L20 4 L14 20 L12 13 L4 12 Z" fill={color} />
    </Svg>
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
      if (!sid) {
        sid = "abi-" + Math.random().toString(36).slice(2, 10) + "-" + Date.now();
        await storage.setItem(SESSION_KEY, sid);
      }
      setSessionId(sid);
    })();
  }, []);

  const send = async (raw?: string) => {
    const text = (raw ?? input).trim();
    if (!text || !sessionId || busy) return;
    setInput("");
    const next: Msg[] = [...messages, { role: "user", text }];
    setMessages(next);
    setBusy(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    try {
      const r = await api.chatMessage(sessionId, text);
      setMessages([...next, { role: "assistant", text: r.reply }]);
    } catch (e: any) {
      setMessages([...next, { role: "assistant", text: "Sorry, I'm having trouble reaching the assistant right now. Please try again in a moment." }]);
    } finally {
      setBusy(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: "#000" }}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} testID="chat-back">
          <BackIcon />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Abi</Text>
          <Text style={styles.headerSub}>AIB digital assistant</Text>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
        testID="chat-scroll"
      >
        {messages.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Hi, I'm Abi.</Text>
            <Text style={styles.emptyBody}>Ask me about your recent transfers, why SEPA takes up to 24 hours, or how to find something in the app.</Text>
            <View style={styles.chips}>
              {SUGGESTIONS.map((s) => (
                <Pressable key={s} style={styles.chip} onPress={() => send(s)} testID={`suggest-${s.slice(0,10)}`}>
                  <Text style={styles.chipText}>{s}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
        {messages.map((m, i) => (
          <View key={i} style={[styles.bubbleRow, m.role === "user" ? styles.rowUser : styles.rowBot]}>
            <View style={[styles.bubble, m.role === "user" ? styles.bubbleUser : styles.bubbleBot]}>
              <Text style={m.role === "user" ? styles.textUser : styles.textBot}>{m.text}</Text>
            </View>
          </View>
        ))}
        {busy && (
          <View style={[styles.bubbleRow, styles.rowBot]}>
            <View style={[styles.bubble, styles.bubbleBot, { flexDirection: "row", alignItems: "center", gap: 8 }]}>
              <ActivityIndicator color={colors.brandTertiary} />
              <Text style={styles.textBot}>Abi is typing…</Text>
            </View>
          </View>
        )}
      </ScrollView>

      <View style={[styles.inputBar, { paddingBottom: insets.bottom + 8 }]}>
        <TextInput
          style={styles.input}
          placeholder="Ask Abi anything…"
          placeholderTextColor={colors.muted}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={() => send()}
          returnKeyType="send"
          testID="chat-input"
        />
        <Pressable style={[styles.sendBtn, (!input.trim() || busy) && { opacity: 0.4 }]} disabled={!input.trim() || busy} onPress={() => send()} testID="chat-send">
          <SendIcon />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#1A1A1A" },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#1A1A1A", alignItems: "center", justifyContent: "center" },
  headerTitle: { color: "#fff", fontSize: 20, fontWeight: "900" },
  headerSub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  empty: { alignItems: "center", paddingVertical: 24 },
  emptyTitle: { color: "#fff", fontSize: 22, fontWeight: "900" },
  emptyBody: { color: colors.muted, fontSize: 14, textAlign: "center", marginTop: 8, lineHeight: 20, paddingHorizontal: 24 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 20, justifyContent: "center" },
  chip: { backgroundColor: "#161616", borderColor: "#2A2A2A", borderWidth: 1, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 14 },
  chipText: { color: "#E1BEE7", fontSize: 13, fontWeight: "700" },
  bubbleRow: { marginTop: 10, flexDirection: "row" },
  rowUser: { justifyContent: "flex-end" },
  rowBot: { justifyContent: "flex-start" },
  bubble: { maxWidth: "82%", padding: 12, borderRadius: 16 },
  bubbleUser: { backgroundColor: colors.brandPrimary, borderBottomRightRadius: 4 },
  bubbleBot: { backgroundColor: "#161616", borderBottomLeftRadius: 4 },
  textUser: { color: "#fff", fontSize: 15, lineHeight: 21 },
  textBot: { color: "#fff", fontSize: 15, lineHeight: 21 },
  inputBar: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderTopWidth: 1, borderTopColor: "#1A1A1A", backgroundColor: "#000" },
  input: { flex: 1, backgroundColor: "#161616", color: "#fff", borderRadius: 999, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15 },
  sendBtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
});
