# Settlr — design spec

Settlr is an app for splitting shared expenses: groups, balances, settling up, and an AI assistant that adds, edits and deletes expenses through chat.
The screens in `screens/` are static mockups for layout and content (the data in them is sample data); the look follows the design system below.

## Design system: Gr8r Studio (web), T3 Code (Android, for now)

The web app uses [Gr8r Studio](https://github.com/gr8rstudio/gr8r-studio)'s design system: its palette, type, shapes, spacing, component styles, shell and icons (the values come from its `src/styles/tokens.css`, `base.css`, `components.css`, `shell.css`, `panels.css` and `overlays.css`). The Android app still follows [T3 Code](https://github.com/pingdotgg/t3code)'s mobile system (below) until it's moved over. The mockups in `screens/` predate both: use them for **layout and content** (what goes on each screen, in what order), and this file for how things look. Where they disagree, this file wins.

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

Light and dark are both full palettes (dark is redefined, not inverted). With no saved choice the theme follows the system. Separation comes from hairline borders, not grey fills or shadows.

### Web (`apps/web/src/styles.css`)

| Token | Light | Dark | Use |
|---|---|---|---|
| `bg` (`background`) | `#ffffff` | `#1d1d1c` | Content area and top bar |
| `bg-page` (`page`) | `#fbfaf8` | `#1a1a19` | Gr8r's page tone, for full-bleed screens |
| `bg-sidebar` | `#f4f3f0` | `#151514` | Sidebar and its drawer |
| `surface` (`card`, `popover`) | `#ffffff` | `#1d1d1c` | Cards, menus, dialogs |
| `surface-2` (`tile`, `muted`, `accent`) | `#f6f5f2` | `#252524` | Hover fills, inner tiles |
| `surface-3` (`raised`) | `#eeede9` | `#2d2d2b` | Pressed fills, sidebar hover, segmented track, skeletons |
| `sunken` | `#f7f6f3` | `#181817` | Recessed panels |
| `border` | `#e9e7e2` | `#2c2b29` | Card, bar and table borders |
| `border-strong` (`input`) | `#dad7d0` | `#3a3936` | Input and outline-button borders |
| `divider` | `#f0eeea` | `#252523` | Row separators, menu separators |
| `text` | `#1d1c1a` | `#eceae5` | Text |
| `muted` | `#57544e` | `#b5b2ab` | Descriptions, labels, idle nav text (Gr8r's text-2) |
| `faint` | `#6b6760` | `#9a968f` | Hints, metadata, section headings (text-3) |
| `dim` | `#8c8880` | `#6f6c66` | Idle icons, separators (text-4) |
| `accent` (`primary`) | `#4b5bd6` | `#8e9af3` | Primary buttons, links, focus, selection, unread dots |
| `accent-soft` (`primary-soft`) | accent at 10% | accent at 10% | Focus rings, the signed-in user's avatar |
| `accent-line` / `accent-surface` | accent 38% / 5% | same | Highlight cards |
| `owed` (`positive`) | `#25754b` | `#5cba86` | Money owed **to** the user |
| `owe` (`destructive`) | `#b23c30` | `#e57d70` | Money the user **owes**, destructive actions |
| `warning` | `#8f5e0e` | `#d8a443` | Warnings |
| `overlay` (`modal-scrim`) | warm black 28% | black 55% | Behind dialogs and the drawer |

Label hues (`--green`, `--amber`, `--red`, `--blue`, `--violet`, `--teal`, `--rose`, `--orange`, `--gray`) are Gr8r's, lighter in dark mode. Categories, groups and avatars use them as tints: icon tiles are the hue at 16% over the surface with the glyph in the hue (mixed 72% toward the text in dark); avatars are the hue at 17% with the initials mixed 55% toward the text. Tinted badges are the colour at 10–12% with no border.

**Money rule:** green = owed to you, red = you owe. Always pair the colour with a word ("owes you", "you owe") or a sign (+/−) so it never relies on colour alone.

### Android (`apps/mobile/src/theme/tokens.ts`)

T3 Code's mobile palette: dark screen `#0A0A0A`, cards `#111111`, grouped cards `#1A1B1B`, borders `#191919`, text `#F5F5F5`, muted `#838383`, primary `#346BF1`, danger `#FF6467`; light screen `#FCFCFC`, cards white, borders `#E4E4E7`, text `#27272A`, muted `#6F6F79`, primary `#1B4ED8`, danger `#C10007`. Owed is emerald, as on the web.

## Typography

- Web: **Geist** for the UI and **Geist Mono** for codes and key hints (`next/font`), with Geist's `ss01` and `cv11` features. Amounts are in the UI font with tabular figures (`tabular-nums`).
- Web sizes are Gr8r's, which override Tailwind's scale in `styles.css`: body and controls 13.5 px (`text-sm`; inputs are 16 px below `sm` so iOS doesn't zoom), buttons, tabs, badges and the breadcrumb 12.5 px (`text-ui`), descriptions and metadata 12 px (`text-xs`), counts and section headings 11 px (`text-2xs`). Card titles 13.5 px semibold, section and dialog titles 14.5 px (`text-base`), page titles 23 px (`text-2xl`, 19 px on phones) with −0.022em tracking. Stat values 22 px. The dashboard's hero balance stays 36–48 px.
- Android: **DM Sans** (400/500/600/700), T3 Code's mobile face; amounts use tabular figures. Sizes (T3's mobile roles): 11, 12, 13, 14, 16 (body), 18, 21 (screen title), 26, 30.
- Weights: **semibold (600) for headings and large figures**; medium (500) for buttons, labels, row titles, badges and the current nav item; 450 for idle nav items; regular for body. Sidebar section headings are Gr8r's uppercase 11 px semibold labels with 0.06em tracking; nothing else is uppercase.
- Currency: Indian digit grouping for INR (`₹1,860`, `₹42,000`). Use `−` (U+2212) for negatives.

## Shape and spacing

- Web radii: 4 px (kbd, small icon buttons), 5 px (badges, segments), 6 px (buttons, inputs, menu rows, tiles: `rounded-lg`), 10 px (cards, menus, popovers: `rounded-xl`), 12 px (dialogs: `rounded-2xl`); avatars and counts are round.
- Web controls: 30 px tall from `sm` (34 px below), small 26 px, extra-small 22 px, large 36 px; on touch screens every button has a 44 × 44 px hit area.
- Web spacing (4 px scale): pages centred at up to 1160 px with a 24 px gutter (16 px on phones), 16 px between the top bar and the page header (12 px on phones) and 20 px under it, 16 px between cards, 14 px inside them. Sidebar 252 px (52 px collapsed) with 30 px rows; top bar 46 px; table rows 40 px with a 34 px header.
- Shadows: none on cards; a 1 px soft shadow under outline buttons and the current sidebar item; a long soft drop that carries its own hairline under menus, popovers, dialogs and toasts.
- Motion: 140 ms colour transitions, `cubic-bezier(0.23, 1, 0.32, 1)` easing, popovers rise 4 px and scale from 97%, dialogs rise 8 px, buttons press to 97%.
- Android: buttons and chips are pills (48 px / 40 px tall), fields 16 px radius and 54 px tall, cards 20 px, 16 px screen gutter and 16 px between sections.

## Components

- **Shell:** the sidebar (`bg-sidebar`): the logo and name with a collapse button, Dashboard, Assistant and Notifications (an accent count pill), an "Expenses" section, a "Groups" section with a + button and each group as a tinted icon with its balance, and Help, Settings and the account row at the foot above a hairline. Rows are 30 px, muted, with dim icons; hover is the raised fill; the current page is the surface lifted by a hairline and a small shadow (light) or the raised fill (dark). From `lg` the shell is inset: the sidebar colour runs round the window as an 8 px rim, and the top bar and page sit in a rounded (10 px) panel with a hairline border; the panel scrolls on its own and the top bar scrolls away with the page rather than staying pinned. The sidebar has no edge of its own. The 46 px top bar, with no bottom border, has the breadcrumb on the content gutter (section / group or friend / page), then the bell (an accent dot when unread), an outline **New** menu button and the avatar. Below `lg` the sidebar opens as a drawer from the top bar's menu button or **More**, and a flat bar of tabs (Home, Groups, Friends, Personal, More) runs along the bottom.
- **Page header:** the title, a muted line under it (or a faint eyebrow above), actions on the right with 6 px between them.
- **Buttons:** primary = indigo fill with a faint inner bottom edge, darkening toward the text colour on hover; outline (Gr8r's secondary) = surface with the strong border and a small shadow; ghost = muted text that fills on hover; secondary = the hover fill; "Settle" (`contrast`) = the text colour as a fill; destructive = red fill. Pressing scales to 97%.
- **Fields:** 6 px, strong border on the surface, the border darkening on hover; focus is an accent border with a 3 px accent-soft ring; errors are a red border with a red-soft ring. Checkboxes 15 px with a 1.5 px border.
- **Segmented control (`Tabs`):** the raised track with 2 px padding, 12 px medium segments, the active one the surface with a hairline and a small shadow. Underlined tabs (`variant="line"`, the group page's sections): muted labels on a hairline, the current one in the text colour over a 2 px bar.
- **Badges:** 20 px, 5 px radius, 12 px medium; neutral is the hover fill with a hairline, tones are a 10–12% wash.
- **Menus, selects, popovers:** the solid surface on the long popover shadow, 10 px radius, 4 px padding, 30 px rows at 6 px radius with muted icons; uppercase 11 px group labels; separators run edge to edge.
- **Dialogs:** 12 px radius near the top of the screen (10% down), 16 px padding, a 14.5 px semibold title, the actions in a footer under a hairline; the scrim is a flat warm wash, no blur.
- **Cards:** 10 px radius, hairline border, surface fill, no shadow; 13.5 px semibold titles; links in the header 12 px medium muted.
- **Stats:** one bordered strip with hairlines between the figures: a 12.5 px muted label with a 14 px icon, the 22 px semibold value, a faint 12 px hint.
- **Tables:** a 34 px header row in 12 px medium muted text over a hairline, 40 px rows with divider lines.
- **Toasts:** inverted (the text colour as the fill), 8 px radius, 12.5 px text, the success or error icon in green or red.
- **Skeletons:** the raised fill with a lighter band sweeping across (1.3 s).
- **Empty states:** a bare 22 px dim glyph, a 14.5 px semibold title and a 12.5 px muted line, centred.
- **Icons:** [Lucide](https://lucide.dev) on both apps (`lucide-react`, `lucide-react-native`); on the web at Gr8r's 1.8 stroke, 16 px in nav rows, 14 px in buttons and inline.
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
