import { NextRequest, NextResponse } from 'next/server';
import { firebaseService } from '@/lib/firebase';

// GET - List all recipes for a family
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const familyId = searchParams.get('familyId') || 'demo-family';

    const recipes = await firebaseService.getWebRecipes(familyId);

    return NextResponse.json({
      recipes,
      count: recipes.length
    });

  } catch (error) {
    console.error('Get recipes error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recipes' },
      { status: 500 }
    );
  }
}

// POST - Save a new recipe
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { recipe, familyId = 'demo-family', userId = 'demo-user', userName = 'Demo User' } = body;

    if (!recipe || !recipe.name || !recipe.ingredients) {
      return NextResponse.json(
        { error: 'Invalid recipe data' },
        { status: 400 }
      );
    }

    // Ensure required fields have defaults and remove undefined values
    const recipeToSave = {
      name: recipe.name,
      description: recipe.description || '',
      ingredients: recipe.ingredients || [],
      instructions: recipe.instructions || [],
      prepTime: recipe.prepTime || 0,
      cookTime: recipe.cookTime || 0,
      servings: recipe.servings || 4,
      cuisine: recipe.cuisine || 'Various',
      difficulty: recipe.difficulty || 'medium',
      tags: recipe.tags || [],
      // Only include nutritionalInfo if it's defined (Firebase rejects undefined)
      ...(recipe.nutritionalInfo ? { nutritionalInfo: recipe.nutritionalInfo } : {})
    };

    const recipeId = await firebaseService.saveWebRecipe(
      familyId,
      recipeToSave,
      { userId, userName }
    );

    return NextResponse.json({
      success: true,
      recipeId,
      message: `Recipe "${recipe.name}" saved successfully`
    });

  } catch (error) {
    console.error('Save recipe error:', error);
    return NextResponse.json(
      { error: 'Failed to save recipe' },
      { status: 500 }
    );
  }
}

// DELETE - Remove a recipe
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const recipeId = searchParams.get('recipeId');
    const userId = searchParams.get('userId') || 'demo-user';

    if (!recipeId) {
      return NextResponse.json(
        { error: 'Recipe ID is required' },
        { status: 400 }
      );
    }

    const deleted = await firebaseService.deleteWebRecipe(recipeId, userId);

    if (!deleted) {
      return NextResponse.json(
        { error: 'Recipe not found or you do not have permission to delete it' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Recipe deleted successfully'
    });

  } catch (error) {
    console.error('Delete recipe error:', error);
    return NextResponse.json(
      { error: 'Failed to delete recipe' },
      { status: 500 }
    );
  }
}
