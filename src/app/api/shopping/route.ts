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

// Ingredient category mapping
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'Produce': ['tomato', 'lettuce', 'onion', 'garlic', 'pepper', 'carrot', 'celery', 'potato', 'apple', 'banana', 'lemon', 'lime', 'cucumber', 'spinach', 'broccoli', 'zucchini', 'mushroom', 'avocado', 'cilantro', 'parsley', 'basil', 'ginger', 'paradicsom', 'hagyma', 'fokhagyma', 'paprika', 'répa', 'burgonya', 'uborka', 'brokkoli', 'cukkini', 'gomba', 'spenót', 'saláta'],
  'Meat & Seafood': ['chicken', 'beef', 'pork', 'fish', 'shrimp', 'salmon', 'turkey', 'bacon', 'ham', 'sausage', 'lamb', 'tuna', 'csirke', 'marha', 'sertés', 'hal', 'sonka', 'szalonna', 'kolbász'],
  'Dairy': ['milk', 'cheese', 'yogurt', 'butter', 'cream', 'egg', 'tej', 'sajt', 'joghurt', 'vaj', 'tejföl', 'tojás', 'túró'],
  'Grains & Pasta': ['rice', 'pasta', 'bread', 'flour', 'oats', 'quinoa', 'noodle', 'tortilla', 'rizs', 'tészta', 'kenyér', 'liszt', 'zabpehely'],
  'Pantry': ['oil', 'salt', 'pepper', 'sugar', 'vinegar', 'soy sauce', 'honey', 'mustard', 'ketchup', 'mayo', 'olaj', 'ecet', 'szójaszósz', 'méz', 'cukor'],
  'Spices': ['cumin', 'paprika', 'oregano', 'thyme', 'cinnamon', 'turmeric', 'curry', 'chili', 'köménymag', 'oregánó', 'kakukkfű', 'fahéj'],
  'Canned & Jarred': ['beans', 'tomato sauce', 'coconut milk', 'broth', 'stock', 'bab', 'paradicsomos', 'kókusztej', 'húsleves'],
  'Frozen': ['frozen', 'fagyasztott'],
  'Beverages': ['juice', 'soda', 'coffee', 'tea', 'gyümölcslé', 'kávé', 'tea']
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

// Clean up ingredient name - remove preparation methods and extra text
function sanitizeIngredientName(name: string): string {
  // Remove common preparation descriptions
  const preparationWords = [
    'diced', 'chopped', 'minced', 'sliced', 'crushed', 'grated', 'shredded',
    'julienned', 'cubed', 'halved', 'quartered', 'peeled', 'deveined',
    'boneless', 'skinless', 'fresh', 'dried', 'frozen', 'canned',
    'room temperature', 'cold', 'warm', 'melted', 'softened',
    'finely', 'roughly', 'coarsely', 'thinly', 'thickly',
    'to taste', 'optional', 'for garnish', 'for serving',
    'large', 'medium', 'small', 'ripe', 'unripe'
  ];

  let cleaned = name.trim();

  // Remove content in parentheses
  cleaned = cleaned.replace(/\(.*?\)/g, '');

  // Remove preparation words
  for (const word of preparationWords) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    cleaned = cleaned.replace(regex, '');
  }

  // Remove extra commas and spaces
  cleaned = cleaned.replace(/,\s*,/g, ',');
  cleaned = cleaned.replace(/\s+/g, ' ');
  cleaned = cleaned.replace(/^[\s,]+|[\s,]+$/g, '');

  // Capitalize first letter
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
  }

  return cleaned || name; // Return original if cleaning results in empty string
}

// Combine similar ingredients (e.g., "2 eggs" + "3 eggs" = "5 eggs")
function combineIngredients(ingredients: { ingredient: Ingredient; recipeName: string }[]): MealPlanShoppingItem[] {
  const combined: Map<string, MealPlanShoppingItem> = new Map();

  for (const { ingredient, recipeName } of ingredients) {
    // Sanitize the ingredient name to remove preparation methods
    const cleanName = sanitizeIngredientName(ingredient.name);
    const key = `${cleanName.toLowerCase()}-${(ingredient.unit || '').toLowerCase()}`;

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
        ingredientName: cleanName,
        amount: ingredient.amount,
        unit: ingredient.unit || '',
        category: ingredient.category || categorizeIngredient(cleanName),
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
    const allIngredients: { ingredient: Ingredient; recipeName: string }[] = [];

    for (const day of mealPlan.days) {
      for (const meal of day.meals) {
        for (const ingredient of meal.ingredients || []) {
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
