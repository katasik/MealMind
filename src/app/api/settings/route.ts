import { NextRequest, NextResponse } from 'next/server';
import { firebaseService } from '@/lib/firebase';
import type { DietaryRestriction, UserPreferences } from '@/types';

// GET - Get user and family settings
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const familyId = searchParams.get('familyId') || 'demo-family';
    const userId = searchParams.get('userId') || 'demo-user';

    const [family, user] = await Promise.all([
      firebaseService.getFamily(familyId),
      firebaseService.getUser(userId)
    ]);

    return NextResponse.json({
      family: family ? {
        id: family.id,
        name: family.name,
        dietaryRestrictions: family.dietaryRestrictions || []
      } : null,
      user: user ? {
        id: user.id,
        name: user.name,
        preferences: user.preferences || {
          favoriteIngredients: [],
          dislikedIngredients: [],
          cuisinePreferences: [],
          cookingTime: 'moderate'
        }
      } : null
    });

  } catch (error) {
    console.error('Get settings error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

// POST - Update settings
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      familyId = 'demo-family',
      userId = 'demo-user',
      dietaryRestrictions,
      preferences
    } = body;

    const updates: string[] = [];

    // Update dietary restrictions if provided
    if (dietaryRestrictions !== undefined) {
      await firebaseService.updateFamilyRestrictions(familyId, dietaryRestrictions as DietaryRestriction[]);
      updates.push('dietary restrictions');
    }

    // Update user preferences if provided
    if (preferences !== undefined) {
      await firebaseService.updateUserPreferences(userId, preferences as Partial<UserPreferences>);
      updates.push('preferences');
    }

    return NextResponse.json({
      success: true,
      message: `Updated: ${updates.join(', ')}`
    });

  } catch (error) {
    console.error('Update settings error:', error);
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}
