import { NextRequest, NextResponse } from 'next/server';
import { geminiService } from '@/lib/gemini';
import { opikService } from '@/lib/opik';
import { firebaseService } from '@/lib/firebase';
import type { Recipe, DietaryRestriction } from '@/types';

// Check if a recipe is safe for given dietary restrictions
function isRecipeSafeForRestrictions(recipe: Recipe, restrictions: DietaryRestriction[]): boolean {
  if (restrictions.length === 0) return true;

  const ingredientNames = recipe.ingredients.map(i => i.name.toLowerCase()).join(' ');
  const recipeTags = recipe.tags?.map(t => t.toLowerCase()) || [];
  const allText = `${ingredientNames} ${recipeTags.join(' ')} ${recipe.name.toLowerCase()}`;

  for (const restriction of restrictions) {
    const r = restriction.name.toLowerCase();

    // Gluten check
    if (r.includes('gluten') || r.includes('celiac')) {
      if (/flour|bread|pasta|wheat|barley|rye|couscous|semolina/i.test(allText)) {
        return false;
      }
    }

    // Dairy check
    if (r.includes('dairy') || r.includes('lactose')) {
      if (/milk|cheese|cream|butter|yogurt|yoghurt|whey|casein/i.test(allText)) {
        return false;
      }
    }

    // Vegetarian check
    if (r.includes('vegetarian')) {
      if (/chicken|beef|pork|lamb|fish|salmon|tuna|shrimp|bacon|ham|meat/i.test(allText)) {
        return false;
      }
    }

    // Vegan check
    if (r.includes('vegan')) {
      if (/chicken|beef|pork|lamb|fish|salmon|tuna|shrimp|bacon|ham|meat|milk|cheese|cream|butter|egg|honey/i.test(allText)) {
        return false;
      }
    }

    // Nut allergy check
    if (r.includes('nut')) {
      if (/peanut|almond|walnut|cashew|pecan|hazelnut|pistachio|macadamia/i.test(allText)) {
        return false;
      }
    }

    // Shellfish check
    if (r.includes('shellfish')) {
      if (/shrimp|lobster|crab|clam|mussel|oyster|scallop/i.test(allText)) {
        return false;
      }
    }
  }

  return true;
}

// Find matching saved recipes
async function findMatchingSavedRecipes(
  familyId: string,
  query: string,
  restrictions: DietaryRestriction[]
): Promise<Recipe[]> {
  try {
    const allRecipes = await firebaseService.getWebRecipes(familyId);
    console.log(`[Chat] Found ${allRecipes.length} saved recipes for family ${familyId}`);

    // Filter recipes that match restrictions
    const safeRecipes = allRecipes.filter(recipe =>
      isRecipeSafeForRestrictions(recipe, restrictions)
    );
    console.log(`[Chat] ${safeRecipes.length} recipes pass dietary restrictions`);

    if (safeRecipes.length === 0) return [];

    // Check if query is meal-related (generic)
    const isMealRelated = /dinner|lunch|breakfast|meal|eat|food|tonight|today|hungry|supper|brunch|snack|cook|make/i.test(query);

    // Extract keywords from query
    const commonWords = ['want', 'like', 'need', 'make', 'cook', 'something', 'recipe', 'for', 'the', 'and', 'what', 'should', 'can', 'could', 'tonight', 'today', 'dinner', 'lunch', 'breakfast', 'meal', 'eat', 'food', 'have', 'some', 'about', 'how'];
    const keywords = query.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2 && !commonWords.includes(w));

    // Score recipes
    const scored = safeRecipes.map(recipe => {
      let score = 0;
      const searchText = `${recipe.name} ${recipe.description || ''} ${(recipe.tags || []).join(' ')} ${recipe.cuisine || ''}`.toLowerCase();

      for (const keyword of keywords) {
        if (searchText.includes(keyword)) {
          score += 10;
        }
        for (const ing of recipe.ingredients) {
          if (ing.name.toLowerCase().includes(keyword)) {
            score += 5;
          }
        }
      }

      return { recipe, score };
    });

    // Get matches with score > 0
    const matches = scored
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(s => s.recipe);

    if (matches.length > 0) return matches;

    // For generic meal queries, return random safe recipes
    if (isMealRelated && safeRecipes.length > 0) {
      const shuffled = [...safeRecipes].sort(() => Math.random() - 0.5);
      return shuffled.slice(0, 3);
    }

    return [];
  } catch (error) {
    console.error('Error finding saved recipes:', error);
    return [];
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, conversationHistory, familyId, useRecipeId } = body;

    const actualFamilyId = familyId || 'demo-family';

    // Get family data (will use mock data if Firebase not configured)
    const family = await firebaseService.getFamily(actualFamilyId);
    if (!family) {
      return NextResponse.json(
        { error: 'Family not found' },
        { status: 404 }
      );
    }

    // Ensure dietaryRestrictions is an array
    const dietaryRestrictions = Array.isArray(family.dietaryRestrictions)
      ? family.dietaryRestrictions
      : [];

    // If user selected a specific saved recipe to use
    if (useRecipeId) {
      const recipe = await firebaseService.getRecipeById(useRecipeId);
      if (recipe) {
        return NextResponse.json({
          message: `Great choice! Here's ${recipe.name}`,
          recipe,
          shoppingList: recipe.ingredients.map(ing => ({
            ingredient: ing,
            checked: false,
            category: ing.category || 'Other'
          })),
          evaluation: null
        });
      }
    }

    // Detect if user is asking for a recipe
    const isRecipeRequest = /suggest|recipe|cook|eat|meal|dinner|lunch|breakfast|make|food|hungry/i.test(message);

    if (isRecipeRequest) {
      // First, check for matching saved recipes
      const savedRecipes = await findMatchingSavedRecipes(actualFamilyId, message, dietaryRestrictions);

      if (savedRecipes.length > 0) {
        // Return saved recipe suggestions
        return NextResponse.json({
          message: `I found ${savedRecipes.length} recipe${savedRecipes.length > 1 ? 's' : ''} from your collection that might work!`,
          recipe: null,
          shoppingList: null,
          evaluation: null,
          savedRecipeOptions: savedRecipes.map(r => ({
            id: r.id,
            name: r.name,
            description: r.description,
            prepTime: r.prepTime,
            cookTime: r.cookTime,
            cuisine: r.cuisine,
            difficulty: r.difficulty,
            tags: r.tags
          }))
        });
      }

      // No saved recipes match - generate new one
      const members = await firebaseService.getFamilyMembers(actualFamilyId);
      const preferences = members[0]?.preferences || {
        favoriteIngredients: [],
        dislikedIngredients: [],
        cuisinePreferences: [],
        cookingTime: 'moderate' as const
      };

      const result = await geminiService.generateRecipe({
        dietaryRestrictions,
        preferences,
        mealType: 'dinner',
        conversationHistory
      });

      // Evaluate recipe
      const evaluation = await opikService.evaluateRecipe(
        result.recipe,
        dietaryRestrictions,
        actualFamilyId
      );

      // Check safety
      if (!evaluation.safety.passed) {
        return NextResponse.json({
          message: `Safety Alert! I found potential allergens: ${evaluation.safety.allergensDetected.join(', ')}. Let me suggest something else...`,
          recipe: null,
          shoppingList: null,
          evaluation: null
        });
      }

      // Save recipe
      await firebaseService.saveRecipe(result.recipe);

      // Format response
      const responseMessage = `Here's a great ${result.recipe.difficulty} recipe for you:\n\n${result.recipe.name}\n\n${result.recipe.description}\n\n${result.recipe.prepTime + result.recipe.cookTime} minutes total`;

      return NextResponse.json({
        message: responseMessage,
        recipe: result.recipe,
        shoppingList: result.shoppingList,
        evaluation
      });

    } else {
      // Regular chat
      const response = await geminiService.chat(message, conversationHistory || []);

      return NextResponse.json({
        message: response,
        recipe: null,
        shoppingList: null,
        evaluation: null
      });
    }

  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Failed to process message', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}