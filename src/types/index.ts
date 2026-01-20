// Type definitions for MealMind

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