/**
 * Evaluation Service for Opik Integration
 *
 * This service provides evaluation capabilities for MealMind's AI-generated content.
 * It's designed to integrate with Opik (https://www.comet.com/docs/opik/) for:
 * - Tracing LLM calls
 * - Evaluating output quality
 * - Building evaluation datasets
 * - Monitoring model performance
 *
 * Environment Variables (see .env.example):
 * - OPIK_API_KEY: Your Opik API key from Comet
 * - OPIK_WORKSPACE: Your Opik workspace name
 * - OPIK_PROJECT_NAME: Project name for MealMind traces (default: "mealmind")
 *
 * To enable Opik:
 * 1. Install: npm install opik
 * 2. Set environment variables in .env
 * 3. Uncomment the Opik initialization below
 *
 * Example Opik initialization (uncomment when ready):
 * ```
 * import Opik from 'opik';
 *
 * const opik = new Opik({
 *   apiKey: process.env.OPIK_API_KEY,
 *   workspace: process.env.OPIK_WORKSPACE,
 *   projectName: process.env.OPIK_PROJECT_NAME || 'mealmind'
 * });
 * ```
 */

import type {
  DietaryRestriction,
  UserPreferences,
  Recipe,
  MealPlan,
  PlannedMeal,
  OpikTraceInput,
  OpikTraceOutput,
  OpikEvaluationScore
} from '../types';

// Evaluation thresholds
const THRESHOLDS = {
  DIETARY_COMPLIANCE_MIN: 1.0,  // Must be 100% compliant
  PREFERENCE_ALIGNMENT_MIN: 0.7,
  RECIPE_VARIETY_MIN: 0.6,
  OVERALL_QUALITY_MIN: 0.7
};

/**
 * Generate a unique trace ID
 */
export function generateTraceId(): string {
  return `trace-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Create a trace input for logging
 */
export function createTraceInput(
  type: OpikTraceInput['type'],
  input: OpikTraceInput['input']
): OpikTraceInput {
  return {
    traceId: generateTraceId(),
    name: `mealmind-${type}`,
    type,
    input,
    startTime: new Date()
  };
}

/**
 * Create a trace output for logging
 */
export function createTraceOutput(
  traceId: string,
  output: OpikTraceOutput['output'],
  startTime: Date,
  error?: string
): OpikTraceOutput {
  const endTime = new Date();
  return {
    traceId,
    output,
    endTime,
    durationMs: endTime.getTime() - startTime.getTime(),
    error
  };
}

/**
 * Evaluate dietary compliance
 * Returns 1.0 if all restrictions are respected, 0.0 if any are violated
 */
export function evaluateDietaryCompliance(
  recipe: Recipe | PlannedMeal,
  restrictions: DietaryRestriction[]
): number {
  if (restrictions.length === 0) return 1.0;

  const ingredients = recipe.ingredients.map(i => i.name.toLowerCase());
  const ingredientText = ingredients.join(' ');

  // Check for common allergen violations
  const allergenKeywords: Record<string, string[]> = {
    'Gluten-Free': ['wheat', 'flour', 'bread', 'pasta', 'barley', 'rye', 'gluten'],
    'Dairy-Free': ['milk', 'cheese', 'butter', 'cream', 'yogurt', 'whey', 'lactose'],
    'Nut-Free': ['almond', 'walnut', 'pecan', 'cashew', 'peanut', 'hazelnut', 'nut'],
    'Egg-Free': ['egg', 'eggs', 'mayonnaise'],
    'Soy-Free': ['soy', 'tofu', 'tempeh', 'edamame', 'soya'],
    'Shellfish-Free': ['shrimp', 'crab', 'lobster', 'clam', 'mussel', 'oyster', 'scallop'],
    'Vegetarian': ['chicken', 'beef', 'pork', 'lamb', 'fish', 'meat', 'bacon', 'ham'],
    'Vegan': ['chicken', 'beef', 'pork', 'lamb', 'fish', 'meat', 'milk', 'cheese', 'egg', 'butter', 'cream', 'honey'],
    'No Red Meat': ['beef', 'pork', 'lamb', 'veal', 'venison']
  };

  for (const restriction of restrictions) {
    const keywords = allergenKeywords[restriction.name];
    if (keywords) {
      for (const keyword of keywords) {
        if (ingredientText.includes(keyword)) {
          return 0.0; // Violation found
        }
      }
    }
  }

  return 1.0;
}

/**
 * Evaluate preference alignment
 * Checks how well the recipe matches user preferences
 */
export function evaluatePreferenceAlignment(
  recipe: Recipe | PlannedMeal,
  preferences: UserPreferences
): number {
  let score = 0.5; // Start neutral
  const ingredients = recipe.ingredients.map(i => i.name.toLowerCase());
  const ingredientText = ingredients.join(' ');

  // Check for favorite ingredients (+0.1 each, max +0.3)
  let favoriteCount = 0;
  for (const fav of preferences.favoriteIngredients || []) {
    if (ingredientText.includes(fav.toLowerCase())) {
      favoriteCount++;
    }
  }
  score += Math.min(favoriteCount * 0.1, 0.3);

  // Check for disliked ingredients (-0.2 each)
  for (const disliked of preferences.dislikedIngredients || []) {
    if (ingredientText.includes(disliked.toLowerCase())) {
      score -= 0.2;
    }
  }

  // Check cuisine preference (+0.1 if matches)
  const recipeCuisine = ('cuisine' in recipe ? recipe.cuisine || '' : '').toLowerCase();
  if (recipeCuisine && preferences.cuisinePreferences?.some(c => c.toLowerCase() === recipeCuisine)) {
    score += 0.1;
  }

  // Check cooking time preference
  const totalTime = recipe.prepTime + recipe.cookTime;
  const timePreference = preferences.cookingTime || 'moderate';
  if (
    (timePreference === 'quick' && totalTime <= 30) ||
    (timePreference === 'moderate' && totalTime <= 60) ||
    (timePreference === 'extended') ||
    (timePreference === 'any')
  ) {
    score += 0.1;
  } else {
    score -= 0.1;
  }

  return Math.max(0, Math.min(1, score));
}

/**
 * Evaluate recipe variety in a meal plan
 */
export function evaluateRecipeVariety(mealPlan: MealPlan): number {
  const recipes = mealPlan.days.flatMap(d => d.meals);
  if (recipes.length <= 1) return 1.0;

  // Check cuisine diversity
  const cuisines = new Set(recipes.map(r => r.cuisine?.toLowerCase()).filter(Boolean));
  const cuisineScore = Math.min(cuisines.size / 4, 1.0); // 4+ cuisines = perfect

  // Check for recipe name uniqueness
  const names = recipes.map(r => r.recipeName.toLowerCase());
  const uniqueNames = new Set(names);
  const uniquenessScore = uniqueNames.size / names.length;

  // Check ingredient diversity
  const allIngredients = recipes.flatMap(r => r.ingredients.map(i => i.name.toLowerCase()));
  const uniqueIngredients = new Set(allIngredients);
  const ingredientScore = Math.min(uniqueIngredients.size / 20, 1.0); // 20+ unique = perfect

  return (cuisineScore * 0.3 + uniquenessScore * 0.4 + ingredientScore * 0.3);
}

/**
 * Evaluate instruction clarity
 * Simple heuristic based on instruction count and length
 */
export function evaluateInstructionClarity(recipe: Recipe | PlannedMeal): number {
  const instructions = recipe.instructions || [];

  if (instructions.length === 0) return 0.0;
  if (instructions.length < 3) return 0.5;

  // Check average instruction length (should be 20-100 chars)
  const avgLength = instructions.reduce((sum, i) => sum + i.length, 0) / instructions.length;
  let lengthScore = 1.0;
  if (avgLength < 20) lengthScore = 0.5;
  if (avgLength > 200) lengthScore = 0.7;

  // Check for numbered steps or action verbs
  const hasActionVerbs = instructions.some(i =>
    /^(mix|stir|add|cook|bake|fry|boil|chop|slice|combine|heat|serve|place|pour|season)/i.test(i.trim())
  );

  return hasActionVerbs ? lengthScore : lengthScore * 0.8;
}

/**
 * Evaluate ingredient accuracy
 * Checks if amounts and units make sense
 */
export function evaluateIngredientAccuracy(recipe: Recipe | PlannedMeal): number {
  const ingredients = recipe.ingredients || [];

  if (ingredients.length === 0) return 0.0;

  let validCount = 0;
  for (const ing of ingredients) {
    // Check if amount is a valid number
    const amount = parseFloat(ing.amount);
    if (!isNaN(amount) && amount > 0) {
      validCount++;
    }
    // Check if name exists and is reasonable length
    if (ing.name && ing.name.length > 2 && ing.name.length < 100) {
      validCount++;
    }
  }

  return validCount / (ingredients.length * 2);
}

/**
 * Calculate overall evaluation score
 */
export function calculateOverallScore(
  recipe: Recipe | PlannedMeal,
  restrictions: DietaryRestriction[],
  preferences: UserPreferences
): OpikEvaluationScore['scores'] {
  const dietaryCompliance = evaluateDietaryCompliance(recipe, restrictions);
  const preferenceAlignment = evaluatePreferenceAlignment(recipe, preferences);
  const instructionClarity = evaluateInstructionClarity(recipe);
  const ingredientAccuracy = evaluateIngredientAccuracy(recipe);

  // Overall quality is weighted average
  const overallQuality = (
    dietaryCompliance * 0.35 +
    preferenceAlignment * 0.25 +
    instructionClarity * 0.2 +
    ingredientAccuracy * 0.2
  );

  return {
    dietaryCompliance,
    preferenceAlignment,
    recipeVariety: 1.0, // Single recipe, no variety to measure
    instructionClarity,
    ingredientAccuracy,
    overallQuality
  };
}

/**
 * Evaluate a complete meal plan
 */
export function evaluateMealPlan(
  mealPlan: MealPlan,
  restrictions: DietaryRestriction[],
  preferences: UserPreferences
): OpikEvaluationScore['scores'] {
  const recipes = mealPlan.days.flatMap(d => d.meals);

  if (recipes.length === 0) {
    return {
      dietaryCompliance: 0,
      preferenceAlignment: 0,
      recipeVariety: 0,
      instructionClarity: 0,
      ingredientAccuracy: 0,
      overallQuality: 0
    };
  }

  // Calculate average scores across all recipes
  let totalDietary = 0;
  let totalPreference = 0;
  let totalClarity = 0;
  let totalAccuracy = 0;

  for (const recipe of recipes) {
    totalDietary += evaluateDietaryCompliance(recipe, restrictions);
    totalPreference += evaluatePreferenceAlignment(recipe, preferences);
    totalClarity += evaluateInstructionClarity(recipe);
    totalAccuracy += evaluateIngredientAccuracy(recipe);
  }

  const count = recipes.length;
  const dietaryCompliance = totalDietary / count;
  const preferenceAlignment = totalPreference / count;
  const recipeVariety = evaluateRecipeVariety(mealPlan);
  const instructionClarity = totalClarity / count;
  const ingredientAccuracy = totalAccuracy / count;

  const overallQuality = (
    dietaryCompliance * 0.3 +
    preferenceAlignment * 0.2 +
    recipeVariety * 0.2 +
    instructionClarity * 0.15 +
    ingredientAccuracy * 0.15
  );

  return {
    dietaryCompliance,
    preferenceAlignment,
    recipeVariety,
    instructionClarity,
    ingredientAccuracy,
    overallQuality
  };
}

/**
 * Check if evaluation passes minimum thresholds
 */
export function passesEvaluation(scores: OpikEvaluationScore['scores']): {
  passed: boolean;
  failures: string[];
} {
  const failures: string[] = [];

  if (scores.dietaryCompliance < THRESHOLDS.DIETARY_COMPLIANCE_MIN) {
    failures.push(`Dietary compliance (${scores.dietaryCompliance.toFixed(2)}) below threshold (${THRESHOLDS.DIETARY_COMPLIANCE_MIN})`);
  }
  if (scores.preferenceAlignment < THRESHOLDS.PREFERENCE_ALIGNMENT_MIN) {
    failures.push(`Preference alignment (${scores.preferenceAlignment.toFixed(2)}) below threshold (${THRESHOLDS.PREFERENCE_ALIGNMENT_MIN})`);
  }
  if (scores.recipeVariety < THRESHOLDS.RECIPE_VARIETY_MIN) {
    failures.push(`Recipe variety (${scores.recipeVariety.toFixed(2)}) below threshold (${THRESHOLDS.RECIPE_VARIETY_MIN})`);
  }
  if (scores.overallQuality < THRESHOLDS.OVERALL_QUALITY_MIN) {
    failures.push(`Overall quality (${scores.overallQuality.toFixed(2)}) below threshold (${THRESHOLDS.OVERALL_QUALITY_MIN})`);
  }

  return {
    passed: failures.length === 0,
    failures
  };
}

/**
 * Create an evaluation score record
 */
export function createEvaluationScore(
  traceId: string,
  scores: OpikEvaluationScore['scores'],
  feedback?: OpikEvaluationScore['feedback']
): OpikEvaluationScore {
  return {
    traceId,
    scores,
    feedback,
    timestamp: new Date()
  };
}

// Export evaluation service singleton
export const evaluationService = {
  generateTraceId,
  createTraceInput,
  createTraceOutput,
  evaluateDietaryCompliance,
  evaluatePreferenceAlignment,
  evaluateRecipeVariety,
  evaluateInstructionClarity,
  evaluateIngredientAccuracy,
  calculateOverallScore,
  evaluateMealPlan,
  passesEvaluation,
  createEvaluationScore,
  THRESHOLDS
};
