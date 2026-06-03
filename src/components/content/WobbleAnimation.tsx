import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

/**
 * WobbleAnimation Component
 * 
 * Displays animated three dots with a wobble effect to indicate loading/thinking state
 * for the AI assistant response.
 */
interface WobbleAnimationProps {
  text?: string;
}

export default function WobbleAnimation({ text = 'Thinking' }: WobbleAnimationProps) {
  const [dotOpacities] = useState([
    new Animated.Value(0.5),
    new Animated.Value(0.5),
    new Animated.Value(0.5),
  ]);

  useEffect(() => {
    const animateSequence = () => {
      Animated.sequence([
        Animated.parallel([
          Animated.timing(dotOpacities[0], {
            toValue: 1,
            duration: 400,
            useNativeDriver: false,
          }),
        ]),
        Animated.parallel([
          Animated.timing(dotOpacities[0], {
            toValue: 0.5,
            duration: 200,
            useNativeDriver: false,
          }),
          Animated.timing(dotOpacities[1], {
            toValue: 1,
            duration: 400,
            useNativeDriver: false,
          }),
        ]),
        Animated.parallel([
          Animated.timing(dotOpacities[1], {
            toValue: 0.5,
            duration: 200,
            useNativeDriver: false,
          }),
          Animated.timing(dotOpacities[2], {
            toValue: 1,
            duration: 400,
            useNativeDriver: false,
          }),
        ]),
        Animated.timing(dotOpacities[2], {
          toValue: 0.5,
          duration: 200,
          useNativeDriver: false,
        }),
      ]).start(() => {
        animateSequence();
      });
    };

    animateSequence();
  }, [dotOpacities]);

  return (
    <View style={styles.container}>
      <Text style={styles.text}>{text}</Text>
      <View style={styles.dotsContainer}>
        {dotOpacities.map((opacity, index) => (
          <Animated.View
            key={index}
            style={[
              styles.dot,
              {
                opacity,
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  text: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#6366f1',
  },
});
