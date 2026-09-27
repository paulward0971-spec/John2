// Splash — uses the user's custom AIB artwork verbatim (logo + purple wave
// baked into the image). Fades in on mount, holds ~2 s, then routes based
// on the invite-gate state:
//   • Gate off + no owner yet: bootstrap this phone as the owner device
//   • Gate off + owner exists: straight to /passcode
//   • Gate on + device already redeemed: /passcode
//   • Gate on + no valid token: /invite (must enter a 4-digit PIN)
import React, { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
} from "react-native-reanimated";

import {
  bootstrapOwner,
  getGateStatus,
  verifyDevice,
} from "@/src/gate";

const AIB_PURPLE = "#671085";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const SPLASH_ART = require("../assets/images/splash-user.png");

async function decideNextRoute(): Promise<"/invite" | "/passcode"> {
  try {
    const status = await getGateStatus();
    // No owner claimed yet — this device becomes the owner and skips the gate
    if (!status.has_owner) {
      try {
        await bootstrapOwner();
      } catch {}
      return "/passcode";
    }
    // If the gate isn't enabled, everyone goes straight through
    if (!status.enabled) return "/passcode";
    // Gate on — need a valid device session
    const v = await verifyDevice();
    if (v.valid) return "/passcode";
    return "/invite";
  } catch {
    // If the backend is unreachable we don't want to hard-lock the user;
    // fall through to the PAC screen. Real gating still applies once the
    // network returns.
    return "/passcode";
  }
}

export default function Splash() {
  const router = useRouter();
  const opacity = useSharedValue(0);
  const scale = useSharedValue(1.02);

  useEffect(() => {
    opacity.value = withTiming(1, {
      duration: 550,
      easing: Easing.out(Easing.cubic),
    });
    scale.value = withTiming(1, {
      duration: 900,
      easing: Easing.out(Easing.cubic),
    });

    let cancelled = false;
    (async () => {
      const nextRoute = await decideNextRoute();
      if (cancelled) return;
      setTimeout(() => {
        opacity.value = withTiming(
          0,
          { duration: 480, easing: Easing.in(Easing.cubic) },
          (finished) => {
            if (finished) runOnJS(router.replace)(nextRoute);
          },
        );
      }, 1800);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <View style={styles.root} testID="splash-screen">
      <Animated.View style={[StyleSheet.absoluteFill, animStyle]}>
        <Image
          source={SPLASH_ART}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          contentPosition="center"
          transition={0}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: AIB_PURPLE,
  },
});
