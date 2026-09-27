import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { LogBox, StatusBar, Platform } from "react-native";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { ErrorBoundary } from "@/src/components/error-boundary";
import { queryClient } from "@/src/query-client";

LogBox.ignoreAllLogs(true);

// On web, dev-only gesture-handler warnings ("Cannot find single active
// touch") and other RN warnings render as red toast pop-ups over the app
// and make it feel unpolished when installed to home screen. Silence them.
if (Platform.OS === "web" && typeof console !== "undefined") {
  const _warn = console.warn;
  const _error = console.error;
  const shouldHide = (msg: unknown) =>
    typeof msg === "string" &&
    /(single active touch|GestureHandler|useNativeDriver|EventEmitter\.removeListener|Non-serializable values)/i.test(
      msg,
    );
  console.warn = (...args: any[]) => {
    if (shouldHide(args[0])) return;
    _warn.apply(console, args);
  };
  console.error = (...args: any[]) => {
    if (shouldHide(args[0])) return;
    _error.apply(console, args);
  };
}

// Inject PWA meta tags on the web build so the app installs cleanly to the
// iOS/Android home screen: no browser address bar, dark status bar tinted
// AIB purple, correct app icon and title. In Expo dev the SPA HTML shell is
// generated at build time, so runtime injection is the reliable path.
if (Platform.OS === "web" && typeof document !== "undefined") {
  const AIB_PURPLE = "#8E24AA";
  const APP_BG = "#0A0A0A";
  const APP_NAME = "AIB";
  const setMeta = (name: string, content: string, attr: "name" | "property" = "name") => {
    let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
    if (!el) {
      el = document.createElement("meta");
      el.setAttribute(attr, name);
      document.head.appendChild(el);
    }
    el.setAttribute("content", content);
  };
  const setLink = (rel: string, href: string, extra?: Record<string, string>) => {
    let el = document.querySelector(
      `link[rel="${rel}"]${extra?.sizes ? `[sizes="${extra.sizes}"]` : ""}`,
    ) as HTMLLinkElement | null;
    if (!el) {
      el = document.createElement("link");
      el.setAttribute("rel", rel);
      if (extra?.sizes) el.setAttribute("sizes", extra.sizes);
      document.head.appendChild(el);
    }
    el.setAttribute("href", href);
  };
  // Viewport (needs viewport-fit=cover for the notch)
  const vp = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null;
  if (vp)
    vp.setAttribute(
      "content",
      "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover",
    );
  // Standalone launch (no browser chrome / search bar)
  setMeta("apple-mobile-web-app-capable", "yes");
  setMeta("mobile-web-app-capable", "yes");
  setMeta("apple-mobile-web-app-status-bar-style", "black-translucent");
  setMeta("apple-mobile-web-app-title", APP_NAME);
  setMeta("application-name", APP_NAME);
  setMeta("format-detection", "telephone=no");
  setMeta("theme-color", AIB_PURPLE);
  // Icons
  const iconPath = "/assets/assets/images/icon.png";
  const splashPath = "/assets/assets/images/splash-image.png";
  setLink("apple-touch-icon", iconPath);
  setLink("apple-touch-icon", iconPath, { sizes: "180x180" });
  setLink("apple-touch-icon", iconPath, { sizes: "192x192" });
  setLink("apple-touch-icon", iconPath, { sizes: "512x512" });
  setLink("apple-touch-startup-image", splashPath);
  // Web app manifest as inline data URL
  const manifest = {
    name: APP_NAME,
    short_name: APP_NAME,
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: APP_BG,
    theme_color: AIB_PURPLE,
    icons: [
      { src: iconPath, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: iconPath, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/assets/assets/images/adaptive-icon.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
  setLink(
    "manifest",
    "data:application/manifest+json;charset=utf-8," + encodeURIComponent(JSON.stringify(manifest)),
  );
  // Global CSS: block over-scroll rubber-band, disable text-selection callouts,
  // fill the notch/home-indicator area and hide dev-only red toasts.
  const styleId = "aib-pwa-styles";
  if (!document.getElementById(styleId)) {
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      html, body {
        background: ${APP_BG};
        overscroll-behavior: none;
        -webkit-tap-highlight-color: transparent;
        -webkit-touch-callout: none;
        -webkit-user-select: none;
        user-select: none;
        touch-action: manipulation;
      }
      html { position: fixed; width: 100%; height: 100%; overflow: hidden; }
      body {
        min-height: 100vh;
        min-height: 100dvh;
        min-height: -webkit-fill-available;
      }
      input, textarea { -webkit-user-select: text; user-select: text; }
      /* Kill dev-only red toast overlays that break the "real app" feel */
      [class*="LogBox"], [id*="logbox"], [aria-label*="LogBox"],
      [role="alert"][style*="rgb(255, 51, 51)"],
      [role="alert"][style*="rgb(255, 82, 82)"],
      [data-testid*="log-box"] {
        display: none !important;
        visibility: hidden !important;
        pointer-events: none !important;
      }
    `;
    document.head.appendChild(style);
  }
  document.title = APP_NAME;
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#0A0A0A" }}>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            <KeyboardProvider>
              <StatusBar barStyle="light-content" backgroundColor="#4A0E5C" />
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: "#0A0A0A" },
                  animation: Platform.OS === "web" ? "none" : "fade",
                }}
              />
            </KeyboardProvider>
          </QueryClientProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
