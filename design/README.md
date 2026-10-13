# Settlr design handoff

1. Put this folder in your project (for example at `design/`).
2. Open the files in `screens/` in a browser to see each screen.
3. Give Claude Code a prompt like the one below.

## Example prompt for Claude Code

> Build the Settlr web app UI from the design in `design/`. Read `design/DESIGN.md` first, then use the HTML files in `design/screens/` as the exact visual reference: match the colours, fonts, spacing, radii and layout. Use [your stack, e.g. Next.js + Tailwind]. Put the design tokens from DESIGN.md into the Tailwind theme / CSS variables instead of hard-coding hex values, and make reusable components (Card, Button, SegmentedControl, Chip, BalanceRow, GroupCard, Avatar, AmountText). Start with the web dashboard, then the add-expense dialog, then the assistant screen. Use mock data matching the screens for now.

Tips:
- Ask for one screen at a time and compare it side by side with the HTML file.
- If you build the phone app (e.g. React Native or Flutter), point Claude Code at the `mobile-*.html` files and the same DESIGN.md.
