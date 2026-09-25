import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  StatusBar,
  Platform,
  Image,
  Easing,
} from "react-native";

const { width } = Dimensions.get("window");

interface SplashScreenProps {
  isDataReady?: boolean;
  onAnimationComplete?: () => void;
  minimumDurationMs?: number; // Minimum branding display time (default 300ms)
  maxTimeoutMs?: number; // Maximum safety timeout before force-launching (default 6000ms)
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  isDataReady = true,
  onAnimationComplete,
  minimumDurationMs = 300,
  maxTimeoutMs = 6000,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.88)).current;
  const logoPulse = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const screenFadeOut = useRef(new Animated.Value(1)).current;
  const screenScaleOut = useRef(new Animated.Value(1)).current;

  const badgeScale = useRef(new Animated.Value(1)).current;
  const textFade = useRef(new Animated.Value(1)).current;
  const textTranslateY = useRef(new Animated.Value(0)).current;

  const [loadingStageText, setLoadingStageText] = useState("Initializing workspace...");
  const [displayPercent, setDisplayPercent] = useState(0);

  const isCompletedRef = useRef(false);
  const minDurationPassedRef = useRef(false);
  const isForceTimedOutRef = useRef(false);
  const startTimeRef = useRef(Date.now());

  const targetPercentRef = useRef(0);
  const displayPercentRef = useRef(0);
  const currentStageTextRef = useRef("Initializing workspace...");

  // Smooth Staggered Text Transition Helper
  const animateTextChange = (newText: string) => {
    if (currentStageTextRef.current === newText) return;
    currentStageTextRef.current = newText;

    Animated.parallel([
      Animated.timing(textFade, {
        toValue: 0,
        duration: 90,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(textTranslateY, {
        toValue: 5,
        duration: 90,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setLoadingStageText(newText);
      textTranslateY.setValue(-5);
      Animated.parallel([
        Animated.timing(textFade, {
          toValue: 1,
          duration: 130,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(textTranslateY, {
          toValue: 0,
          duration: 130,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  // 1. Silky Smooth 1% Step-by-Step Counter Loop (Every 14ms = ~70fps)
  useEffect(() => {
    const counterInterval = setInterval(() => {
      if (displayPercentRef.current < targetPercentRef.current) {
        displayPercentRef.current += 1;
        setDisplayPercent(displayPercentRef.current);
      } else if (displayPercentRef.current > targetPercentRef.current) {
        displayPercentRef.current -= 1;
        setDisplayPercent(displayPercentRef.current);
      }
    }, 14);

    return () => clearInterval(counterInterval);
  }, []);

  useEffect(() => {
    // 2. Entrance animation (fade in & spring scale)
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 350,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 45,
        useNativeDriver: true,
      }),
    ]).start();

    // 3. Continuous pulse animation for logo glow
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(logoPulse, {
          toValue: 1.05,
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(logoPulse, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();

    // 4. Shimmer highlight loop across progress bar
    const shimmerLoop = Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 1400,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    shimmerLoop.start();

    // 5. Organic Multi-Stage Dynamic Progress (0% -> 35% -> 72% -> 94% -> 98% crawl)
    progressAnim.setValue(0);
    Animated.sequence([
      Animated.timing(progressAnim, {
        toValue: 0.35,
        duration: 450,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }),
      Animated.timing(progressAnim, {
        toValue: 0.72,
        duration: 550,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: false,
      }),
      Animated.timing(progressAnim, {
        toValue: 0.94,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(progressAnim, {
        toValue: 0.98,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: false,
      }),
    ]).start();

    // 6. Track progress changes to set target percent & trigger staggered stage text
    const listenerId = progressAnim.addListener(({ value }) => {
      const target = Math.min(100, Math.max(0, Math.round(value * 100)));
      targetPercentRef.current = target;

      if (value < 0.35) {
        animateTextChange("Initializing workspace...");
      } else if (value < 0.72) {
        animateTextChange("Syncing learning sprints...");
      } else if (value < 0.95) {
        animateTextChange("Preparing your dashboard...");
      } else {
        animateTextChange("Ready to launch!");
      }
    });

    // 7. Minimum timer flag
    const minTimer = setTimeout(() => {
      minDurationPassedRef.current = true;
    }, minimumDurationMs);

    // 8. Safety timeout guard to prevent locking user if network stalls
    const maxSafetyTimer = setTimeout(() => {
      if (!isCompletedRef.current) {
        triggerExitSequence(true);
      }
    }, maxTimeoutMs);

    return () => {
      progressAnim.removeListener(listenerId);
      clearTimeout(minTimer);
      clearTimeout(maxSafetyTimer);
      pulseLoop.stop();
      shimmerLoop.stop();
    };
  }, []);

  const triggerExitSequence = (isForced: boolean = false) => {
    if (isCompletedRef.current) return;
    isCompletedRef.current = true;

    const durationMs = Date.now() - startTimeRef.current;
    if (isForced) {
      console.warn(`[SplashScreen] ⚠️ Safety timeout triggered after ${durationMs}ms — completing transition`);
    } else {
      console.log(`[SplashScreen] 🚀 Data ready & minimum duration met in ${durationMs}ms`);
    }

    // Fast-forward progress target to 100%
    targetPercentRef.current = 100;
    displayPercentRef.current = 100;
    setDisplayPercent(100);
    animateTextChange("Ready to launch!");

    Animated.timing(progressAnim, {
      toValue: 1,
      duration: isForced ? 100 : 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(() => {
      // Pop badge scale briefly
      Animated.sequence([
        Animated.timing(badgeScale, {
          toValue: 1.12,
          duration: 80,
          useNativeDriver: true,
        }),
        Animated.timing(badgeScale, {
          toValue: 1,
          duration: 80,
          useNativeDriver: true,
        }),
      ]).start();

      // Smooth exit transition (fade + slight scale expand)
      Animated.parallel([
        Animated.timing(screenFadeOut, {
          toValue: 0,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(screenScaleOut, {
          toValue: 1.03,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => {
        if (onAnimationComplete) {
          onAnimationComplete();
        }
      });
    });
  };

  // Check whenever isDataReady or minimum duration changes
  useEffect(() => {
    if (isCompletedRef.current) return;
    if (!isDataReady) return;

    const elapsed = Date.now() - startTimeRef.current;
    const remainingMs = Math.max(0, minimumDurationMs - elapsed);

    const timer = setTimeout(() => {
      triggerExitSequence(false);
    }, remainingMs);

    return () => clearTimeout(timer);
  }, [isDataReady, minimumDurationMs, onAnimationComplete]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  const shimmerTranslateX = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-width * 0.6, width * 0.6],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: screenFadeOut,
          transform: [{ scale: screenScaleOut }],
        },
      ]}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Subtle Ambient Light Accents */}
      <View style={styles.glowTopRight} />
      <View style={styles.glowBottomLeft} />
      <View style={styles.glowCenter} />

      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {/* Logo Wrapper Card with Glowing Pulse */}
        <Animated.View
          style={[
            styles.logoCard,
            {
              transform: [{ scale: logoPulse }],
            },
          ]}
        >
          <Image
            source={require("../../../assets/logo.png")}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </Animated.View>

        {/* App Title */}
        <Text style={styles.title}>Lucid</Text>

        {/* Subtitle / Tagline */}
        <Text style={styles.subtitle}>Empower Your Learning</Text>
      </Animated.View>

      {/* Bottom Sleek Dynamic Progress Loader */}
      <View style={styles.progressContainer}>
        <View style={styles.statusRow}>
          <Animated.View
            style={{
              opacity: textFade,
              transform: [{ translateY: textTranslateY }],
            }}
          >
            <Text style={styles.loadingText}>{loadingStageText}</Text>
          </Animated.View>
          <Animated.View
            style={[
              styles.percentBadge,
              {
                transform: [{ scale: badgeScale }],
              },
            ]}
          >
            <Text style={styles.percentText}>{displayPercent}%</Text>
          </Animated.View>
        </View>

        <View style={styles.track}>
          <Animated.View style={[styles.bar, { width: progressWidth }]}>
            {/* Shimmer Highlight */}
            <Animated.View
              style={[
                styles.shimmer,
                {
                  transform: [{ translateX: shimmerTranslateX }],
                },
              ]}
            />
            {/* Glowing Leading Head Dot */}
            <View style={styles.barHeadGlow} />
          </Animated.View>
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  },
  glowTopRight: {
    position: "absolute",
    top: -80,
    right: -80,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "rgba(99, 102, 241, 0.08)", // Soft Indigo tint
  },
  glowBottomLeft: {
    position: "absolute",
    bottom: -100,
    left: -100,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "rgba(16, 185, 129, 0.06)", // Soft Emerald tint
  },
  glowCenter: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(99, 102, 241, 0.04)",
  },
  content: {
    alignItems: "center",
    justifyContent: "center",
  },
  logoCard: {
    width: 96,
    height: 96,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
    shadowColor: "#6366F1",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 10,
    borderWidth: 1.5,
    borderColor: "rgba(241, 245, 249, 0.9)",
  },
  logoImage: {
    width: 72,
    height: 72,
    borderRadius: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.6,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: "500",
    color: "#64748B",
    letterSpacing: 0.3,
  },
  progressContainer: {
    position: "absolute",
    bottom: Platform.OS === "ios" ? 64 : 48,
    width: width * 0.68,
    alignItems: "center",
  },
  track: {
    width: "100%",
    height: 5,
    backgroundColor: "#F1F5F9",
    borderRadius: 3,
    overflow: "hidden",
  },
  bar: {
    height: "100%",
    backgroundColor: "#6366F1",
    borderRadius: 3,
    position: "relative",
    overflow: "hidden",
  },
  shimmer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 60,
    backgroundColor: "rgba(255, 255, 255, 0.45)",
  },
  barHeadGlow: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 6,
    borderRadius: 3,
    backgroundColor: "#A5B4FC",
    shadowColor: "#6366F1",
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 4,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 8,
  },
  loadingText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
    letterSpacing: 0.2,
  },
  percentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: "rgba(99, 102, 241, 0.08)",
  },
  percentText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#6366F1",
    letterSpacing: -0.2,
  },
});

export default SplashScreen;
