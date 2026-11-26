import type { Category } from '@settlr/shared/schemas'
import {
  Archive,
  ArrowDownLeft,
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Bed,
  Bell,
  BellRing,
  Calendar,
  Car,
  ChartColumn,
  ChartPie,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleExclamationPoint,
  CircleQuestionMark,
  Clock,
  Copy,
  Delete,
  EllipsisVertical,
  Globe,
  Hash,
  House,
  Layers,
  LogOut,
  Mail,
  MessageCircle,
  Mic,
  Minus,
  Moon,
  Palette,
  Pencil,
  PiggyBank,
  Plus,
  QrCode,
  Receipt,
  Repeat,
  RotateCcwClock,
  Search,
  Send,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Split,
  Sun,
  Tag,
  Ticket,
  Trash,
  User,
  UserPlus,
  Users,
  Utensils,
  Vibrate,
  Wallet,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react-native'
import Svg, { Circle, Path, Rect } from 'react-native-svg'

// Lucide, drawn in the current colour at a 2px stroke like the mocks.

export type IconProps = { color: string; size?: number; strokeWidth?: number }
export type IconComponent = (props: IconProps) => React.JSX.Element

function lucide(Glyph: LucideIcon, defaultStroke = 2): IconComponent {
  return function Icon({ color, size = 22, strokeWidth = defaultStroke }: IconProps) {
    return <Glyph color={color} size={size} strokeWidth={strokeWidth} />
  }
}

export const Icons = {
  home: lucide(House),
  users: lucide(Users),
  user: lucide(User),
  userPlus: lucide(UserPlus),
  pie: lucide(ChartPie),
  plus: lucide(Plus, 2.4),
  x: lucide(X),
  search: lucide(Search),
  bell: lucide(Bell),
  bellRing: lucide(BellRing),
  spark: lucide(Sparkles),
  chevL: lucide(ChevronLeft, 2.2),
  chevR: lucide(ChevronRight, 2.2),
  chevD: lucide(ChevronDown, 2.2),
  back: lucide(ArrowLeft),
  arrowR: lucide(ArrowRight),
  in: lucide(ArrowDownLeft, 2.2),
  out: lucide(ArrowUpRight, 2.2),
  check: lucide(Check, 2.6),
  more: lucide(EllipsisVertical),
  cal: lucide(Calendar),
  receipt: lucide(Receipt),
  food: lucide(Utensils),
  cart: lucide(ShoppingCart),
  car: lucide(Car),
  bed: lucide(Bed),
  zap: lucide(Zap),
  ticket: lucide(Ticket),
  tag: lucide(Tag),
  mic: lucide(Mic),
  del: lucide(Delete),
  trash: lucide(Trash),
  pen: lucide(Pencil),
  swap: lucide(ArrowLeftRight),
  chart: lucide(ChartColumn),
  mail: lucide(Mail),
  logout: lucide(LogOut),
  sun: lucide(Sun),
  moon: lucide(Moon),
  wallet: lucide(Wallet),
  piggy: lucide(PiggyBank),
  clock: lucide(Clock),
  verified: lucide(BadgeCheck),
  globe: lucide(Globe),
  help: lucide(CircleQuestionMark),
  palette: lucide(Palette),
  vibrate: lucide(Vibrate),
  copy: lucide(Copy),
  split: lucide(Split),
  repeat: lucide(Repeat),
  history: lucide(RotateCcwClock),
  archive: lucide(Archive),
  msg: lucide(MessageCircle),
  layers: lucide(Layers),
  send: lucide(Send),
  alert: lucide(CircleExclamationPoint),
  minus: lucide(Minus),
  phone: lucide(Smartphone),
  hash: lucide(Hash),
  qr: lucide(QrCode),
} satisfies Record<string, IconComponent>

export type IconName = keyof typeof Icons

export const CATEGORY_ICON: Record<Category, IconName> = {
  food: 'food',
  groceries: 'cart',
  transport: 'car',
  lodging: 'bed',
  utilities: 'zap',
  entertainment: 'ticket',
  other: 'tag',
}

/** The Settlr mark: a violet tile with the settle stroke (or bare, on violet). */
export function Mark({ size = 44, tile, stroke }: { size?: number; tile: string; stroke: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Rect width={32} height={32} rx={10} fill={tile} />
      <Path d="M10 22 22 10" stroke={stroke} strokeWidth={2.6} strokeLinecap="round" />
      <Circle cx={11.5} cy={11.5} r={2.6} fill={stroke} />
      <Circle cx={20.5} cy={20.5} r={2.6} fill={stroke} />
    </Svg>
  )
}

/** Google's four-colour "G". */
export function GoogleIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
      />
      <Path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
      />
      <Path
        fill="#FBBC05"
        d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
      />
      <Path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
      />
    </Svg>
  )
}
