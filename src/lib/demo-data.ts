import type { Family, User, MealPlan, Recipe, MealPlanShoppingList } from '../types';

// Demo family ID - used for live demos and Telegram testing
export const DEMO_FAMILY_ID = 'demo-family';

// Demo family data
export const DEMO_FAMILY: Family = {
  id: DEMO_FAMILY_ID,
  name: 'Demo Family',
  members: ['demo-user-1', 'demo-user-2'],
  dietaryRestrictions: [],
  createdAt: new Date('2026-01-01')
};

// Demo user
export const DEMO_USER: User = {
  id: 'demo-user-1',
  name: 'Demo User',
  email: 'demo@mealmind.app',
  familyId: DEMO_FAMILY_ID,
  preferences: {
    favoriteIngredients: ['pasta', 'chicken', 'tomatoes'],
    dislikedIngredients: [],
    cuisinePreferences: ['Italian', 'Mediterranean'],
    cookingTime: 'moderate',
    targetLanguage: 'en'
  },
  createdAt: new Date('2026-01-01')
};

// Demo recipes
export const DEMO_RECIPES: Recipe[] = [
  {
    id: 'demo-recipe-1',
    name: 'Classic Pasta Carbonara',
    description: 'Traditional Italian pasta with eggs, cheese, and pancetta',
    ingredients: [
      { name: 'spaghetti', amount: '400', unit: 'g', category: 'Pantry' },
      { name: 'pancetta', amount: '200', unit: 'g', category: 'Meat' },
      { name: 'eggs', amount: '4', unit: 'whole', category: 'Dairy' },
      { name: 'parmesan cheese', amount: '100', unit: 'g', category: 'Dairy' },
      { name: 'black pepper', amount: '1', unit: 'tsp', category: 'Pantry' }
    ],
    instructions: [
      'Bring a large pot of salted water to boil and cook spaghetti according to package directions',
      'Cut pancetta into small cubes and cook in a large pan until crispy',
      'Beat eggs with grated parmesan and black pepper in a bowl',
      'Drain pasta, reserving 1 cup of pasta water',
      'Add hot pasta to the pancetta pan, remove from heat',
      'Pour egg mixture over pasta and toss quickly, adding pasta water to create a creamy sauce',
      'Serve immediately with extra parmesan'
    ],
    prepTime: 10,
    cookTime: 20,
    servings: 4,
    cuisine: 'Italian',
    difficulty: 'medium',
    tags: ['pasta', 'traditional', 'quick'],
    mealTypes: ['dinner'],
    familyId: DEMO_FAMILY_ID,
    createdAt: new Date('2026-01-15')
  },
  {
    id: 'demo-recipe-2',
    name: 'Mediterranean Chicken Bowl',
    description: 'Healthy bowl with grilled chicken, quinoa, and fresh vegetables',
    ingredients: [
      { name: 'chicken breast', amount: '500', unit: 'g', category: 'Meat' },
      { name: 'quinoa', amount: '200', unit: 'g', category: 'Pantry' },
      { name: 'cherry tomatoes', amount: '200', unit: 'g', category: 'Produce' },
      { name: 'cucumber', amount: '1', unit: 'whole', category: 'Produce' },
      { name: 'feta cheese', amount: '100', unit: 'g', category: 'Dairy' },
      { name: 'olive oil', amount: '3', unit: 'tbsp', category: 'Pantry' },
      { name: 'lemon', amount: '1', unit: 'whole', category: 'Produce' },
      { name: 'mixed greens', amount: '100', unit: 'g', category: 'Produce' }
    ],
    instructions: [
      'Cook quinoa according to package instructions and let cool',
      'Season chicken breast with salt, pepper, and olive oil',
      'Grill chicken for 6-7 minutes per side until cooked through',
      'Slice cherry tomatoes and cucumber',
      'Assemble bowls with quinoa, mixed greens, vegetables, and sliced chicken',
      'Top with crumbled feta and dress with olive oil and lemon juice',
      'Season with salt and pepper to taste'
    ],
    prepTime: 15,
    cookTime: 20,
    servings: 4,
    cuisine: 'Mediterranean',
    difficulty: 'easy',
    tags: ['healthy', 'protein', 'gluten-free'],
    mealTypes: ['lunch', 'dinner'],
    familyId: DEMO_FAMILY_ID,
    createdAt: new Date('2026-01-16')
  },
  {
    id: 'demo-recipe-3',
    name: 'Greek Yogurt Parfait',
    description: 'Layered breakfast with yogurt, granola, and fresh berries',
    ingredients: [
      { name: 'Greek yogurt', amount: '500', unit: 'g', category: 'Dairy' },
      { name: 'granola', amount: '150', unit: 'g', category: 'Pantry' },
      { name: 'mixed berries', amount: '300', unit: 'g', category: 'Produce' },
      { name: 'honey', amount: '4', unit: 'tbsp', category: 'Pantry' },
      { name: 'almonds', amount: '50', unit: 'g', category: 'Pantry' }
    ],
    instructions: [
      'Rinse berries and pat dry',
      'Chop almonds roughly',
      'Layer yogurt, granola, and berries in glasses or bowls',
      'Drizzle with honey',
      'Top with chopped almonds',
      'Serve immediately or refrigerate for up to 2 hours'
    ],
    prepTime: 10,
    cookTime: 0,
    servings: 4,
    cuisine: 'Mediterranean',
    difficulty: 'easy',
    tags: ['breakfast', 'healthy', 'no-cook', 'vegetarian'],
    mealTypes: ['breakfast'],
    familyId: DEMO_FAMILY_ID,
    createdAt: new Date('2026-01-17')
  }
];

// Helper to get current week's start date
function getCurrentWeekStartDate(): string {
  const today = new Date();
  const day = today.getDay();
  const diff = today.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(today.setDate(diff));
  return monday.toISOString().split('T')[0];
}

// Helper to get dates for the week
function getWeekDates(startDate: string) {
  const dates = [];
  const start = new Date(startDate);

  for (let i = 0; i < 7; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    dates.push(date.toISOString().split('T')[0]);
  }

  return dates;
}

// Generate demo meal plan for current week
export function generateDemoMealPlan(): MealPlan {
  const weekStartDate = getCurrentWeekStartDate();
  const dates = getWeekDates(weekStartDate);
  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  return {
    id: `demo-mealplan-${weekStartDate}`,
    familyId: DEMO_FAMILY_ID,
    weekStartDate,
    days: dates.map((date, index) => ({
      date,
      dayOfWeek: (index + 1) % 7,
      dayName: dayNames[index],
      meals: index < 5 ? [ // Only weekdays have full meals
        {
          mealType: 'breakfast',
          recipeId: DEMO_RECIPES[2].id,
          recipeName: DEMO_RECIPES[2].name,
          recipeDescription: DEMO_RECIPES[2].description,
          prepTime: DEMO_RECIPES[2].prepTime,
          cookTime: DEMO_RECIPES[2].cookTime,
          servings: DEMO_RECIPES[2].servings,
          ingredients: DEMO_RECIPES[2].ingredients,
          instructions: DEMO_RECIPES[2].instructions,
          cuisine: DEMO_RECIPES[2].cuisine,
          difficulty: DEMO_RECIPES[2].difficulty
        },
        {
          mealType: 'lunch',
          recipeId: DEMO_RECIPES[1].id,
          recipeName: DEMO_RECIPES[1].name,
          recipeDescription: DEMO_RECIPES[1].description,
          prepTime: DEMO_RECIPES[1].prepTime,
          cookTime: DEMO_RECIPES[1].cookTime,
          servings: DEMO_RECIPES[1].servings,
          ingredients: DEMO_RECIPES[1].ingredients,
          instructions: DEMO_RECIPES[1].instructions,
          cuisine: DEMO_RECIPES[1].cuisine,
          difficulty: DEMO_RECIPES[1].difficulty
        },
        {
          mealType: 'dinner',
          recipeId: DEMO_RECIPES[0].id,
          recipeName: DEMO_RECIPES[0].name,
          recipeDescription: DEMO_RECIPES[0].description,
          prepTime: DEMO_RECIPES[0].prepTime,
          cookTime: DEMO_RECIPES[0].cookTime,
          servings: DEMO_RECIPES[0].servings,
          ingredients: DEMO_RECIPES[0].ingredients,
          instructions: DEMO_RECIPES[0].instructions,
          cuisine: DEMO_RECIPES[0].cuisine,
          difficulty: DEMO_RECIPES[0].difficulty
        }
      ] : [] // Weekend days empty for demo
    })),
    status: 'approved',
    createdAt: new Date(),
    updatedAt: new Date(),
    createdByUserId: DEMO_USER.id,
    createdByUserName: DEMO_USER.name
  };
}

// Generate demo shopping list
export function generateDemoShoppingList(mealPlan: MealPlan): MealPlanShoppingList {
  return {
    id: `demo-shopping-${mealPlan.weekStartDate}`,
    mealPlanId: mealPlan.id,
    familyId: DEMO_FAMILY_ID,
    weekStartDate: mealPlan.weekStartDate,
    items: [
      {
        id: 'item-1',
        ingredientName: 'spaghetti',
        amount: '400',
        unit: 'g',
        category: 'Pantry',
        recipeNames: ['Classic Pasta Carbonara'],
        checked: false
      },
      {
        id: 'item-2',
        ingredientName: 'pancetta',
        amount: '200',
        unit: 'g',
        category: 'Meat',
        recipeNames: ['Classic Pasta Carbonara'],
        checked: false
      },
      {
        id: 'item-3',
        ingredientName: 'eggs',
        amount: '4',
        unit: 'whole',
        category: 'Dairy',
        recipeNames: ['Classic Pasta Carbonara'],
        checked: false
      },
      {
        id: 'item-4',
        ingredientName: 'parmesan cheese',
        amount: '100',
        unit: 'g',
        category: 'Dairy',
        recipeNames: ['Classic Pasta Carbonara'],
        checked: false
      },
      {
        id: 'item-5',
        ingredientName: 'chicken breast',
        amount: '500',
        unit: 'g',
        category: 'Meat',
        recipeNames: ['Mediterranean Chicken Bowl'],
        checked: false
      },
      {
        id: 'item-6',
        ingredientName: 'quinoa',
        amount: '200',
        unit: 'g',
        category: 'Pantry',
        recipeNames: ['Mediterranean Chicken Bowl'],
        checked: false
      },
      {
        id: 'item-7',
        ingredientName: 'cherry tomatoes',
        amount: '200',
        unit: 'g',
        category: 'Produce',
        recipeNames: ['Mediterranean Chicken Bowl'],
        checked: false
      },
      {
        id: 'item-8',
        ingredientName: 'Greek yogurt',
        amount: '500',
        unit: 'g',
        category: 'Dairy',
        recipeNames: ['Greek Yogurt Parfait'],
        checked: false
      },
      {
        id: 'item-9',
        ingredientName: 'granola',
        amount: '150',
        unit: 'g',
        category: 'Pantry',
        recipeNames: ['Greek Yogurt Parfait'],
        checked: false
      },
      {
        id: 'item-10',
        ingredientName: 'mixed berries',
        amount: '300',
        unit: 'g',
        category: 'Produce',
        recipeNames: ['Greek Yogurt Parfait'],
        checked: false
      }
    ],
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date()
  };
}
