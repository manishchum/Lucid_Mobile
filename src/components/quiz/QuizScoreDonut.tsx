import React from "react";
import { View, Text } from "react-native";
import Svg, { Circle } from "react-native-svg";

interface QuizScoreDonutProps {
  score: number;
  max: number;
  pct: number;
  passed: boolean;
  threshold: number;
  size?: number;
}

export const QuizScoreDonut: React.FC<QuizScoreDonutProps> = ({
  score,
  max,
  pct,
  passed,
  threshold,
  size = 180,
}) => {
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset =
    circumference - (circumference * Math.min(Math.max(pct, 0), 100)) / 100;
  const activeColor = passed ? "#10B981" : "#F59E0B";
  const trackColor = passed ? "#D1FAE5" : "#FEF3C7";

  return (
    <View
      style={{
        width: size,
        height: size,
        justifyContent: "center",
        alignItems: "center",
        alignSelf: "center",
        marginVertical: 20,
      }}
    >
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={activeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="none"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View
        style={{
          position: "absolute",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Text
          style={{
            fontSize: 34,
            fontWeight: "900",
            color: "#0F172A",
            letterSpacing: -1,
          }}
        >
          {Math.round(pct)}%
        </Text>
        <Text
          style={{
            fontSize: 12,
            fontWeight: "600",
            color: "#64748B",
            marginTop: 2,
          }}
        >
          {score} / {max} Correct
        </Text>
        <Text
          style={{
            fontSize: 11,
            fontWeight: "700",
            color: passed ? "#10B981" : "#D97706",
            marginTop: 2,
          }}
        >
          Pass Target: {threshold}%
        </Text>
      </View>
    </View>
  );
};
