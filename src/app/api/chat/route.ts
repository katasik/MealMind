import { NextRequest, NextResponse } from 'next/server';
import { geminiService } from '@/lib/gemini';
import { opikService } from '@/lib/opik';
import { firebaseService } from '@/lib/firebase';
import type { Recipe, DietaryRestriction, UserPreferences } from '@/types';

// Ingredient substitution map for dietary restrictions
const INGREDIENT_SUBSTITUTIONS: Record<string, { pattern: RegExp; substitutes: string[] }> = {
  'no red meat': {
    pattern: /beef|lamb|pork|veal|venison|bison|goat/i,
    substitutes: ['chicken', 'turkey', 'fish', 'tofu', 'tempeh']
  },
  'vegetarian': {
    pattern: /chicken|beef|pork|lamb|fish|salmon|tuna|shrimp|bacon|ham|meat|turkey/i,
    substitutes: ['tofu', 'tempeh', 'seitan', 'mushrooms', 'jackfruit', 'legumes']
  },
  'vegan': {
    pattern: /chicken|beef|pork|lamb|fish|salmon|tuna|shrimp|bacon|ham|meat|milk|cheese|cream|butter|egg|honey|turkey/i,
    substitutes: ['tofu', 'tempeh', 'nutritional yeast', 'coconut cream', 'flax egg', 'maple syrup']
  },
  'dairy-free': {
    pattern: /milk|cheese|cream|butter|yogurt|yoghurt|whey|casein/i,
    substitutes: ['oat milk', 'coconut milk', 'vegan cheese', 'coconut cream', 'olive oil']
  },
  'gluten-free': {
    pattern: /flour|bread|pasta|wheat|barley|rye|couscous|semolina/i,
    substitutes: ['rice flour', 'almond flour', 'rice noodles', 'quinoa', 'gluten-free bread']
  }
};

// Check if a recipe is safe for given dietary restrictions
function isRecipeSafeForRestrictions(recipe: Recipe, restrictions: DietaryRestriction[]): boolean {
  if (restrictions.length === 0) return true;

  // Safely handle ingredients that might not have a name
  const ingredientNames = (recipe.ingredients || [])
    .map(i => (i?.name || '').toLowerCase())
    .join(' ');
  const recipeTags = (recipe.tags || []).map(t => (t || '').toLowerCase());
  const allText = `${ingredientNames} ${recipeTags.join(' ')} ${(recipe.name || '').toLowerCase()}`;

  for (const restriction of restrictions) {
    const r = (restriction?.name || '').toLowerCase();
    if (!r) continue;

    // Gluten check
    if (r.includes('gluten') || r.includes('celiac')) {
      if (/flour|bread|pasta|wheat|barley|rye|couscous|semolina|liszt|zsemle/i.test(allText)) {
        return false;
      }
    }

    // Dairy check
    if (r.includes('dairy') || r.includes('lactose')) {
      if (/milk|cheese|cream|butter|yogurt|yoghurt|whey|casein|tej|sajt|vaj|tejföl|túró/i.test(allText)) {
        return false;
      }
    }

    // Vegetarian check
    if (r.includes('vegetarian')) {
      if (/chicken|beef|pork|lamb|fish|salmon|tuna|shrimp|bacon|ham|meat|csirke|marha|sertés|hal|szalonna/i.test(allText)) {
        return false;
      }
    }

    // Vegan check
    if (r.includes('vegan')) {
      if (/chicken|beef|pork|lamb|fish|salmon|tuna|shrimp|bacon|ham|meat|milk|cheese|cream|butter|egg|honey|tojás|méz/i.test(allText)) {
        return false;
      }
    }

    // Nut allergy check
    if (r.includes('nut')) {
      if (/peanut|almond|walnut|cashew|pecan|hazelnut|pistachio|macadamia|mogyoró|dió|mandula/i.test(allText)) {
        return false;
      }
    }

    // Shellfish check
    if (r.includes('shellfish')) {
      if (/shrimp|lobster|crab|clam|mussel|oyster|scallop|rák|kagyló/i.test(allText)) {
        return false;
      }
    }

    // No red meat check
    if (r.includes('red meat') || r.includes('no red meat')) {
      if (/beef|lamb|pork|veal|venison|bison|goat|marha|bárány|sertés|borjú/i.test(allText)) {
        return false;
      }
    }

    // Egg-free check
    if (r.includes('egg')) {
      if (/\begg\b|eggs|tojás/i.test(allText)) {
        return false;
      }
    }

    // Soy-free check
    if (r.includes('soy')) {
      if (/soy|tofu|tempeh|edamame|szója/i.test(allText)) {
        return false;
      }
    }

    // PCOS-friendly check (low glycemic, anti-inflammatory)
    if (r.includes('pcos')) {
      // Avoid high-glycemic and inflammatory foods
      if (/white bread|white rice|sugar|candy|soda|processed|fehér kenyér|fehér rizs|cukor/i.test(allText)) {
        return false;
      }
    }

    // Diabetic-friendly check
    if (r.includes('diabetic')) {
      if (/sugar|candy|soda|syrup|cukor|szörp|édesség/i.test(allText)) {
        return false;
      }
    }

    // Low-sodium check
    if (r.includes('sodium') || r.includes('low-sodium')) {
      if (/soy sauce|fish sauce|bacon|ham|processed|szójaszósz|szalonna/i.test(allText)) {
        return false;
      }
    }
  }

  return true;
}

// Check if recipe fits cooking time preference
function fitsTimePreference(recipe: Recipe, cookingTime: UserPreferences['cookingTime']): boolean {
  if (cookingTime === 'any') return true;

  const totalTime = (recipe.prepTime || 0) + (recipe.cookTime || 0);

  switch (cookingTime) {
    case 'quick':
      return totalTime <= 30;
    case 'moderate':
      return totalTime <= 60;
    case 'extended':
      return true; // Extended accepts any time
    default:
      return true;
  }
}

// Check if recipe contains disliked ingredients
function hasDislikedIngredients(recipe: Recipe, disliked: string[]): boolean {
  if (disliked.length === 0) return false;

  const ingredientNames = (recipe.ingredients || [])
    .map(i => (i?.name || '').toLowerCase())
    .join(' ');

  for (const dislikedItem of disliked) {
    if (ingredientNames.includes(dislikedItem.toLowerCase())) {
      return true;
    }
  }
  return false;
}

// Check if recipe contains any favorite ingredients
function hasFavoriteIngredients(recipe: Recipe, favorites: string[]): boolean {
  if (favorites.length === 0) return true; // No favorites = all recipes qualify

  const ingredientNames = (recipe.ingredients || [])
    .map(i => (i?.name || '').toLowerCase())
    .join(' ');
  const recipeText = `${recipe.name || ''} ${recipe.description || ''} ${ingredientNames}`.toLowerCase();

  for (const fav of favorites) {
    const favLower = fav.toLowerCase();
    if (recipeText.includes(favLower)) {
      return true;
    }
  }
  return false;
}

// Score recipe based on favorite ingredients (more flexible matching)
function scoreFavoriteIngredients(recipe: Recipe, favorites: string[]): number {
  if (favorites.length === 0) return 0;

  let score = 0;
  let matchCount = 0;

  // Check each ingredient individually for better matching
  for (const ingredient of recipe.ingredients || []) {
    const ingName = (ingredient?.name || '').toLowerCase();

    for (const fav of favorites) {
      const favLower = fav.toLowerCase();
      // Check if favorite is in ingredient name OR ingredient is in favorite
      // e.g., "broccoli" matches "steamed broccoli" and vice versa
      if (ingName.includes(favLower) || favLower.includes(ingName)) {
        score += 30; // High bonus for favorite ingredients
        matchCount++;
        console.log(`[Score] +30 for favorite ingredient: ${fav} matched ${ingName}`);
      }
    }
  }

  // Also check recipe name and description
  const recipeText = `${recipe.name || ''} ${recipe.description || ''}`.toLowerCase();
  for (const fav of favorites) {
    if (recipeText.includes(fav.toLowerCase())) {
      score += 15; // Bonus if favorite is in recipe name/description
      console.log(`[Score] +15 for favorite in recipe text: ${fav}`);
    }
  }

  // Extra bonus for recipes with multiple favorites
  if (matchCount > 1) {
    score += matchCount * 10;
    console.log(`[Score] +${matchCount * 10} bonus for ${matchCount} favorite matches`);
  }

  return score;
}

// Score recipe based on cuisine preference
function scoreCuisinePreference(recipe: Recipe, cuisines: string[]): number {
  if (cuisines.length === 0) return 0;

  const recipeCuisine = (recipe.cuisine || '').toLowerCase();
  for (const cuisine of cuisines) {
    if (recipeCuisine.includes(cuisine.toLowerCase())) {
      return 10; // Bonus for matching cuisine
    }
  }
  return 0;
}

// Get suggested substitutions for a recipe based on restrictions
function getSuggestedSubstitutions(recipe: Recipe, restrictions: DietaryRestriction[]): string[] {
  const suggestions: string[] = [];

  const ingredientNames = (recipe.ingredients || [])
    .map(i => (i?.name || '').toLowerCase())
    .join(' ');

  for (const restriction of restrictions) {
    const r = (restriction?.name || '').toLowerCase();

    for (const [key, value] of Object.entries(INGREDIENT_SUBSTITUTIONS)) {
      if (r.includes(key) || key.includes(r.split('-')[0])) {
        const matches = ingredientNames.match(value.pattern);
        if (matches) {
          suggestions.push(`Replace ${matches[0]} with ${value.substitutes.slice(0, 2).join(' or ')}`);
        }
      }
    }
  }

  return Array.from(new Set(suggestions)); // Remove duplicates
}

// Extract ingredient keywords from query (handles phrases like "something with chicken")
function extractIngredientKeywords(query: string): string[] {
  const lowerQuery = query.toLowerCase();

  // Common patterns for ingredient requests (supports English and Hungarian characters)
  // "something with X", "recipe with X", "using X", "contains X", "has X", "made with X"
  // Character class includes: a-z (English) + áéíóöőúüű (Hungarian accented)
  const ingredientCharClass = '[a-záéíóöőúüű]';

  // Stop words that shouldn't be part of ingredient names
  const stopWords = ['from', 'my', 'the', 'a', 'an', 'some', 'any', 'recipes', 'recipe', 'saved', 'collection', 'please', 'can', 'you', 'me', 'in', 'on', 'for', 'and', 'or', 'that', 'this', 'is', 'are', 'it'];

  const withPatterns = [
    new RegExp(`(?:something|recipe|dish|meal|food)\\s+(?:with|using|containing|that (?:has|contains|uses))\\s+(${ingredientCharClass}+)`, 'gi'),
    new RegExp(`(?:with|using)\\s+(${ingredientCharClass}+)`, 'gi'),
    new RegExp(`(?:made\\s+(?:with|from))\\s+(${ingredientCharClass}+)`, 'gi'),
    // Also match "recommend X" patterns
    new RegExp(`(?:recommend|suggest)\\s+(?:a\\s+)?(?:something\\s+)?(?:with\\s+)?(${ingredientCharClass}+)`, 'gi')
  ];

  const ingredientKeywords: string[] = [];

  for (const pattern of withPatterns) {
    let match;
    while ((match = pattern.exec(lowerQuery)) !== null) {
      const ingredient = match[1].trim();
      // Filter out stop words
      if (ingredient && !stopWords.includes(ingredient)) {
        ingredientKeywords.push(ingredient);
      }
    }
  }

  return Array.from(new Set(ingredientKeywords)); // Remove duplicates
}

// Check if recipe contains specific ingredient keywords from the query
function recipeContainsQueryIngredients(recipe: Recipe, ingredientKeywords: string[]): boolean {
  if (ingredientKeywords.length === 0) return true;

  const ingredientNames = (recipe.ingredients || [])
    .map(i => (i?.name || '').toLowerCase())
    .join(' ');
  const recipeText = `${recipe.name || ''} ${recipe.description || ''} ${ingredientNames} ${(recipe.tags || []).join(' ')}`.toLowerCase();

  // Recipe must contain at least one of the requested ingredients
  for (const keyword of ingredientKeywords) {
    if (recipeText.includes(keyword.toLowerCase())) {
      return true;
    }
  }
  return false;
}

// Find matching saved recipes with full preference filtering
async function findMatchingSavedRecipes(
  familyId: string,
  query: string,
  restrictions: DietaryRestriction[],
  preferences: UserPreferences,
  skipRecipeIds: string[] = []
): Promise<{ recipes: Recipe[]; substitutionSuggestions?: string[] }> {
  try {
    let allRecipes = await firebaseService.getWebRecipes(familyId);
    console.log(`[Chat] Found ${allRecipes.length} saved recipes for family ${familyId}`);

    // Skip previously shown recipes if requested
    if (skipRecipeIds.length > 0) {
      allRecipes = allRecipes.filter(r => !skipRecipeIds.includes(r.id));
      console.log(`[Chat] After skipping ${skipRecipeIds.length} recipes: ${allRecipes.length} remaining`);
    }

    // NEW: Extract specific ingredient keywords from the query (e.g., "chicken" from "something with chicken")
    const queryIngredients = extractIngredientKeywords(query);
    console.log(`[Chat] Extracted ingredient keywords from query: ${queryIngredients.join(', ') || '(none)'}`);

    // Step 1: Filter by dietary restrictions
    let filteredRecipes = allRecipes.filter(recipe =>
      isRecipeSafeForRestrictions(recipe, restrictions)
    );
    console.log(`[Chat] ${filteredRecipes.length} recipes pass dietary restrictions`);

    // Step 1.5: NEW - If user asked for specific ingredients, filter by those FIRST
    if (queryIngredients.length > 0) {
      const withQueryIngredients = filteredRecipes.filter(recipe =>
        recipeContainsQueryIngredients(recipe, queryIngredients)
      );
      if (withQueryIngredients.length > 0) {
        console.log(`[Chat] Found ${withQueryIngredients.length} recipes containing query ingredients: ${queryIngredients.join(', ')}`);
        filteredRecipes = withQueryIngredients;
      } else {
        console.log(`[Chat] No recipes contain query ingredients (${queryIngredients.join(', ')}), will return empty for this specific request`);
        // For specific ingredient requests, if no matches, return empty rather than fallback
        return { recipes: [] };
      }
    }

    // Step 2: Filter by cooking time preference
    if (preferences.cookingTime && preferences.cookingTime !== 'any') {
      const timeFiltered = filteredRecipes.filter(recipe =>
        fitsTimePreference(recipe, preferences.cookingTime)
      );
      // Only apply time filter if it doesn't eliminate all recipes
      if (timeFiltered.length > 0) {
        filteredRecipes = timeFiltered;
        console.log(`[Chat] ${filteredRecipes.length} recipes fit time preference (${preferences.cookingTime})`);
      } else {
        console.log(`[Chat] Time filter would eliminate all recipes, skipping`);
      }
    }

    // Step 3: Filter out disliked ingredients
    if (preferences.dislikedIngredients && preferences.dislikedIngredients.length > 0) {
      const withoutDisliked = filteredRecipes.filter(recipe =>
        !hasDislikedIngredients(recipe, preferences.dislikedIngredients)
      );
      // Only apply filter if it doesn't eliminate all recipes
      if (withoutDisliked.length > 0) {
        filteredRecipes = withoutDisliked;
        console.log(`[Chat] ${filteredRecipes.length} recipes without disliked ingredients`);
      } else {
        console.log(`[Chat] Disliked filter would eliminate all recipes, skipping`);
      }
    }

    // Step 4: PRIORITIZE recipes with favorite ingredients (only if no specific query ingredients)
    if (queryIngredients.length === 0 && preferences.favoriteIngredients && preferences.favoriteIngredients.length > 0) {
      const withFavorites = filteredRecipes.filter(recipe =>
        hasFavoriteIngredients(recipe, preferences.favoriteIngredients)
      );
      // If we have recipes with favorites, use ONLY those
      if (withFavorites.length > 0) {
        console.log(`[Chat] Found ${withFavorites.length} recipes with favorite ingredients: ${preferences.favoriteIngredients.join(', ')}`);
        filteredRecipes = withFavorites;
      } else {
        console.log(`[Chat] No recipes contain favorites (${preferences.favoriteIngredients.join(', ')}), using all ${filteredRecipes.length} recipes`);
      }
    }

    if (filteredRecipes.length === 0) {
      // Check if we have recipes that could work with substitutions
      const recipesWithSubstitutions = allRecipes.slice(0, 3).map(recipe => ({
        recipe,
        substitutions: getSuggestedSubstitutions(recipe, restrictions)
      })).filter(r => r.substitutions.length > 0);

      if (recipesWithSubstitutions.length > 0) {
        return {
          recipes: recipesWithSubstitutions.map(r => r.recipe),
          substitutionSuggestions: recipesWithSubstitutions.flatMap(r => r.substitutions)
        };
      }

      return { recipes: [] };
    }

    // Check if query is meal-related (generic)
    const isMealRelated = /dinner|lunch|breakfast|meal|eat|food|tonight|today|hungry|supper|brunch|snack|cook|make/i.test(query);
    console.log(`[Chat] isMealRelated=${isMealRelated} for query: "${query}"`);

    // Extract keywords from query (general keywords, not just ingredients)
    const commonWords = ['want', 'like', 'need', 'make', 'cook', 'something', 'recipe', 'for', 'the', 'and', 'what', 'should', 'can', 'could', 'tonight', 'today', 'dinner', 'lunch', 'breakfast', 'meal', 'eat', 'food', 'have', 'some', 'about', 'how', 'quick', 'fast', 'easy', 'with', 'from', 'my', 'recipes', 'saved', 'using', 'recommend', 'suggest', 'you'];
    const keywords = query.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2 && !commonWords.includes(w));
    console.log(`[Chat] Extracted general keywords: ${keywords.join(', ') || '(none)'}`);

    // Score recipes based on multiple factors
    const scored = filteredRecipes.map(recipe => {
      let score = 0;
      const searchText = `${recipe.name} ${recipe.description || ''} ${(recipe.tags || []).join(' ')} ${recipe.cuisine || ''}`.toLowerCase();

      // HIGH priority: Query ingredient matching (user explicitly asked for this)
      for (const ingredient of queryIngredients) {
        const ingredientLower = ingredient.toLowerCase();
        // Check recipe name/description
        if (searchText.includes(ingredientLower)) {
          score += 50; // High score for matching the explicit request
          console.log(`[Score] +50 for query ingredient "${ingredient}" in recipe text: ${recipe.name}`);
        }
        // Check ingredients list
        for (const ing of recipe.ingredients || []) {
          if ((ing?.name || '').toLowerCase().includes(ingredientLower)) {
            score += 40; // High score for ingredient match
            console.log(`[Score] +40 for query ingredient "${ingredient}" in ingredients: ${recipe.name}`);
          }
        }
      }

      // General keyword matching
      for (const keyword of keywords) {
        if (searchText.includes(keyword)) {
          score += 10;
        }
        for (const ing of recipe.ingredients || []) {
          if ((ing?.name || '').toLowerCase().includes(keyword)) {
            score += 5;
          }
        }
      }

      // Bonus for favorite ingredients (lower priority than query ingredients)
      if (queryIngredients.length === 0) {
        score += scoreFavoriteIngredients(recipe, preferences.favoriteIngredients || []);
      }

      // Bonus for preferred cuisine
      score += scoreCuisinePreference(recipe, preferences.cuisinePreferences || []);

      return { recipe, score };
    });

    // Sort by score
    scored.sort((a, b) => b.score - a.score);

    // Get top matches
    const matches = scored
      .filter(s => s.score > 0)
      .slice(0, 3)
      .map(s => s.recipe);

    console.log(`[Chat] Scored matches: ${matches.length} recipes (top scores: ${scored.slice(0, 3).map(s => s.score).join(', ')})`);

    if (matches.length > 0) return { recipes: matches };

    // For generic meal queries, return recipes prioritized by favorites/cuisine
    if (isMealRelated && filteredRecipes.length > 0) {
      console.log(`[Chat] Returning preference-sorted recipes for generic meal query`);
      // Return top scored even if score is 0 (they still match preferences via filtering)
      return { recipes: scored.slice(0, 3).map(s => s.recipe) };
    }

    console.log(`[Chat] No matches found, returning empty`);
    return { recipes: [] };
  } catch (error) {
    console.error('Error finding saved recipes:', error);
    return { recipes: [] };
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

    // Get user preferences - use getUser directly for consistency with settings API
    const userId = body.userId || 'demo-user';
    const user = await firebaseService.getUser(userId);
    const preferences: UserPreferences = user?.preferences || {
      favoriteIngredients: [],
      dislikedIngredients: [],
      cuisinePreferences: [],
      cookingTime: 'moderate' as const
    };

    // Log preferences for debugging
    console.log(`[Chat] User preferences - favorites: [${preferences.favoriteIngredients.join(', ') || 'none'}], disliked: [${preferences.dislikedIngredients.join(', ') || 'none'}], time: ${preferences.cookingTime}`);

    // Detect if user is asking for a recipe
    const isRecipeRequest = /suggest|recipe|cook|eat|meal|dinner|lunch|breakfast|make|food|hungry/i.test(message);
    const forceGenerate = body.forceGenerate === true;

    // Detect if user wants different/more recipes (sample different)
    const wantsDifferent = /different|other|more|another|else|alternatives|sample|show more|something else/i.test(message);
    const skipRecipeIds: string[] = body.skipRecipeIds || [];

    if (isRecipeRequest) {
      // First, check for matching saved recipes (unless user wants a new one)
      const savedResult = forceGenerate
        ? { recipes: [] }
        : await findMatchingSavedRecipes(actualFamilyId, message, dietaryRestrictions, preferences, skipRecipeIds);

      console.log(`[Chat] isRecipeRequest=${isRecipeRequest}, forceGenerate=${forceGenerate}, savedRecipes=${savedResult.recipes.length}`);

      if (savedResult.recipes.length > 0) {
        // Build response message
        let responseMessage = wantsDifferent
          ? `Here are ${savedResult.recipes.length} different recipe${savedResult.recipes.length > 1 ? 's' : ''} from your collection!`
          : `I found ${savedResult.recipes.length} recipe${savedResult.recipes.length > 1 ? 's' : ''} from your collection that might work!`;

        // Add substitution suggestions if any
        if (savedResult.substitutionSuggestions && savedResult.substitutionSuggestions.length > 0) {
          responseMessage += `\n\nNote: Some recipes may need modifications for your dietary preferences:\n• ${savedResult.substitutionSuggestions.slice(0, 3).join('\n• ')}`;
        }

        // Get all shown recipe IDs for "show more" functionality
        const shownRecipeIds = [...skipRecipeIds, ...savedResult.recipes.map(r => r.id)];

        // Return saved recipe suggestions
        return NextResponse.json({
          message: responseMessage,
          recipe: null,
          shoppingList: null,
          evaluation: null,
          savedRecipeOptions: savedResult.recipes.map(r => ({
            id: r.id,
            name: r.name,
            description: r.description,
            prepTime: r.prepTime,
            cookTime: r.cookTime,
            cuisine: r.cuisine,
            difficulty: r.difficulty,
            tags: r.tags
          })),
          shownRecipeIds // Include for "show more" functionality
        });
      }

      // No saved recipes match - generate new one

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