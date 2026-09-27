// @ts-nocheck
// PWA-ready HTML shell. When the user adds the site to their home screen on
// iOS/Android it launches in standalone mode: NO Safari/Chrome address bar,
// NO tab strip, notch/home-indicator safe, dark status bar tinted to AIB
// purple. This is what makes it feel like a real App Store app.
import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

const AIB_PURPLE = "#8E24AA";
const AIB_DEEP = "#4A0E5C";
// App itself is dark. The body background must match the app root so it never
// bleeds through under the header when Safari over-scroll bounces.
const APP_BG = "#0A0A0A";
const APP_NAME = "AIB";

// Inline web app manifest (data-URL) so the browser knows this site is
// installable without us needing to serve a separate /manifest.webmanifest.
const manifest = {
  name: "AIB",
  short_name: "AIB",
  start_url: "/",
  scope: "/",
  display: "standalone",
  orientation: "portrait",
  background_color: AIB_DEEP,
  theme_color: AIB_PURPLE,
  icons: [
    { src: "/assets/assets/images/icon.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/assets/assets/images/icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "/assets/assets/images/adaptive-icon.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
};
const manifestHref =
  "data:application/manifest+json;charset=utf-8," +
  encodeURIComponent(JSON.stringify(manifest));

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en" style={{ height: "100%", background: APP_BG }}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        {/* viewport-fit=cover extends the viewport into the notch / home-indicator
            area so our SafeAreaProvider insets can push content correctly.
            maximum-scale=1 + user-scalable=no keeps the pinch-zoom disabled so
            it behaves like a native app. */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover, shrink-to-fit=no"
        />

        {/* --- iOS Add-to-Home-Screen (removes Safari chrome, the search bar) --- */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content={APP_NAME} />
        <meta name="application-name" content={APP_NAME} />
        <meta name="format-detection" content="telephone=no" />

        {/* --- Android / Chrome PWA --- */}
        <meta name="theme-color" content={AIB_PURPLE} />
        <link rel="manifest" href={manifestHref} />

        {/* --- Icons for both platforms --- */}
        <link rel="icon" href="/assets/assets/images/favicon.png" />
        <link rel="apple-touch-icon" href="/assets/assets/images/icon.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/assets/assets/images/icon.png" />
        <link rel="apple-touch-icon" sizes="192x192" href="/assets/assets/images/icon.png" />
        <link rel="apple-touch-icon" sizes="512x512" href="/assets/assets/images/icon.png" />
        <link rel="apple-touch-startup-image" href="/assets/assets/images/splash-image.png" />

        <title>{APP_NAME}</title>

        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              html, body {
                background: ${APP_BG};
                overscroll-behavior: none;
                -webkit-tap-highlight-color: transparent;
                -webkit-touch-callout: none;
                -webkit-user-select: none;
                user-select: none;
                touch-action: manipulation;
              }
              body {
                /* Fill the visible viewport, including under the notch and
                   above the home indicator, on iOS standalone. */
                min-height: 100vh;
                min-height: 100dvh;
                min-height: -webkit-fill-available;
                padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
                box-sizing: border-box;
              }
              body > div:first-child {
                position: fixed !important;
                top: 0; left: 0; right: 0; bottom: 0;
                padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
                box-sizing: border-box;
              }
              /* Kill the pull-to-refresh + rubber-band scroll on mobile Safari */
              html { position: fixed; width: 100%; height: 100%; overflow: hidden; }
              /* Selectable regions when we do want text selection */
              input, textarea { -webkit-user-select: text; user-select: text; }
              [role="tablist"] [role="tab"] * { overflow: visible !important; }
              [role="heading"], [role="heading"] * { overflow: visible !important; }

              /* Hide React Native / Expo dev warning banners on web
                 (e.g. "Cannot find single active touch" from gesture handler,
                 LogBox toasts, red boxes). They are dev-only noise that
                 covers real UI in the preview and on Add-to-Home-Screen. */
              [class*="LogBox"], [id*="logbox"],
              [aria-label*="LogBox"],
              [role="alert"][style*="rgb(255, 51, 51)"],
              [role="alert"][style*="rgb(255, 82, 82)"],
              [data-testid*="log-box"],
              [class*="withDevTools"] > div[style*="position: absolute"][style*="bottom"] {
                display: none !important;
                visibility: hidden !important;
                pointer-events: none !important;
              }
            `,
          }}
        />
      </head>
      <body
        style={{
          margin: 0,
          height: "100%",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          background: APP_BG,
        }}
      >
        {children}
      </body>
    </html>
  );
}
