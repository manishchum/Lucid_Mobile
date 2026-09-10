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
  minimumDurationMs?: number; // Minimum branding display time (default 1500ms)
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  isDataReady = true,
  onAnimationComplete,
  minimumDurationMs = 1500,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.88)).current;
  const logoPulse = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const screenFadeOut = useRef(new Animated.Value(1)).current;
  const screenScaleOut = useRef(new Animated.Value(1)).current;

  const [loadingStageText, setLoadingStageText] = useState("Initializing workspace...");
  const isCompletedRef = useRef(false);
  const minDurationPassedRef = useRef(false);
  const startTimeRef = useRef(Date.now());

  useEffect(() => {
    // 1. Entrance animation (fade in & spring scale)
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
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

    // 2. Continuous pulse animation for logo glow
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

    // 3. Shimmer highlight loop across progress bar
    const shimmerLoop = Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 1400,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    shimmerLoop.start();

    // 4. Initial progress animation up to 85% over minimumDurationMs
    Animated.timing(progressAnim, {
      toValue: 0.85,
      duration: minimumDurationMs,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();

    // 5. Track progress changes to update dynamic stage text
    const listenerId = progressAnim.addListener(({ value }) => {
      if (value < 0.35) {
        setLoadingStageText("Initializing workspace...");
      } else if (value < 0.7) {
        setLoadingStageText("Syncing learning sprints...");
      } else if (value < 0.95) {
        setLoadingStageText("Preparing your dashboard...");
      } else {
        setLoadingStageText("Ready to launch!");
      }
    });

    // 6. Minimum timer flag
    const minTimer = setTimeout(() => {
      minDurationPassedRef.current = true;
    }, minimumDurationMs);

    return () => {
      progressAnim.removeListener(listenerId);
      clearTimeout(minTimer);
      pulseLoop.stop();
      shimmerLoop.stop();
    };
  }, []);

  // Check whenever isDataReady or minimum duration changes
  useEffect(() => {
    const checkAndComplete = () => {
      if (isCompletedRef.current) return;
      if (!isDataReady) return;

      const elapsed = Date.now() - startTimeRef.current;
      const remainingMs = Math.max(0, minimumDurationMs - elapsed);

      setTimeout(() => {
        if (isCompletedRef.current) return;
        isCompletedRef.current = true;

        console.log(`[SplashScreen] 🚀 Data ready & minimum duration met in ${Date.now() - startTimeRef.current}ms`);

        // Spring progress to 100%
        Animated.spring(progressAnim, {
          toValue: 1,
          friction: 7,
          tension: 60,
          useNativeDriver: false,
        }).start(() => {
          setLoadingStageText("Ready to launch!");

          // Rebound celebration bounce on logo
          Animated.sequence([
            Animated.timing(logoPulse, {
              toValue: 1.08,
              duration: 120,
              useNativeDriver: true,
            }),
            Animated.timing(logoPulse, {
              toValue: 1,
              duration: 120,
              useNativeDriver: true,
            }),
          ]).start(() => {
            // Smooth exit transition (fade + slight scale expand)
            Animated.parallel([
              Animated.timing(screenFadeOut, {
                toValue: 0,
                duration: 280,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
              }),
              Animated.timing(screenScaleOut, {
                toValue: 1.04,
                duration: 280,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
              }),
            ]).start(() => {
              if (onAnimationComplete) {
                onAnimationComplete();
              }
            });
          });
        });
      }, remainingMs);
    };

    checkAndComplete();
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
          // style={[
          //   styles.logoCard,
          //   {
          //     transform: [{ scale: logoPulse }],
          //   },
          // ]}
        >
          <Image
            source={require("../../../assets/logo.png")}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </Animated.View>

        {/* App Title */}
        <Text style={styles.title}>Workfloww</Text>

        {/* Subtitle / Tagline */}
        <Text style={styles.subtitle}>Empower Your Learning</Text>
      </Animated.View>

      {/* Bottom Sleek Dynamic Progress Loader */}
      <View style={styles.progressContainer}>
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
          </Animated.View>
        </View>

        <View style={styles.statusRow}>
          <Text style={styles.loadingText}>{loadingStageText}</Text>
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
    marginBottom: 12,
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
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
    letterSpacing: 0.2,
  },
});

export default SplashScreen;
