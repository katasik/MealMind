// Type definitions for MealMind

// Meal type - used for categorizing recipes and meal planning
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface Ingredient {
  name: string;
  amount: string;
  unit: string;
  category?: string;
}

export interface NutritionalInfo {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export interface Recipe {
  id: string;
  name: string;
  description: string;
  ingredients: Ingredient[];
  instructions: string[];
  prepTime: number;
  cookTime: number;
  servings: number;
  cuisine: string;
  difficulty: 'easy' | 'medium' | 'hard';
  nutritionalInfo?: NutritionalInfo;
  tags: string[];
  mealTypes?: MealType[];  // Which meals this recipe is suitable for (breakfast, lunch, dinner, snack)
  imageUrl?: string;       // Recipe image URL
  sourceUrl?: string;      // Original source URL if imported
  familyId?: string;
  createdAt: Date;
  // Telegram integration fields
  telegramChatId?: number;
  addedByUserId?: number;
  addedByUserName?: string;
  source?: 'generated' | 'user_submitted';
}

export interface DietaryRestriction {
  id: string;
  type: 'allergy' | 'intolerance' | 'preference' | 'medical';
  name: string;
  severity: 'mild' | 'moderate' | 'severe';
  description?: string;
}

export interface UserPreferences {
  favoriteIngredients: string[];
  dislikedIngredients: string[];
  cuisinePreferences: string[];
  cookingTime: 'quick' | 'moderate' | 'extended' | 'any';
}

export interface User {
  id: string;
  name: string;
  email?: string;
  familyId: string;
  preferences: UserPreferences;
  createdAt: Date;
}

export interface Family {
  id: string;
  name: string;
  members: string[];
  dietaryRestrictions: DietaryRestriction[];
  createdAt: Date;
}

export interface ChatMessage {
  id: string;
  familyId: string;
  userId: string;
  role: 'user' | 'assistant';
  content: string;
  recipeId?: string;
  timestamp: Date;
}

export interface ShoppingItem {
  ingredient: Ingredient;
  checked: boolean;
  category: string;
}

export interface ShoppingList {
  id: string;
  familyId: string;
  items: ShoppingItem[];
  completed: boolean;
  createdAt: Date;
}

export interface FeedbackReaction {
  messageId: string;
  userId: string;
  type: 'love' | 'like' | 'dislike' | 'reject';
  timestamp: Date;
}

export interface SafetyCheck {
  passed: boolean;
  allergensDetected: string[];
  confidence: number;
  warnings: string[];
}

export interface EvaluationMetrics {
  dietaryCompliance: number;
  feasibility: number;
  variety: number;
  nutritionalBalance: number;
}

export interface EvaluationResult {
  recipeId: string;
  familyId: string;
  metrics: EvaluationMetrics;
  safety: SafetyCheck;
  timestamp: Date;
}

// ============================================
// Meal Planning Types
// ============================================

export type MealPlanStatus = 'draft' | 'approved' | 'finalized';

export interface PlannedMeal {
  mealType: MealType;
  recipeId: string;
  recipeName: string;
  recipeDescription?: string;
  prepTime: number;
  cookTime: number;
  servings: number;
  cuisine?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  ingredients: Ingredient[];
  instructions: string[];
  imageUrl?: string;  // Recipe image URL
}

export interface DayPlan {
  date: string;           // YYYY-MM-DD
  dayOfWeek: number;      // 0-6 (Sunday-Saturday)
  dayName: string;        // "Monday", etc.
  meals: PlannedMeal[];
}

export interface MealPlan {
  id: string;
  familyId: string;
  weekStartDate: string;  // Monday of the week (YYYY-MM-DD)
  days: DayPlan[];
  status: MealPlanStatus;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string;
  createdByUserName: string;
}

export interface MealPlanShoppingItem {
  id: string;
  ingredientName: string;
  amount: string;
  unit: string;
  category: string;       // Produce, Dairy, Meat, Pantry, etc.
  recipeNames: string[];  // Which recipes need this
  checked: boolean;       // User has this at home
}

export interface MealPlanShoppingList {
  id: string;
  mealPlanId: string;
  familyId: string;
  weekStartDate: string;
  items: MealPlanShoppingItem[];
  status: 'pending' | 'active' | 'completed';
  createdAt: Date;
  updatedAt: Date;
}

export interface MealPlanSettings {
  numberOfDays: number;           // 1-7
  mealsPerDay: MealType[];        // Which meals to include
}