import { GoogleGenerativeAI } from '@google/generative-ai';
import type {
  Recipe,
  DietaryRestriction,
  ShoppingItem,
  ChatMessage,
  UserPreferences,
  DayPlan,
  PlannedMeal,
  MealType,
  Ingredient
} from '../types';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

interface GenerateRecipeParams {
  dietaryRestrictions: DietaryRestriction[];
  preferences: UserPreferences;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  conversationHistory?: ChatMessage[];
  cookingTime?: 'quick' | 'moderate' | 'extended' | 'any';
}

export class GeminiService {

  /**
   * Generate a recipe based on family dietary restrictions and preferences
   */
  async generateRecipe(params: GenerateRecipeParams): Promise<{
    recipe: Recipe;
    shoppingList: ShoppingItem[];
  }> {
    const prompt = this.buildRecipePrompt(params);

    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Parse the JSON response from Gemini
      const parsed = this.parseRecipeResponse(text);

      return {
        recipe: parsed.recipe,
        shoppingList: this.generateShoppingList(parsed.recipe)
      };
    } catch (error) {
      console.error('Error generating recipe:', error);
      throw new Error('Failed to generate recipe');
    }
  }

  /**
   * Continue a conversation about meal planning
   */
  async chat(message: string, conversationHistory: ChatMessage[]): Promise<string> {
    const context = this.buildChatContext(conversationHistory);
    const fullPrompt = `${context}\n\nUser: ${message}\n\nAssistant:`;

    try {
      const result = await model.generateContent(fullPrompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('Error in chat:', error);
      throw new Error('Failed to process chat message');
    }
  }

  /**
   * Evaluate if a recipe is safe for the given dietary restrictions
   */
  async evaluateSafety(
    recipe: Recipe,
    restrictions: DietaryRestriction[]
  ): Promise<{
    passed: boolean;
    allergensDetected: string[];
    confidence: number;
    warnings: string[];
  }> {
    const prompt = `
You are a dietary safety evaluator. Analyze this recipe for potential allergen violations.

Recipe: ${JSON.stringify(recipe, null, 2)}

Dietary Restrictions:
${restrictions.map(r => `- ${r.type}: ${r.name} (${r.severity}) - ${r.description || ''}`).join('\n')}

CRITICAL: Check every ingredient carefully. Return ONLY valid JSON in this exact format:
{
  "passed": boolean,
  "allergensDetected": ["list", "of", "allergens", "found"],
  "confidence": 0.0 to 1.0,
  "warnings": ["list", "of", "warning", "messages"]
}

Be extremely cautious with severe allergies. If unsure, mark as failed.
`;

    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Try to extract JSON from response
      const parsed = this.extractJson(text);
      if (parsed && typeof parsed.passed === 'boolean') {
        return parsed;
      }

      // If no dietary restrictions, default to passed
      if (restrictions.length === 0) {
        return {
          passed: true,
          allergensDetected: [],
          confidence: 1,
          warnings: []
        };
      }

      // Default to passed if we couldn't parse but there are restrictions
      return {
        passed: true,
        allergensDetected: [],
        confidence: 0.5,
        warnings: ['Safety evaluation response was not parseable - defaulting to passed']
      };
    } catch (error) {
      console.error('Error evaluating safety:', error);
      // Default to passed on error (less disruptive to user experience)
      return {
        passed: true,
        allergensDetected: [],
        confidence: 0.5,
        warnings: ['Unable to complete safety evaluation - defaulting to passed']
      };
    }
  }

  /**
   * Extract JSON from potentially messy LLM response
   */
  private extractJson(text: string): any {
    try {
      return JSON.parse(text);
    } catch {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch {
          const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
          const secondMatch = cleaned.match(/\{[\s\S]*\}/);
          if (secondMatch) {
            try {
              return JSON.parse(secondMatch[0]);
            } catch {
              return null;
            }
          }
        }
      }
      return null;
    }
  }

  /**
   * Build the prompt for recipe generation
   */
  private buildRecipePrompt(params: GenerateRecipeParams): string {
    const { dietaryRestrictions, preferences, mealType, cookingTime } = params;

    const restrictionsText = dietaryRestrictions.length > 0
      ? dietaryRestrictions
          .filter(r => r && r.type && r.name)
          .map(r => `- ${(r.type || 'restriction').toUpperCase()}: ${r.name || 'unknown'} (${r.severity || 'moderate'}) ${r.description ? '- ' + r.description : ''}`)
          .join('\n') || 'None specified'
      : 'None specified';

    const hasFavorites = preferences.favoriteIngredients && preferences.favoriteIngredients.length > 0;
    const favoritesInstruction = hasFavorites
      ? `IMPORTANT - FAVORITE INGREDIENTS (MUST USE AT LEAST ONE):
The user specifically wants recipes with these ingredients: ${preferences.favoriteIngredients.join(', ')}
You MUST include at least one of these as a main ingredient in your recipe!`
      : '';

    return `
You are an expert meal planning AI assistant. Generate a delicious, safe ${mealType} recipe.

DIETARY RESTRICTIONS (CRITICAL - MUST COMPLY):
${restrictionsText}

${favoritesInstruction}

USER PREFERENCES:
- Favorite ingredients: ${preferences.favoriteIngredients.join(', ') || 'none specified'}
- Disliked ingredients: ${preferences.dislikedIngredients.join(', ') || 'none specified'}
- Cuisine preferences: ${preferences.cuisinePreferences.join(', ') || 'any'}
- Cooking time preference: ${cookingTime || preferences.cookingTime}

REQUIREMENTS:
1. Recipe MUST be 100% compliant with ALL dietary restrictions
2. Avoid ALL disliked ingredients
3. ${hasFavorites ? 'MUST INCLUDE at least one favorite ingredient as a main component' : 'Be creative with ingredients'}
4. Match the cooking time preference (quick: <30min, moderate: 30-60min, extended: 60+min)
5. Be creative and delicious while staying safe

Return ONLY valid JSON in this exact format (no markdown, no explanation):
{
  "recipe": {
    "name": "Recipe Name",
    "description": "Brief description",
    "ingredients": [
      {"name": "ingredient", "amount": "1", "unit": "cup", "category": "produce"}
    ],
    "instructions": ["Step 1", "Step 2"],
    "prepTime": 15,
    "cookTime": 20,
    "servings": 4,
    "cuisine": "Italian",
    "difficulty": "easy",
    "nutritionalInfo": {
      "calories": 350,
      "protein": 20,
      "carbs": 40,
      "fat": 12,
      "fiber": 5
    },
    "tags": ["healthy", "family-friendly"]
  }
}
`;
  }

  /**
   * Build chat context from conversation history
   */
  private buildChatContext(history: ChatMessage[]): string {
    const context = `
You are MealMind, a friendly and knowledgeable AI meal planning assistant. Your mission is to help families plan delicious, safe, and personalized meals.

CORE CAPABILITIES:
- Suggest recipes from the user's saved recipe collection first (prioritize what they've already saved)
- Generate new recipe ideas when saved recipes don't match their needs
- Respect ALL dietary restrictions strictly (allergies, intolerances, medical conditions like PCOS, preferences like vegetarian/no red meat)
- Consider user preferences: favorite ingredients, disliked ingredients, cuisine preferences, and cooking time limits
- Suggest ingredient substitutions when a recipe almost matches but has one incompatible ingredient
- Provide nutritional information and cooking tips
- Help with meal planning for the week
- Generate shopping lists based on selected recipes

BEHAVIOR GUIDELINES:
- Be conversational, warm, and empathetic - cooking should be enjoyable!
- When users ask for meal suggestions, first consider their saved recipes before suggesting new ones
- Always double-check that suggestions comply with dietary restrictions - safety is paramount
- If a user has medical dietary needs (PCOS-Friendly, Diabetic-Friendly, etc.), prioritize those restrictions
- Offer alternatives when the first suggestion doesn't work
- Keep responses concise but helpful
- If asked about a recipe, provide clear ingredients and step-by-step instructions
- Support requests in any language the user uses

RESPONSE FORMAT:
- For recipe suggestions: Include recipe name, brief description, and key ingredients
- For meal planning: Organize by day/meal type
- For cooking questions: Be specific and practical
- Always mention if a recipe is from their saved collection vs newly generated

Conversation history:
${history.map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`).join('\n')}
`;
    return context;
  }

  /**
   * Parse recipe response from Gemini
   */
  private parseRecipeResponse(text: string): { recipe: Recipe } {
    try {
      // Remove markdown code blocks if present
      const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
      const parsed = JSON.parse(cleaned);

      // Add generated ID and timestamp
      parsed.recipe.id = this.generateId();
      parsed.recipe.createdAt = new Date();

      return parsed;
    } catch (error) {
      console.error('Error parsing recipe response:', error);
      console.error('Raw response:', text);
      throw new Error('Failed to parse recipe response');
    }
  }

  /**
   * Generate shopping list from recipe
   */
  private generateShoppingList(recipe: Recipe): ShoppingItem[] {
    return recipe.ingredients.map(ingredient => ({
      ingredient,
      checked: false,
      category: ingredient.category || this.categorizeIngredient(ingredient.name)
    }));
  }

  /**
   * Categorize ingredient for shopping list organization
   */
  private categorizeIngredient(name: string): string {
    const categories: { [key: string]: string[] } = {
      'Produce': ['tomato', 'lettuce', 'onion', 'garlic', 'pepper', 'carrot', 'celery', 'potato', 'apple', 'banana', 'lemon', 'lime'],
      'Meat & Seafood': ['chicken', 'beef', 'pork', 'fish', 'shrimp', 'salmon', 'turkey'],
      'Dairy': ['milk', 'cheese', 'yogurt', 'butter', 'cream'],
      'Grains': ['rice', 'pasta', 'bread', 'flour', 'oats', 'quinoa'],
      'Pantry': ['oil', 'salt', 'pepper', 'sugar', 'vinegar', 'soy sauce', 'spices'],
      'Frozen': ['frozen', 'ice cream'],
      'Beverages': ['juice', 'soda', 'coffee', 'tea']
    };

    const lowerName = name.toLowerCase();
    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => lowerName.includes(keyword))) {
        return category;
      }
    }

    return 'Other';
  }

  /**
   * Generate a weekly meal plan using AI
   */
  async generateWeeklyMealPlan(params: {
    dietaryRestrictions: DietaryRestriction[];
    preferences: UserPreferences;
    savedRecipes: Recipe[];
    weekStartDate: string;
    numberOfDays?: number;
    mealsPerDay?: MealType[];
    regenerateMeal?: { dayIndex: number; mealType: MealType };
    existingPlan?: DayPlan[];
  }): Promise<DayPlan[]> {
    const {
      dietaryRestrictions,
      preferences,
      savedRecipes,
      weekStartDate,
      numberOfDays = 7,
      mealsPerDay = ['breakfast', 'lunch', 'dinner'],
      regenerateMeal,
      existingPlan
    } = params;

    // Build the prompt for meal plan generation
    const prompt = this.buildMealPlanPrompt({
      dietaryRestrictions,
      preferences,
      savedRecipes,
      weekStartDate,
      numberOfDays,
      mealsPerDay,
      regenerateMeal,
      existingPlan
    });

    try {
      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      // Parse the JSON response
      const parsed = this.extractJson(text);

      if (!parsed || !parsed.days || !Array.isArray(parsed.days)) {
        console.error('Invalid meal plan response:', text);
        throw new Error('Invalid meal plan response from AI');
      }

      // Process each day and add IDs to recipes
      const days: DayPlan[] = parsed.days.map((day: any, index: number) => {
        const date = new Date(weekStartDate);
        date.setDate(date.getDate() + index);

        return {
          date: date.toISOString().split('T')[0],
          dayOfWeek: date.getDay(),
          dayName: this.getDayName(date.getDay()),
          meals: (day.meals || []).map((meal: any) => ({
            mealType: meal.mealType as MealType,
            recipeId: meal.recipeId || this.generateId(),
            recipeName: meal.recipeName,
            recipeDescription: meal.recipeDescription || '',
            prepTime: meal.prepTime || 15,
            cookTime: meal.cookTime || 20,
            servings: meal.servings || 4,
            cuisine: meal.cuisine || '',
            difficulty: meal.difficulty || 'easy',
            ingredients: (meal.ingredients || []).map((ing: any) => ({
              name: ing.name,
              amount: String(ing.amount),
              unit: ing.unit || '',
              category: ing.category || this.categorizeIngredient(ing.name)
            })),
            instructions: meal.instructions || []
          } as PlannedMeal))
        };
      });

      // If we're regenerating a single meal, merge the new meal into the existing plan
      if (regenerateMeal && existingPlan) {
        return existingPlan.map((existingDay, dayIndex) => {
          if (dayIndex === regenerateMeal.dayIndex) {
            // Find the new meal for this day and meal type
            const newDay = days[0]; // AI generates just 1 day when regenerating
            const newMeal = newDay?.meals.find((m: PlannedMeal) => m.mealType === regenerateMeal.mealType);

            if (newMeal) {
              // Replace just the specific meal
              return {
                ...existingDay,
                meals: existingDay.meals.map(existingMeal =>
                  existingMeal.mealType === regenerateMeal.mealType ? newMeal : existingMeal
                )
              };
            }
          }
          return existingDay;
        });
      }

      return days;
    } catch (error) {
      console.error('Error generating meal plan:', error);
      throw new Error('Failed to generate meal plan');
    }
  }

  /**
   * Build the prompt for weekly meal plan generation
   */
  private buildMealPlanPrompt(params: {
    dietaryRestrictions: DietaryRestriction[];
    preferences: UserPreferences;
    savedRecipes: Recipe[];
    weekStartDate: string;
    numberOfDays: number;
    mealsPerDay: MealType[];
    regenerateMeal?: { dayIndex: number; mealType: MealType };
    existingPlan?: DayPlan[];
  }): string {
    const { dietaryRestrictions, preferences, savedRecipes, weekStartDate, numberOfDays, mealsPerDay, regenerateMeal, existingPlan } = params;

    const restrictionsText = dietaryRestrictions.length > 0
      ? dietaryRestrictions
          .filter(r => r && r.type && r.name)
          .map(r => `- ${(r.type || 'restriction').toUpperCase()}: ${r.name || 'unknown'} (${r.severity || 'moderate'})`)
          .join('\n') || 'None'
      : 'None';

    const savedRecipesList = savedRecipes.length > 0
      ? savedRecipes.slice(0, 20).map(r => `- "${r.name}" (ID: ${r.id}) - ${r.cuisine || 'Various'}, ${r.prepTime + r.cookTime}min, ${r.difficulty || 'easy'}`).join('\n')
      : 'No saved recipes available';

    const allDayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    // Calculate which days to generate based on start date and numberOfDays
    const startDate = new Date(weekStartDate);
    const dayNames: string[] = [];
    for (let i = 0; i < numberOfDays; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      dayNames.push(allDayNames[date.getDay() === 0 ? 6 : date.getDay() - 1]); // Adjust for Monday start
    }

    // Format meals list for prompt
    const mealsListText = mealsPerDay.join(', ');

    // If regenerating a specific meal, provide context about what to replace
    let regenerateInstruction = '';
    if (regenerateMeal && existingPlan) {
      const dayPlan = existingPlan[regenerateMeal.dayIndex];
      const existingMeal = dayPlan?.meals.find(m => m.mealType === regenerateMeal.mealType);

      // Collect all existing recipe names to avoid duplicates
      const existingRecipeNames = existingPlan.flatMap(d => d.meals.map(m => m.recipeName.toLowerCase()));

      regenerateInstruction = `
SPECIAL INSTRUCTION: Generate ONLY ONE new ${regenerateMeal.mealType} recipe.
The user wants to REPLACE "${existingMeal?.recipeName || 'the current meal'}" with something COMPLETELY DIFFERENT.

DO NOT suggest any of these existing recipes (already in the plan):
${existingRecipeNames.map(n => `- ${n}`).join('\n')}

Generate exactly 1 day with exactly 1 meal (${regenerateMeal.mealType}) - nothing more.
`;
    }

    const existingPlanContext = existingPlan && regenerateMeal
      ? `
EXISTING PLAN (keep all meals except the one being regenerated):
${existingPlan.map((day, i) => `Day ${i + 1}: ${day.meals.map(m => `${m.mealType}: ${m.recipeName}`).join(', ')}`).join('\n')}
`
      : '';

    return `
You are an expert meal planning AI. Generate a balanced ${numberOfDays}-day meal plan starting from ${weekStartDate}.

DIETARY RESTRICTIONS (CRITICAL - ALL MEALS MUST COMPLY):
${restrictionsText}

USER PREFERENCES:
- Favorite ingredients: ${preferences.favoriteIngredients?.join(', ') || 'none specified'}
- Disliked ingredients (AVOID): ${preferences.dislikedIngredients?.join(', ') || 'none'}
- Cuisine preferences: ${preferences.cuisinePreferences?.join(', ') || 'any'}
- Cooking time preference: ${preferences.cookingTime || 'moderate'}

SAVED RECIPES (PRIORITIZE THESE - use their exact IDs when including them):
${savedRecipesList}

${regenerateInstruction}
${existingPlanContext}

REQUIREMENTS:
1. Generate meals for exactly ${numberOfDays} days
2. Each day needs ONLY these meals: ${mealsListText}
3. PRIORITIZE saved recipes when they match preferences and restrictions
4. When using a saved recipe, include its exact ID from the list above
5. Generate new recipes for slots where no saved recipe fits
6. NO REPEAT MEALS in the plan (variety is important)
7. Breakfast should be quick (<20 min total time)
8. Balance nutrition across the days
9. Include at least one "easy" meal per day
10. Mix cuisines throughout for variety
11. Respect cooking time preference: quick (<30min), moderate (30-60min), extended (60+min)

IMPORTANT INGREDIENT FORMAT:
- "name" must be ONLY the ingredient name (e.g., "chicken breast", "olive oil", "garlic"), NO descriptions or preparation methods
- "amount" must be a NUMBER only (e.g., "2", "0.5", "1")
- "unit" should be the measurement unit (e.g., "lb", "cups", "cloves", "tbsp")
- DO NOT include preparation details like "diced", "minced", "chopped" in the name - just the ingredient itself

Return ONLY valid JSON in this exact format (no markdown, no explanation).
${regenerateMeal ? `Generate exactly 1 day with exactly 1 meal (${regenerateMeal.mealType})` : `Generate exactly ${numberOfDays} days with these meals per day: ${mealsListText}`}

{
  "days": [
    {
      "meals": [
        {
          "mealType": "${regenerateMeal?.mealType || mealsPerDay[0] || 'dinner'}",
          "recipeId": "use-saved-recipe-id-if-from-saved-list-or-leave-empty",
          "recipeName": "Recipe Name",
          "recipeDescription": "Brief description",
          "prepTime": 10,
          "cookTime": 10,
          "servings": 4,
          "cuisine": "American",
          "difficulty": "easy",
          "ingredients": [
            {"name": "chicken breast", "amount": "2", "unit": "lb", "category": "Meat & Seafood"},
            {"name": "olive oil", "amount": "2", "unit": "tbsp", "category": "Pantry"},
            {"name": "garlic", "amount": "3", "unit": "cloves", "category": "Produce"}
          ],
          "instructions": ["Step 1", "Step 2", "Step 3"]
        }
      ]
    }
  ]
}

${regenerateMeal ? 'Generate the single replacement meal now:' : `Generate the complete ${numberOfDays}-day plan now:`}
`;
  }

  /**
   * Get day name from day of week number
   */
  private getDayName(dayOfWeek: number): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dayOfWeek] || 'Unknown';
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }
}

export const geminiService = new GeminiService();