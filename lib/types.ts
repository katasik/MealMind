// Core data types for MealMind

export interface Ingredient {
  name: string;
  amount: number | null;
  unit: string | null;
  category: 'produce' | 'dairy' | 'meat' | 'pantry' | 'spices' | 'frozen' | 'other' | null;
}

export interface Recipe {
  id: string;
  familyId: string;
  name: string;
  description: string | null;
  ingredients: Ingredient[];
  instructions: string[];
  prepTimeMinutes: number | null;
  cookTimeMinutes: number | null;
  servings: number | null;
  cuisine: string | null;
  difficulty: 'easy' | 'medium' | 'hard' | null;
  tags: string[];
  imageUrl?: string;
  sourceUrl?: string;
  sourceType: 'url' | 'pdf' | 'text' | 'generated';
  mealTypes: MealType[];
  createdAt?: Date;
}

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface PlannedMeal {
  mealType: MealType;
  recipeId?: string;
  recipeName: string;
  recipeDescription?: string;
  prepTimeMinutes: number;
  cookTimeMinutes: number;
  servings: number;
  cuisine?: string;
  ingredients: Ingredient[];
  instructions: string[];
  imageUrl?: string;
}

export interface DayPlan {
  date: string;
  dayName: string;
  meals: PlannedMeal[];
}

export interface EvaluationScores {
  dietaryCompliance: number;
  variety: number;
  nutrition: number;
  overall: number;
  passed: boolean;
}

export interface MealPlan {
  id: string;
  familyId: string;
  weekStartDate: string;
  status: 'draft' | 'approved' | 'completed';
  days: DayPlan[];
  evaluationScores?: EvaluationScores;
  opikTraceId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ShoppingItem {
  id: string;
  name: string;
  amount: number;
  unit: string;
  category: string;
  checked: boolean;
  fromRecipes: string[];
}

export interface ShoppingList {
  id: string;
  mealPlanId: string;
  familyId: string;
  weekStartDate: string;
  items: ShoppingItem[];
  status: 'active' | 'completed';
  createdAt?: Date;
  updatedAt?: Date;
}

export interface FamilyMember {
  id: string;
  name: string;
  dietaryRestrictions: string[];
}

export interface Family {
  id: string;
  name: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface UserPreferences {
  favoriteIngredients: string[];
  dislikedIngredients: string[];
  cuisinePreferences: string[];
  cookingTimePreference: 'quick' | 'moderate' | 'extended' | 'any';
  targetLanguage: 'en' | 'hu' | 'de' | 'es' | 'fr' | 'it';
}

// API Request/Response types
export interface GenerateMealPlanRequest {
  familyId: string;
  days?: number;
  mealsPerDay?: MealType[];
  previousFeedback?: Record<string, { value: number; reason: string | null }>;
}

export interface GenerateMealPlanResponse {
  success: boolean;
  mealPlan?: MealPlan;
  evaluation?: EvaluationScores;
  traceId?: string;
  error?: string;
}

export interface ParseRecipeRequest {
  source: string;
  sourceType: 'url' | 'pdf' | 'text';
  familyId: string;
}

export interface ParseRecipeResponse {
  success: boolean;
  recipe?: Recipe;
  evaluation?: {
    score: number;
    passed: boolean;
    judgesAgree: boolean;
    hallucinationsDetected: boolean;
  };
  traceId?: string;
  error?: string;
}

export interface RegenerateMealRequest {
  mealPlanId: string;
  dayIndex: number;
  mealType: MealType;
}

export interface RegenerateMealResponse {
  success: boolean;
  meal?: PlannedMeal;
  evaluation?: {
    dietaryCompliance: number;
    passed: boolean;
  };
  error?: string;
}

export interface CreateShoppingListRequest {
  mealPlanId: string;
}

export interface CreateShoppingListResponse {
  success: boolean;
  shoppingList?: ShoppingList;
  evaluation?: {
    completeness: number;
    passed: boolean;
  };
  error?: string;
}

export interface UpdateShoppingItemRequest {
  listId: string;
  itemId: string;
  checked: boolean;
}

// Telegram types
export interface TelegramChat {
  chatId: number;
  familyId: string;
  chatType: 'private' | 'group';
  linkedAt?: Date;
}
