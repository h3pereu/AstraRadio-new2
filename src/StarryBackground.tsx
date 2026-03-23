import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Animated, useWindowDimensions } from 'react-native';

const STAR_COUNT = 80;

interface Star {
    x: number;
    y: number;
    size: number;
    opacity: Animated.Value;
    duration: number;
}

const StarryBackground: React.FC = () => {
    const { width, height } = useWindowDimensions();
    const [stars, setStars] = useState<Star[]>([]);

    useEffect(() => {
        if (!width || !height) {
            return;
        }

        // Generate random stars
        const newStars = Array.from({ length: STAR_COUNT }, () => {
            const opacity = new Animated.Value(Math.random() * 0.5 + 0.2);
            const duration = Math.random() * 3000 + 2000; // 2-5 seconds

            return {
                x: Math.random() * width,
                y: Math.random() * height,
                size: Math.random() * 2 + 1, // 1-3px
                opacity,
                duration,
            };
        });

        setStars(newStars);

        // Animate stars (twinkling effect)
        newStars.forEach((star) => {
            const twinkle = () => {
                Animated.sequence([
                    Animated.timing(star.opacity, {
                        toValue: Math.random() * 0.3 + 0.1,
                        duration: star.duration,
                        useNativeDriver: true,
                    }),
                    Animated.timing(star.opacity, {
                        toValue: Math.random() * 0.8 + 0.4,
                        duration: star.duration,
                        useNativeDriver: true,
                    }),
                ]).start(() => twinkle());
            };
            twinkle();
        });
    }, [width, height]);

    return (
        <View style={styles.container} pointerEvents="none">
            {stars.map((star, index) => (
                <Animated.View
                    key={index}
                    style={[
                        styles.star,
                        {
                            left: star.x,
                            top: star.y,
                            width: star.size,
                            height: star.size,
                            opacity: star.opacity,
                        },
                    ]}
                />
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 0,
    },
    star: {
        position: 'absolute',
        backgroundColor: '#FFFFFF',
        borderRadius: 100,
    },
});

export default StarryBackground;
