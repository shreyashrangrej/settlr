import { createLucideIcon } from 'lucide-react'

/**
 * The assistant's icon: a friendly robot (antenna, rounded head, ears, two
 * eyes and a smile), drawn on Lucide's 24px grid with its round strokes so
 * it sits with the other icons, and built with `createLucideIcon` so it is
 * one (same props, the same 1.8 stroke from styles.css). The eyes carry
 * `robot-eye`, so a bigger mark can make them blink (see `AssistantMark`).
 */
export const RobotIcon = createLucideIcon('robot', [
  ['path', { d: 'M12 6V3.75', key: 'antenna' }],
  ['circle', { cx: '12', cy: '2.75', r: '1', fill: 'currentColor', key: 'bulb' }],
  ['rect', { x: '4', y: '6', width: '16', height: '13', rx: '4', key: 'head' }],
  ['path', { d: 'M2 11v3.5', key: 'ear-left' }],
  ['path', { d: 'M22 11v3.5', key: 'ear-right' }],
  [
    'circle',
    { cx: '9', cy: '11.5', r: '1.25', fill: 'currentColor', stroke: 'none', className: 'robot-eye', key: 'eye-left' },
  ],
  [
    'circle',
    { cx: '15', cy: '11.5', r: '1.25', fill: 'currentColor', stroke: 'none', className: 'robot-eye', key: 'eye-right' },
  ],
  ['path', { d: 'M9.5 15.25c1.5 1.1 3.5 1.1 5 0', key: 'smile' }],
])
