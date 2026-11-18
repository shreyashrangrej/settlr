import {
  ArrowLeft,
  LayoutDashboard,
  Sparkles,
  User,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react-native'
import Svg, { Path } from 'react-native-svg'

// Lucide, the web app's icon set (and T3 Code's), at T3's lighter 1.75
// stroke. The tab icons match the web sidebar's.

type IconProps = { color: string; size?: number; strokeWidth?: number }

function lucide(Icon: LucideIcon, defaultSize = 24) {
  return function LucideGlyph({ color, size = defaultSize, strokeWidth = 1.75 }: IconProps) {
    return <Icon color={color} size={size} strokeWidth={strokeWidth} />
  }
}

export const HomeIcon = lucide(LayoutDashboard)
export const GroupsIcon = lucide(Users)
export const FriendsIcon = lucide(User)
export const PersonalIcon = lucide(Wallet)
export const AssistantIcon = lucide(Sparkles)
export const BackIcon = lucide(ArrowLeft)

/** Google's "G" as a single-colour line mark (Lucide has no brand icons). */
export function GoogleIcon({ color, size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round">
      <Path d="M20.5 12a8.5 8.5 0 1 1-2.5-6" />
      <Path d="M20.5 12H12.5" />
    </Svg>
  )
}
