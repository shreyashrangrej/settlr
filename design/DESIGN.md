# Settlr — design spec

Settlr is an app for splitting shared expenses: groups, balances, settling up, and an AI assistant that adds, edits and deletes expenses through chat.
The screens in `screens/` are static mockups for layout and content (the data in them is sample data); the look follows the design system below.

## Design system: T3 Code

Settlr uses [T3 Code](https://github.com/pingdotgg/t3code)'s design system: its palette, type, shapes, spacing, component styles and icons (the web values come from T3 Code's `apps/web/src/index.css` and `components/ui`, the mobile ones from its `apps/mobile`). The mockups in `screens/` predate it: use them for **layout and content** (what goes on each screen, in what order), and this file for how things look. Where they disagree, this file wins.

## Screens

| File | What it is | Size |
|---|---|---|
| `screens/web-dashboard.html` | Main web dashboard | Responsive, designed at 1440 px wide |
| `screens/web-add-expense.html` | Add-expense dialog (form + split panel) | Responsive dialog, max 1080 px |
| `screens/web-assistant.html` | AI assistant: chats list, conversation, changes panel | Responsive, 3 columns at desktop |
| `screens/mobile-home.html` | Mobile home | 390 × 844 |
| `screens/mobile-add-expense.html` | Mobile add expense | 390 × 844 |
| `screens/mobile-assistant.html` | Mobile AI assistant | 390 × 844 |
| `screens/android/*.html` | Android app: home (and `home-light`), groups, group, add-expense, settle-up, friends, friend, personal, budget, assistant, notifications, sign-in | 412 × 915 |

The Android screens are the layout reference for `apps/mobile` (a flat bottom navigation bar with Home, Groups, Friends, Personal, Assistant; group initials on their colour tile).

## Colour

Dark is the default and the reference; light is T3 Code's light appearance. Separation comes from hairline borders, not grey fills.

### Web (`apps/web/src/styles.css`)

| Token | Dark | Light | Use |
|---|---|---|---|
| `bg` | `#000` | `oklch(99.2% 0 0)` (zinc-25) | Page |
| `bg-sidebar` | `#000` | zinc-50 | Sidebar |
| `surface` (`card`, `popover`) | neutral-950 + 3% white (`#111`) | white | Cards, menus, dialogs |
| `surface-2` (`tile`, `muted`, `accent`) | white 5% | zinc-100 | Inner tiles, hover fills |
| `field` | white 3.5% | zinc-25 | Inputs, segmented-control track |
| `border` | white 8% | zinc-200 | Card and row borders |
| `border-strong` (`input`) | white 11% | zinc-300 | Input and outline-button borders |
| `divider` | white 6% | zinc-200 at 60% | Row separators |
| `text` | neutral-100 | zinc-900 | Text |
| `muted` | neutral-400 | zinc-500 | Descriptions, labels |
| `faint` | `#8f8f8f` | zinc-500 | Row metadata (T3's secondary label) |
| `accent` (`primary`) | `oklch(0.571 0.21 264)` | `oklch(0.488 0.217 264)` | Primary buttons, links, focus rings, selection |
| `accent-surface` / `accent-border` | primary 9% / 32% | primary 5% / 28% | Highlight cards |
| `owed` (`positive`) | emerald-400 | emerald-700 | Money owed **to** the user (T3's success) |
| `owe` (`destructive`) | red-500 + 10% white | red-600 | Money the user **owes**, destructive actions (T3's error) |
| `track` | white 11% | zinc-200 | Progress tracks, timeline rails |

Warnings use Tailwind's amber (T3's warning). Tinted badges and callouts are the colour at 8% (light) / 16% (dark) behind it, with a 32% border where there is one.

Category colours, group fills and avatar hues are Tailwind's 400 shades: orange, pink, blue, emerald, amber, violet, rose, neutral. Avatars and category tiles use T3's label tint (the colour at 14% over the surface, the glyph mixed 78% with the text colour); group tiles are a solid fill with dark text (`on-fill`).

**Money rule:** green = owed to you, red = you owe. Always pair the colour with a word ("owes you", "you owe") or a sign (+/−) so it never relies on colour alone.

### Android (`apps/mobile/src/theme/tokens.ts`)

T3 Code's mobile palette: dark screen `#0A0A0A`, cards `#111111`, grouped cards `#1A1B1B`, borders `#191919`, text `#F5F5F5`, muted `#838383`, primary `#346BF1`, danger `#FF6467`; light screen `#FCFCFC`, cards white, borders `#E4E4E7`, text `#27272A`, muted `#6F6F79`, primary `#1B4ED8`, danger `#C10007`. Owed is emerald, as on the web.

## Typography

- Web UI font: the system UI font on Apple devices (`-apple-system`), **Inter** elsewhere, then Segoe UI and `system-ui`. Code-like text (URLs, codes) uses the system monospace (`ui-monospace`, SF Mono, Menlo, Consolas). Amounts are in the UI font with tabular figures (`tabular-nums`), not a monospace.
- Android: **DM Sans** (400/500/600/700), T3 Code's mobile face; amounts use tabular figures.
- Web sizes (T3 Code's): body and controls 14 px (`text-sm`; 16 px below `sm` so iOS doesn't zoom), descriptions and metadata 12 px (`text-xs`), dense labels 11/10 px (`text-2xs`/`text-3xs`). Page titles and dialog titles 20 px, card and section titles 16 px, all semibold. Large figures: the hero balance 36–48 px, stat values 24 px.
- Android sizes (T3's mobile roles): 11, 12, 13, 14, 16 (body), 18, 21 (screen title), 26, 30.
- Weights: **semibold (600) only for headings and large figures**; medium (500) for buttons, labels, row titles, badges and nav items; regular for body. No uppercase or letter-spaced labels; tracking is default except a slight negative tracking on large figures.
- Currency: Indian digit grouping for INR (`₹1,860`, `₹42,000`). Use `−` (U+2212) for negatives.

## Shape and spacing

- Web radii (8 px base): buttons, inputs, menus, tiles 8 px (`rounded-lg`); small buttons and menu items 4–6 px; badges 4 px (`rounded-sm`); cards 12 px (`rounded-xl`); dialogs 16 px (`rounded-2xl`); chips and the account avatar are round.
- Web controls: 32 px tall from `sm` (36 px below), small 28 px, large 36 px; on touch screens every button has a 44 × 44 px hit area.
- Web spacing: page padding 20 px (24 px from `sm`), 24 px from the page header to the content, 16 px between cards, 16 px inside cards. Sidebar rows are 32 px.
- Android: buttons and chips are pills (48 px / 40 px tall), fields 16 px radius and 54 px tall, cards 20 px, 16 px screen gutter and 16 px between sections.
- Shadows: a faint `shadow-xs` under cards and controls, a 1 px inner highlight on filled buttons, soft long drops under menus and dialogs. No glows or gradients.

## Components

- **Buttons:** primary = blue fill, white text, inner highlight; outline = `input` border on the popover colour; ghost = no border, accent fill on hover; "Settle" (`contrast`) = the text colour as a fill; destructive = red fill. Pressing scales to 97%.
- **Fields:** 8 px, `input` border, faint fill in dark, a 3 px inset ring of the primary at 24% on focus.
- **Segmented control (`Tabs`):** a tinted track (`input` at 40% / `field`), active segment white (light) or white 8% (dark) with a hairline shadow.
- **Chips / toggles:** round, `input` border; selected = a neutral fill (`foreground` at 8–12%) and full-colour text, not the accent.
- **Menus, selects, popovers:** frosted glass (`dropdown-glass`): the surface at ~80% with a 12–16 px blur, 10% border, rows 28 px tall at 4 px radius.
- **Dialogs:** frosted glass (`dialog-glass`) over a blurred backdrop, 16 px radius, 24 px padding, 20 px semibold title, and a full-width muted footer band under a hairline holding the actions.
- **Cards:** 12 px radius, hairline border, `surface` fill, faint shadow; titles 16 px semibold, links in the header 12 px medium muted.
- **Sidebar:** 32 px rows, muted 16 px icons, the current page a quiet fill (white and raised in light mode); section labels 12 px medium muted.
- **Skeletons:** `muted` at 15% with T3's stepped breathing animation.
- **Icons:** [Lucide](https://lucide.dev) on both apps (`lucide-react`, `lucide-react-native`) at a 1.75 stroke, 16 px in controls (18 px below `sm`), 14 px inline.
- **Charts:** primary line with a 10% fill; spending donut uses the category colours.

## AI assistant behaviour (from the mockups)

- The assistant never changes data silently. Every add, edit or delete is shown as a card.
- **Add:** an expense card (title, category, group, date, payer, total), then a status line "Added · ₹620 each, 3 ways" with **Undo** and **Open**.
- **Edit:** a diff card showing old → new for every changed field (old value struck through), then "Applied" with **Undo**.
- **Delete:** it is never automatic. Show the matching entries, mark which one is kept and which is deleted, and wait for an explicit **Delete** or **Keep both**.
- The web layout has a "Changes in this chat" timeline (added / edited / pending) with per-item Undo, plus a "Balance impact" card showing before → after for the group and the overall net balance.
- Composer: suggested prompts, attach receipt, voice input, send. Footer: "Every change the assistant makes appears in Activity and can be undone."

## Data model implied by the screens

- **Group** (name, colour, icon, members, optional monthly/trip budget)
- **Expense** (description, category, amount, currency, date, group, paid_by, split_method: equal | exact | percent | shares, shares per member, note, receipt, recurring)
- **Settlement** (from, to, amount, method e.g. UPI or cash, date)
- **Balance** (derived per person and per group; age of the oldest unpaid item)
- **AssistantAction** (type: add | edit | delete, payload, diff, status: pending | applied | undone, timestamp)
