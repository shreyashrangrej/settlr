# Settlr — design spec

Settlr is an app for splitting shared expenses: groups, balances, settling up, and an AI assistant that adds, edits and deletes expenses through chat.
The screens in `screens/` are the source of truth for layout and styling. Open them in a browser to see them; match their spacing, sizes and colours exactly. They are static mockups: the data in them is sample data.

## Screens

| File | What it is | Size |
|---|---|---|
| `screens/web-dashboard.html` | Main web dashboard | Responsive, designed at 1440 px wide |
| `screens/web-add-expense.html` | Add-expense dialog (form + split panel) | Responsive dialog, max 1080 px |
| `screens/web-assistant.html` | AI assistant: chats list, conversation, changes panel | Responsive, 3 columns at desktop |
| `screens/mobile-home.html` | Mobile home | 390 × 844 |
| `screens/mobile-add-expense.html` | Mobile add expense | 390 × 844 |
| `screens/mobile-assistant.html` | Mobile AI assistant | 390 × 844 |

## Design tokens

### Colour (dark theme only)

| Token | Value | Use |
|---|---|---|
| `bg` | `#0C0D10` | Page background |
| `bg-sidebar` | `#111216` | Sidebars, side panels |
| `surface` | `#16171C` | Cards |
| `surface-2` | `#1D1F25` | Inner tiles, user chat bubbles, active nav item |
| `input` | `#0F1014` | Input fields, segmented-control track |
| `border` | `#24262D` | Card borders |
| `border-strong` | `#2A2C33` / `#33353D` | Inputs, outline buttons |
| `divider` | `#22242A` | Row separators |
| `text` | `#F2F2EE` | Primary text |
| `text-2` | `#D6D7DC` / `#B9BBC3` | Secondary text |
| `muted` | `#A0A2AB` | Labels, captions (min contrast on surface ≈ 7:1) |
| `faint` | `#8A8D96` | Placeholders, table headers |
| `accent` | `#B18CFF` | Brand violet: primary buttons, active states, links on hover, chart line |
| `accent-tint` | `rgba(177,140,255,0.12)` | Selected chips, pills |
| `accent-surface` | `#1B1726` + border `#3D2F63` | Highlight cards ("Clear what you owe", assistant avatar) |
| `owed` | `#7CB8FF` | Money owed **to** the user (positive) |
| `owe` | `#FF9B6A` | Money the user **owes** (negative) |
| `danger-surface` | border `#5A3626`, fill `rgba(255,155,106,0.08)` | Pending deletes |

Text on `accent` and on group/category colour fills is `#0C0D10` (dark), never white.

Group colours: Coorg `#5FD3A0`, Flat 4B `#F28DB2`, Office Lunch `#F2C14E`.
Avatar fills (initials in light text): `#2B3A55`, `#4D4326`, `#23463A`, `#55332A`, `#37305A`. The signed-in user's avatar is `linear-gradient(135deg, #B18CFF, #7CB8FF)` with dark text.

**Money rule:** blue = owed to you, orange = you owe. Always pair the colour with a word ("owes you", "you owe") or a sign (+/−) so it never relies on colour alone.

### Typography

- UI font: **Geist** (400/500/600/700), fallback `'Helvetica Neue', sans-serif`.
- Numbers and amounts: **Geist Mono** (400/500/600), fallback `ui-monospace, monospace`.
- Google Fonts: `https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600&display=swap`
- Hero balance: 60 px (web) / 46 px (mobile), weight 600, letter-spacing −0.055em; decimals at half size in `#6E717B`.
- Page title: 30 px / 600 / −0.04em. Card titles: 16 px / 600 / −0.02em. Body 14 px. Captions 12–13 px. Uppercase section labels: 11 px / 600 / letter-spacing 0.1em.
- Currency: Indian rupee, Indian digit grouping (`₹1,860`, `₹42,000`). Use `−` (U+2212) for negatives.

### Shape and spacing

- Radii: cards 22 px, inner tiles 14–18 px, inputs and buttons 10–14 px, pills 99 px, mobile nav bar 33 px.
- Card padding 20–24 px. Grid gap between cards 18 px. Row padding 12 px vertical.
- Minimum touch target 44 × 44 px.
- Web layout: sidebar (~232 px) plus content in a max-width 1220 px container. Cards sit in flex-wrap rows so they stack on narrow screens.

## Components (as used in the screens)

- **Buttons:** primary = accent fill, dark text; secondary = transparent with `border-strong`; "Settle" = `#F2F2EE` fill with dark text; destructive confirm = `owe` fill with dark text.
- **Segmented control:** `input` track with 1 px border, active segment `#2A2C33`.
- **Chips / toggles:** pill, `aria-pressed`; selected = accent border + accent-tint fill + accent text.
- **Balance row:** avatar, name + group(s), age pill (e.g. "19 days", orange tint once overdue), amount label + amount, action button (Remind / Settle).
- **Group card:** colour icon tile, member avatar stack, budget progress bar (6 px), balance line.
- **Charts:** net-balance area chart (accent line, 10 % accent fill, dashed zero line); spending donut with legend and values.
- **Mobile nav:** floating pill bar with Home, Groups, a central accent "Add" button, Activity, Insights.

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
