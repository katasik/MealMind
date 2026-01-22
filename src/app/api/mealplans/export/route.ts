import { NextRequest, NextResponse } from 'next/server';
import { firebaseService } from '@/lib/firebase';
import type { MealPlan, PlannedMeal } from '@/types';

// Helper: Format date for ICS (YYYYMMDD)
function formatICSDate(dateStr: string): string {
  return dateStr.replace(/-/g, '');
}

// Helper: Get meal time based on type
function getMealTime(mealType: string): { start: string; end: string } {
  const times: Record<string, { start: string; end: string }> = {
    breakfast: { start: '080000', end: '090000' },
    lunch: { start: '120000', end: '130000' },
    dinner: { start: '180000', end: '193000' },
    snack: { start: '150000', end: '153000' }
  };
  return times[mealType] || times.lunch;
}

// Helper: Get meal emoji
function getMealEmoji(mealType: string): string {
  const emojis: Record<string, string> = {
    breakfast: '🌅',
    lunch: '☀️',
    dinner: '🌙',
    snack: '🍎'
  };
  return emojis[mealType] || '🍽️';
}

// Helper: Escape special characters for ICS
function escapeICS(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

// Helper: Format meal description with full recipe details
function formatMealDescription(meal: PlannedMeal): string {
  const lines: string[] = [];

  // Timing info
  lines.push(`Prep: ${meal.prepTime} min | Cook: ${meal.cookTime} min | Servings: ${meal.servings}`);
  if (meal.cuisine) {
    lines.push(`Cuisine: ${meal.cuisine}`);
  }
  if (meal.difficulty) {
    lines.push(`Difficulty: ${meal.difficulty}`);
  }

  lines.push('');

  // Description
  if (meal.recipeDescription) {
    lines.push(meal.recipeDescription);
    lines.push('');
  }

  // Ingredients
  lines.push('📝 INGREDIENTS:');
  for (const ing of meal.ingredients || []) {
    const amount = ing.amount ? `${ing.amount} ` : '';
    const unit = ing.unit ? `${ing.unit} ` : '';
    lines.push(`• ${amount}${unit}${ing.name}`);
  }

  lines.push('');

  // Instructions
  lines.push('👨‍🍳 INSTRUCTIONS:');
  (meal.instructions || []).forEach((step, index) => {
    lines.push(`${index + 1}. ${step}`);
  });

  return escapeICS(lines.join('\n'));
}

// Helper: Generate ICS content from meal plan
function generateICS(mealPlan: MealPlan): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MealMind//Meal Planner//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:MealMind - Week of ${mealPlan.weekStartDate}`,
    'X-WR-TIMEZONE:UTC'
  ];

  for (const day of mealPlan.days) {
    for (const meal of day.meals) {
      if (meal.recipeName) {
        const time = getMealTime(meal.mealType);
        const emoji = getMealEmoji(meal.mealType);
        const mealLabel = meal.mealType.charAt(0).toUpperCase() + meal.mealType.slice(1);
        const uid = `meal-${day.date}-${meal.mealType}-${meal.recipeId}@mealmind`;

        // Calculate timestamp for DTSTAMP
        const now = new Date();
        const dtstamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

        lines.push('BEGIN:VEVENT');
        lines.push(`UID:${uid}`);
        lines.push(`DTSTAMP:${dtstamp}`);
        lines.push(`DTSTART:${formatICSDate(day.date)}T${time.start}`);
        lines.push(`DTEND:${formatICSDate(day.date)}T${time.end}`);
        lines.push(`SUMMARY:${emoji} ${mealLabel}: ${escapeICS(meal.recipeName)}`);
        lines.push(`DESCRIPTION:${formatMealDescription(meal)}`);
        lines.push(`CATEGORIES:${mealLabel},MealMind,Cooking`);
        lines.push('STATUS:CONFIRMED');
        lines.push('END:VEVENT');
      }
    }
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

// GET - Export meal plan as ICS file
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const mealPlanId = searchParams.get('mealPlanId');
    const familyId = searchParams.get('familyId') || 'demo-family';
    const weekStartDate = searchParams.get('weekStartDate');

    let mealPlan: MealPlan | null = null;

    if (mealPlanId) {
      mealPlan = await firebaseService.getMealPlanById(mealPlanId);
    } else if (weekStartDate) {
      mealPlan = await firebaseService.getMealPlan(familyId, weekStartDate);
    }

    if (!mealPlan) {
      return NextResponse.json(
        { error: 'Meal plan not found' },
        { status: 404 }
      );
    }

    // Check if plan is finalized (optional - you can remove this check if you want to allow export at any stage)
    // if (mealPlan.status !== 'finalized') {
    //   return NextResponse.json(
    //     { error: 'Meal plan must be finalized before export' },
    //     { status: 400 }
    //   );
    // }

    const icsContent = generateICS(mealPlan);
    const filename = `mealmind-week-${mealPlan.weekStartDate}.ics`;

    return new NextResponse(icsContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache'
      }
    });
  } catch (error) {
    console.error('Export meal plan error:', error);
    return NextResponse.json(
      { error: 'Failed to export meal plan' },
      { status: 500 }
    );
  }
}
