import Svg, { Circle, Path } from 'react-native-svg'

// Line icons drawn from the Android mocks (design/screens/android).

type IconProps = { color: string; size?: number; strokeWidth?: number }

export function HomeIcon({ color, size = 24, strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round">
      <Path d="M4 10.5 12 4l8 6.5V20H4z" />
      <Path d="M10 20v-5h4v5" />
    </Svg>
  )
}

export function GroupsIcon({ color, size = 24, strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round">
      <Circle cx={9} cy={8} r={3.5} />
      <Path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" />
      <Path d="M16 4.5a3.5 3.5 0 0 1 0 7" />
      <Path d="M18 14.3c2.1.7 3.5 2.8 3.5 5.7" />
    </Svg>
  )
}

export function FriendsIcon({ color, size = 24, strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round">
      <Circle cx={12} cy={8} r={3.8} />
      <Path d="M4.5 20.5c0-4 3.4-6.5 7.5-6.5s7.5 2.5 7.5 6.5" />
    </Svg>
  )
}

export function PersonalIcon({ color, size = 24, strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3" />
      <Path d="M4 7.5V18a2 2 0 0 0 2 2h14V8H6.5A2.5 2.5 0 0 1 4 7.5z" />
      <Path d="M16 14h.01" />
    </Svg>
  )
}

export function AssistantIcon({ color, size = 24, strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round">
      <Path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v10a1.5 1.5 0 0 1-1.5 1.5H9l-5 4z" />
    </Svg>
  )
}

export function GoogleIcon({ color, size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round">
      <Path d="M20.5 12a8.5 8.5 0 1 1-2.5-6" />
      <Path d="M20.5 12H12.5" />
    </Svg>
  )
}

export function BackIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M15 5l-7 7 7 7" />
    </Svg>
  )
}
