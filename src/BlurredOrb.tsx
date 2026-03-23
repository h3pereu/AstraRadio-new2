import React from 'react';
import { ViewStyle } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Circle, Rect } from 'react-native-svg';

interface BlurredOrbProps {
    color: string;
    radius: number;
    opacity?: number;
    style?: ViewStyle;
}

export const BlurredOrb: React.FC<BlurredOrbProps> = ({ color, radius, opacity = 1, style }) => {
    const size = radius * 2;

    return (
        <Svg width={size} height={size} style={style}>
            <Defs>
                <RadialGradient
                    id="grad"
                    cx="50%"
                    cy="50%"
                    rx="50%"
                    ry="50%"
                    fx="50%"
                    fy="50%"
                    gradientUnits="userSpaceOnUse"
                >
                    <Stop offset="0%" stopColor={color} stopOpacity={opacity} />
                    <Stop offset="100%" stopColor={color} stopOpacity={0} />
                </RadialGradient>
            </Defs>
            <Circle cx={radius} cy={radius} r={radius} fill="url(#grad)" />
        </Svg>
    );
};
