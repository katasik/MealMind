import { NextRequest, NextResponse } from 'next/server';
import { geminiService } from '../../../../lib/gemini';
import { firebaseService } from '../../../../lib/firebase';
import type { MealPlan, MealType } from '../../../../types';

// Helper to get start date (today by default)
function getStartDate(): string {
  return new Date().toISOString().split('T')[0];
}

// POST - Generate a new meal plan or regenerate a specific meal
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      familyId = 'demo-family',
      userId = 'demo-user',
      userName = 'Demo User',
      weekStartDate = getStartDate(),
      numberOfDays = 7,                                    // 1-7 days
      mealsPerDay = ['breakfast', 'lunch', 'dinner'] as MealType[],  // Which meals
      regenerateMeal, // Optional: { dayIndex: number, mealType: MealType }
      existingPlan: existingPlanFromBody // Optional: MealPlan from client
    } = body;

    console.log(`[MealPlan Generate] Starting for family ${familyId}, week ${weekStartDate}`);

    // Get family data for dietary restrictions
    const family = await firebaseService.getFamily(familyId);
    if (!family) {
      return NextResponse.json(
        { error: 'Family not found' },
        { status: 404 }
      );
    }

    // Get user preferences
    const user = await firebaseService.getUser(userId);
    const preferences = user?.preferences || {
      favoriteIngredients: [],
      dislikedIngredients: [],
      cuisinePreferences: [],
      cookingTime: 'moderate' as const
    };

    // Get saved recipes to prioritize
    const savedRecipes = await firebaseService.getWebRecipes(familyId);
    console.log(`[MealPlan Generate] Found ${savedRecipes.length} saved recipes`);

    // Check if there's an existing plan (for regeneration)
    let existingPlan: MealPlan | null = existingPlanFromBody || null;
    if (regenerateMeal && !existingPlan) {
      existingPlan = await firebaseService.getMealPlan(familyId, weekStartDate);
    }
    if (regenerateMeal && !existingPlan) {
      return NextResponse.json(
        { error: 'No existing meal plan found for this week to regenerate' },
        { status: 404 }
      );
    }

    const generationDays = regenerateMeal ? 1 : numberOfDays;
    const generationMeals = regenerateMeal ? [regenerateMeal.mealType] : mealsPerDay;

    // Generate meal plan using AI
    const days = await geminiService.generateWeeklyMealPlan({
      dietaryRestrictions: family.dietaryRestrictions || [],
      preferences,
      savedRecipes,
      weekStartDate: existingPlan?.weekStartDate || weekStartDate,
      numberOfDays: generationDays,
      mealsPerDay: generationMeals,
      regenerateMeal: regenerateMeal as { dayIndex: number; mealType: MealType } | undefined,
      existingPlan: existingPlan?.days
    });

    // Create or update the meal plan
    const mealPlan: MealPlan = {
      id: existingPlan?.id || `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      familyId,
      weekStartDate: existingPlan?.weekStartDate || weekStartDate,
      days,
      status: existingPlan?.status || 'draft',
      createdAt: existingPlan?.createdAt || new Date(),
      updatedAt: new Date(),
      createdByUserId: existingPlan?.createdByUserId || userId,
      createdByUserName: existingPlan?.createdByUserName || userName
    };

    // Save the meal plan
    await firebaseService.saveMealPlan(mealPlan);

    console.log(`[MealPlan Generate] Successfully generated plan ${mealPlan.id}`);

    return NextResponse.json({
      success: true,
      mealPlan,
      message: regenerateMeal ? 'Meal regenerated successfully' : 'Meal plan generated successfully'
    });
  } catch (error) {
    console.error('Meal plan generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate meal plan', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
