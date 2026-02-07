import type {
  GenerateMealPlanRequest,
  GenerateMealPlanResponse,
  ParseRecipeRequest,
  ParseRecipeResponse,
  RegenerateMealRequest,
  RegenerateMealResponse,
  CreateShoppingListRequest,
  CreateShoppingListResponse,
  MealType,
  RecipeMode,
  ShoppingList,
} from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

class ApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    // Extract error message from various possible fields
    const errorMessage = error.error || error.message || `Request failed: ${response.statusText}`;
    throw new ApiError(
      errorMessage,
      response.status
    );
  }

  return response.json();
}

// Meal Plan API
export async function generateMealPlan(
  familyId: string,
  days: number = 7,
  mealsPerDay: MealType[] = ['breakfast', 'lunch', 'dinner'],
  previousFeedback?: Record<string, { value: number; reason: string | null }>,
  startDate?: string,
  recipeMode?: RecipeMode
): Promise<GenerateMealPlanResponse> {
  const request: GenerateMealPlanRequest = { familyId, days, mealsPerDay, previousFeedback, startDate, recipeMode };
  return fetchApi<GenerateMealPlanResponse>('/mealplans/generate', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function regenerateMeal(
  mealPlanId: string,
  dayIndex: number,
  mealType: MealType
): Promise<RegenerateMealResponse> {
  const request: RegenerateMealRequest = { mealPlanId, dayIndex, mealType };
  return fetchApi<RegenerateMealResponse>('/mealplans/regenerate', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function deleteMealPlan(
  mealPlanId: string
): Promise<{ success: boolean; message?: string }> {
  return fetchApi<{ success: boolean; message?: string }>(
    `/mealplans?id=${mealPlanId}`,
    {
      method: 'DELETE',
    }
  );
}

export async function approveMealPlan(
  mealPlanId: string
): Promise<{ success: boolean; message?: string }> {
  return fetchApi<{ success: boolean; message?: string }>('/mealplans', {
    method: 'PUT',
    body: JSON.stringify({ id: mealPlanId, status: 'approved' }),
  });
}

export interface OpikScoreEntry {
  value: number;
  reason: string | null;
}

export async function getOpikScores(
  traceId: string
): Promise<Record<string, OpikScoreEntry> | null> {
  try {
    const res = await fetchApi<{ success: boolean; scores: Record<string, OpikScoreEntry> }>(
      `/mealplans/scores?traceId=${traceId}`
    );
    return res.success ? res.scores : null;
  } catch {
    return null;
  }
}

// Recipe API
export async function parseRecipe(
  source: string,
  sourceType: 'url' | 'pdf' | 'text',
  familyId: string
): Promise<ParseRecipeResponse> {
  const request: ParseRecipeRequest = { source, sourceType, familyId };
  return fetchApi<ParseRecipeResponse>('/recipes/parse', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function deleteRecipeApi(recipeId: string): Promise<{ success: boolean }> {
  return fetchApi<{ success: boolean }>(`/recipes?id=${recipeId}`, {
    method: 'DELETE',
  });
}

// Shopping List API
export async function createShoppingList(
  mealPlanId: string
): Promise<CreateShoppingListResponse> {
  const request: CreateShoppingListRequest = { mealPlanId };
  return fetchApi<CreateShoppingListResponse>('/shopping', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function getShoppingListApi(
  mealPlanId: string
): Promise<{ success: boolean; shoppingList?: ShoppingList }> {
  return fetchApi<{ success: boolean; shoppingList?: ShoppingList }>(
    `/shopping?mealPlanId=${mealPlanId}`
  );
}

export async function updateShoppingItem(
  listId: string,
  itemId: string,
  checked: boolean
): Promise<{ success: boolean }> {
  return fetchApi<{ success: boolean }>('/shopping', {
    method: 'PUT',
    body: JSON.stringify({ listId, itemId, checked }),
  });
}

export async function sendShoppingListToTelegram(
  listId: string,
  chatId: number
): Promise<{ success: boolean; messageId?: number }> {
  return fetchApi<{ success: boolean; messageId?: number }>('/shopping/telegram', {
    method: 'POST',
    body: JSON.stringify({ listId, chatId }),
  });
}

// Utility functions
export function formatIngredient(
  amount: number,
  unit: string,
  name: string
): string {
  if (amount === 0) return name;
  const amountStr = amount % 1 === 0 ? amount.toString() : amount.toFixed(2);
  return `${amountStr} ${unit} ${name}`.trim();
}

export function getCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    produce: '🥬',
    dairy: '🧀',
    meat: '🥩',
    pantry: '🥫',
    spices: '🧂',
    frozen: '🧊',
    other: '📦',
  };
  return icons[category] || icons.other;
}

export function getMealTypeIcon(mealType: string): string {
  const icons: Record<string, string> = {
    breakfast: '🌅',
    lunch: '☀️',
    dinner: '🌙',
    snack: '🍎',
  };
  return icons[mealType] || '🍽️';
}

// Calendar export utility
export function generateICalendar(mealPlan: any): string {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  let ical = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Feed Me//Meal Planner//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Meal Plan',
    'X-WR-TIMEZONE:UTC',
  ].join('\r\n');

  mealPlan.days.forEach((day: any) => {
    day.meals.forEach((meal: any) => {
      const date = new Date(day.date);

      // Set meal times based on meal type
      let startHour = 12;
      let endHour = 13;

      if (meal.mealType === 'breakfast') {
        startHour = 8;
        endHour = 9;
      } else if (meal.mealType === 'lunch') {
        startHour = 12;
        endHour = 13;
      } else if (meal.mealType === 'dinner') {
        startHour = 18;
        endHour = 19;
      } else if (meal.mealType === 'snack') {
        startHour = 15;
        endHour = 16;
      }

      const startDate = new Date(date);
      startDate.setHours(startHour, 0, 0, 0);

      const endDate = new Date(date);
      endDate.setHours(endHour, 0, 0, 0);

      const formatDateForICal = (d: Date) => {
        return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      };

      const uid = `meal-${day.date}-${meal.mealType}@feedme.app`;

      // Build description with ingredients and instructions
      let description = '';
      if (meal.recipeDescription) {
        description += meal.recipeDescription + '\\n\\n';
      }

      description += 'INGREDIENTS:\\n';
      meal.ingredients.forEach((ing: any) => {
        description += `- ${ing.amount || ''} ${ing.unit || ''} ${ing.name}`.trim() + '\\n';
      });

      description += '\\nINSTRUCTIONS:\\n';
      meal.instructions.forEach((step: string, i: number) => {
        description += `${i + 1}. ${step}\\n`;
      });

      // Escape special characters in description
      description = description.replace(/\n/g, '\\n').replace(/,/g, '\\,');

      const totalTime = (meal.prepTimeMinutes || 0) + (meal.cookTimeMinutes || 0);
      const location = meal.cuisine ? `Cuisine: ${meal.cuisine}` : '';

      ical += '\r\n' + [
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${timestamp}`,
        `DTSTART:${formatDateForICal(startDate)}`,
        `DTEND:${formatDateForICal(endDate)}`,
        `SUMMARY:${meal.mealType.charAt(0).toUpperCase() + meal.mealType.slice(1)}: ${meal.recipeName}`,
        `DESCRIPTION:${description}`,
        location ? `LOCATION:${location}` : '',
        `CATEGORIES:${meal.mealType}`,
        `STATUS:CONFIRMED`,
        totalTime ? `X-MEAL-PREP-TIME:${totalTime} minutes` : '',
        `X-SERVINGS:${meal.servings || 4}`,
        'END:VEVENT',
      ].filter(line => line).join('\r\n');
    });
  });

  ical += '\r\nEND:VCALENDAR';
  return ical;
}

export function downloadICalendar(mealPlan: any, filename: string = 'meal-plan.ics') {
  const icalContent = generateICalendar(mealPlan);
  const blob = new Blob([icalContent], { type: 'text/calendar;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}
