import { NextRequest, NextResponse } from 'next/server';
import { firebaseService } from '../../../lib/firebase';
import { evaluationService } from '../../../lib/evaluation';
import type { OpikEvaluationScore } from '../../../types';

/**
 * POST /api/evaluation
 * Evaluate a meal plan or recipe
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      mealPlanId,
      recipeId,
      familyId = 'demo-family',
      userId = 'demo-user',
      feedback // Optional: { rating, comment }
    } = body;

    if (!mealPlanId && !recipeId) {
      return NextResponse.json(
        { error: 'Either mealPlanId or recipeId is required' },
        { status: 400 }
      );
    }

    // Get family restrictions
    const family = await firebaseService.getFamily(familyId);
    const restrictions = family?.dietaryRestrictions || [];

    // Get user preferences
    const user = await firebaseService.getUser(userId);
    const preferences = user?.preferences || {
      favoriteIngredients: [],
      dislikedIngredients: [],
      cuisinePreferences: [],
      cookingTime: 'moderate' as const
    };

    let scores: OpikEvaluationScore['scores'];
    let traceId: string;

    if (mealPlanId) {
      // Evaluate meal plan
      const mealPlan = await firebaseService.getMealPlanById(mealPlanId);
      if (!mealPlan) {
        return NextResponse.json(
          { error: 'Meal plan not found' },
          { status: 404 }
        );
      }

      traceId = `eval-mealplan-${mealPlanId}`;
      scores = evaluationService.evaluateMealPlan(mealPlan, restrictions, preferences);
    } else {
      // Evaluate single recipe
      const recipe = await firebaseService.getRecipeById(recipeId);
      if (!recipe) {
        return NextResponse.json(
          { error: 'Recipe not found' },
          { status: 404 }
        );
      }

      traceId = `eval-recipe-${recipeId}`;
      scores = evaluationService.calculateOverallScore(recipe, restrictions, preferences);
    }

    // Check if passes thresholds
    const { passed, failures } = evaluationService.passesEvaluation(scores);

    // Create evaluation record with optional feedback
    const evaluationScore = evaluationService.createEvaluationScore(
      traceId,
      scores,
      feedback ? { userId, ...feedback } : undefined
    );

    return NextResponse.json({
      success: true,
      evaluation: {
        ...evaluationScore,
        passed,
        failures
      }
    });
  } catch (error) {
    console.error('Evaluation error:', error);
    return NextResponse.json(
      { error: 'Failed to evaluate', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/evaluation
 * Get evaluation thresholds and info
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    thresholds: evaluationService.THRESHOLDS,
    metrics: [
      { name: 'dietaryCompliance', description: 'How well dietary restrictions are respected (0-1)' },
      { name: 'preferenceAlignment', description: 'How well user preferences are matched (0-1)' },
      { name: 'recipeVariety', description: 'Diversity of cuisines and ingredients (0-1)' },
      { name: 'instructionClarity', description: 'Clarity and completeness of instructions (0-1)' },
      { name: 'ingredientAccuracy', description: 'Validity of ingredient amounts and units (0-1)' },
      { name: 'overallQuality', description: 'Weighted overall quality score (0-1)' }
    ]
  });
}
