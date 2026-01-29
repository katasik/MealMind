import { NextRequest, NextResponse } from 'next/server';
import { firebaseService } from '../../../lib/firebase';
import type { MealPlanShoppingList, MealPlanShoppingItem, Ingredient } from '../../../types';

// Check if a week has ended (Sunday has passed)
function isWeekExpired(weekStartDate: string): boolean {
  const monday = new Date(weekStartDate);
  // Week ends on Sunday (6 days after Monday)
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return new Date() > sunday;
}

// Get current week's Monday date
function getCurrentWeekStartDate(): string {
  const today = new Date();
  const day = today.getDay();
  const diff = today.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(today.setDate(diff));
  return monday.toISOString().split('T')[0];
}

// Ingredient category mapping (English keywords - recipes are now translated at AI level)
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'Produce': ['tomato', 'lettuce', 'onion', 'garlic', 'pepper', 'carrot', 'celery', 'potato', 'apple', 'banana', 'lemon', 'lime', 'cucumber', 'spinach', 'broccoli', 'zucchini', 'mushroom', 'avocado', 'cilantro', 'parsley', 'basil', 'ginger', 'cabbage', 'kale', 'asparagus', 'corn', 'peas', 'beans', 'eggplant'],
  'Meat & Seafood': ['chicken', 'beef', 'pork', 'fish', 'shrimp', 'salmon', 'turkey', 'bacon', 'ham', 'sausage', 'lamb', 'tuna', 'cod', 'tilapia', 'crab', 'lobster', 'duck', 'veal'],
  'Dairy': ['milk', 'cheese', 'yogurt', 'butter', 'cream', 'egg', 'sour cream', 'cottage cheese', 'mozzarella', 'parmesan', 'cheddar', 'feta'],
  'Grains & Pasta': ['rice', 'pasta', 'bread', 'flour', 'oats', 'quinoa', 'noodle', 'tortilla', 'couscous', 'barley', 'cereal', 'crackers'],
  'Pantry': ['oil', 'salt', 'pepper', 'sugar', 'vinegar', 'soy sauce', 'honey', 'mustard', 'ketchup', 'mayo', 'mayonnaise', 'sauce', 'dressing'],
  'Spices': ['cumin', 'paprika', 'oregano', 'thyme', 'cinnamon', 'turmeric', 'curry', 'chili', 'basil', 'rosemary', 'sage', 'bay leaf', 'nutmeg', 'ginger'],
  'Canned & Jarred': ['canned', 'tomato sauce', 'coconut milk', 'broth', 'stock', 'paste', 'pickles', 'olives', 'capers'],
  'Frozen': ['frozen'],
  'Beverages': ['juice', 'soda', 'coffee', 'tea', 'water', 'wine', 'beer']
};

function categorizeIngredient(name: string): string {
  const lowerName = name.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(keyword => lowerName.includes(keyword))) {
      return category;
    }
  }
  return 'Other';
}

// Combine similar ingredients (e.g., "2 eggs" + "3 eggs" = "5 eggs")
// Now preserves exact ingredient names from recipe database
function combineIngredients(ingredients: { ingredient: Ingredient; recipeName: string }[]): MealPlanShoppingItem[] {
  const combined: Map<string, MealPlanShoppingItem> = new Map();

  for (const { ingredient, recipeName } of ingredients) {
    // Use the exact ingredient name from the recipe (no sanitization)
    const ingredientName = ingredient.name.trim();
    // Key for combining: lowercase name + unit (to combine "2 eggs" + "3 eggs")
    const key = `${ingredientName.toLowerCase()}-${(ingredient.unit || '').toLowerCase()}`;

    if (combined.has(key)) {
      const existing = combined.get(key)!;
      // Try to add amounts if both are numbers
      const existingAmount = parseFloat(existing.amount);
      const newAmount = parseFloat(ingredient.amount);

      if (!isNaN(existingAmount) && !isNaN(newAmount)) {
        existing.amount = String(existingAmount + newAmount);
      } else {
        // If can't combine numerically, just append
        existing.amount = `${existing.amount} + ${ingredient.amount}`;
      }

      // Add recipe name if not already included
      if (!existing.recipeNames.includes(recipeName)) {
        existing.recipeNames.push(recipeName);
      }
    } else {
      combined.set(key, {
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        ingredientName: ingredientName,
        amount: ingredient.amount,
        unit: ingredient.unit || '',
        category: ingredient.category || categorizeIngredient(ingredientName),
        recipeNames: [recipeName],
        checked: false
      });
    }
  }

  return Array.from(combined.values());
}

// POST - Generate shopping list from meal plan
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mealPlanId, familyId = 'demo-family' } = body;

    if (!mealPlanId) {
      return NextResponse.json(
        { error: 'mealPlanId is required' },
        { status: 400 }
      );
    }

    // Get the meal plan
    const mealPlan = await firebaseService.getMealPlanById(mealPlanId);
    if (!mealPlan) {
      return NextResponse.json(
        { error: 'Meal plan not found' },
        { status: 404 }
      );
    }

    // Extract all ingredients from all meals
    // Prefer exact ingredients from recipe database when available
    const allIngredients: { ingredient: Ingredient; recipeName: string }[] = [];

    for (const day of mealPlan.days) {
      for (const meal of day.meals) {
        let ingredients = meal.ingredients || [];

        // Try to get exact ingredients from recipe database
        if (meal.recipeId) {
          const dbRecipe = await firebaseService.getRecipeById(meal.recipeId);
          if (dbRecipe && dbRecipe.ingredients && dbRecipe.ingredients.length > 0) {
            // Use exact ingredients from the database
            ingredients = dbRecipe.ingredients;
          }
        }

        for (const ingredient of ingredients) {
          allIngredients.push({
            ingredient,
            recipeName: meal.recipeName
          });
        }
      }
    }

    // Combine similar ingredients
    const combinedItems = combineIngredients(allIngredients);

    // Sort by category
    combinedItems.sort((a, b) => {
      if (a.category === b.category) {
        return a.ingredientName.localeCompare(b.ingredientName);
      }
      return a.category.localeCompare(b.category);
    });

    // Check if shopping list already exists for this meal plan
    let existingList = await firebaseService.getMealPlanShoppingListByPlanId(mealPlanId);

    const shoppingList: MealPlanShoppingList = {
      id: existingList?.id || `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      mealPlanId,
      familyId,
      weekStartDate: mealPlan.weekStartDate,
      items: combinedItems,
      status: 'active',
      createdAt: existingList?.createdAt || new Date(),
      updatedAt: new Date()
    };

    // Save the shopping list
    await firebaseService.saveMealPlanShoppingList(shoppingList);

    return NextResponse.json({
      success: true,
      shoppingList,
      message: 'Shopping list generated successfully'
    });
  } catch (error) {
    console.error('Generate shopping list error:', error);
    return NextResponse.json(
      { error: 'Failed to generate shopping list' },
      { status: 500 }
    );
  }
}

// GET - Get shopping list
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const familyId = searchParams.get('familyId') || 'demo-family';
    const mealPlanId = searchParams.get('mealPlanId');
    const weekStartDate = searchParams.get('weekStartDate');

    let shoppingList: MealPlanShoppingList | null = null;

    if (mealPlanId) {
      shoppingList = await firebaseService.getMealPlanShoppingListByPlanId(mealPlanId);
    } else if (weekStartDate) {
      shoppingList = await firebaseService.getMealPlanShoppingList(familyId, weekStartDate);
    } else {
      // Get the active shopping list
      shoppingList = await firebaseService.getActiveMealPlanShoppingList(familyId);
    }

    // Auto-cleanup: if shopping list week has expired, mark as completed and return null
    if (shoppingList && isWeekExpired(shoppingList.weekStartDate)) {
      // Mark the expired list as completed
      await firebaseService.updateMealPlanShoppingListStatus(shoppingList.id, 'completed');

      // Try to get current week's shopping list instead
      const currentWeek = getCurrentWeekStartDate();
      shoppingList = await firebaseService.getMealPlanShoppingList(familyId, currentWeek);
    }

    return NextResponse.json({
      success: true,
      shoppingList
    });
  } catch (error) {
    console.error('Get shopping list error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch shopping list' },
      { status: 500 }
    );
  }
}

// PUT - Update shopping list item (check/uncheck)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { listId, itemId, checked } = body;

    if (!listId || !itemId || typeof checked !== 'boolean') {
      return NextResponse.json(
        { error: 'listId, itemId, and checked are required' },
        { status: 400 }
      );
    }

    await firebaseService.updateMealPlanShoppingItem(listId, itemId, { checked });

    // Get updated list
    const updatedList = await firebaseService.getMealPlanShoppingListById(listId);

    return NextResponse.json({
      success: true,
      shoppingList: updatedList,
      message: 'Item updated successfully'
    });
  } catch (error) {
    console.error('Update shopping item error:', error);
    return NextResponse.json(
      { error: 'Failed to update shopping item' },
      { status: 500 }
    );
  }
}
