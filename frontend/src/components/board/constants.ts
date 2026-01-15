import type { CardLabel } from '../../lib/api/cards';

export const LABEL_COLORS: Record<CardLabel, string> = {
  green: '#61bd4f',
  yellow: '#f2d600',
  orange: '#ff9f1a',
  red: '#eb5a46',
  purple: '#c377e0',
  blue: '#0079bf',
};

export const LIST_COLORS = [
  { name: 'None', value: null },
  { name: 'Red', value: '#ef4444' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Yellow', value: '#eab308' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Purple', value: '#a855f7' },
  { name: 'Pink', value: '#ec4899' },
] as const;

export const REACTION_EMOJIS = ['👍', '❤️', '😄', '🎉', '😮', '😢', '😡'] as const;

export const VIRTUAL_THRESHOLD = 20; // Enable virtualization for lists with more than 20 cards
