import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getWeekStartDate(date: Date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

export function shiftWeek(weekStart: string, direction: -1 | 1): string {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + direction * 7);
  return d.toISOString().split('T')[0];
}

export function formatWeekRange(weekStart: string): string {
  const start = new Date(weekStart);
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${start.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', opts)}`;
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function getDayName(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { weekday: 'long' });
}

export function formatTime(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

export function getTotalTime(prepTime: number | null, cookTime: number | null): string {
  const prep = prepTime ?? 0;
  const cook = cookTime ?? 0;
  if (prep === 0 && cook === 0) return '-';
  return formatTime(prep + cook);
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

export function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
  return array.reduce(
    (result, item) => {
      const groupKey = String(item[key]);
      if (!result[groupKey]) {
        result[groupKey] = [];
      }
      result[groupKey].push(item);
      return result;
    },
    {} as Record<string, T[]>
  );
}

export function capitalizeFirst(str: string | null | undefined): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function getCategoryIcon(category: string | null | undefined): string {
  if (!category) return '📦';
  const icons: Record<string, string> = {
    produce: '🥬',
    dairy: '🧀',
    meat: '🥩',
    pantry: '🥫',
    spices: '🧂',
    frozen: '🧊',
    other: '📦',
  };
  return icons[category] || '📦';
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : plural || `${singular}s`;
}

export const DIETARY_RESTRICTIONS = [
  { id: 'gluten-free', label: 'Gluten-Free', icon: '🌾' },
  { id: 'dairy-free', label: 'Dairy-Free', icon: '🥛' },
  { id: 'nut-free', label: 'Nut-Free', icon: '🥜' },
  { id: 'egg-free', label: 'Egg-Free', icon: '🥚' },
  { id: 'soy-free', label: 'Soy-Free', icon: '🫘' },
  { id: 'shellfish-free', label: 'Shellfish-Free', icon: '🦐' },
  { id: 'vegetarian', label: 'Vegetarian', icon: '🥗' },
  { id: 'vegan', label: 'Vegan', icon: '🌱' },
  { id: 'diabetic-friendly', label: 'Diabetic-Friendly', icon: '💉' },
  { id: 'low-sodium', label: 'Low Sodium', icon: '🧂' },
];

export const CUISINES = [
  'Italian',
  'Mexican',
  'Asian',
  'Indian',
  'Mediterranean',
  'American',
  'French',
  'Thai',
  'Japanese',
  'Chinese',
  'Greek',
  'Middle Eastern',
];

export const COOKING_TIME_OPTIONS = [
  { id: 'quick', label: 'Quick (< 30 min)', maxMinutes: 30 },
  { id: 'moderate', label: 'Moderate (30-60 min)', maxMinutes: 60 },
  { id: 'extended', label: 'Extended (> 60 min)', maxMinutes: Infinity },
  { id: 'any', label: 'Any Time', maxMinutes: Infinity },
];
