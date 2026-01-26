import { NextRequest, NextResponse } from 'next/server';
import { firebaseService } from '../../../lib/firebase';
import type { MealPlan, MealPlanStatus } from '../../../types';

// Helper to get Monday of the current week
function getWeekStartDate(date: Date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

// GET - Get meal plan for a specific week
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const familyId = searchParams.get('familyId') || 'demo-family';
    const weekStartDate = searchParams.get('weekStartDate') || getWeekStartDate();

    const mealPlan = await firebaseService.getMealPlan(familyId, weekStartDate);

    return NextResponse.json({
      success: true,
      mealPlan // May be null if no plan exists for this week
    });
  } catch (error) {
    console.error('Get meal plan error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch meal plan' },
      { status: 500 }
    );
  }
}

// PUT - Update meal plan status or individual meal
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { planId, status, updateMeal } = body;

    if (!planId) {
      return NextResponse.json(
        { error: 'planId is required' },
        { status: 400 }
      );
    }

    // Get the plan first to validate it exists
    const existingPlan = await firebaseService.getMealPlanById(planId);
    if (!existingPlan) {
      return NextResponse.json(
        { error: 'Meal plan not found' },
        { status: 404 }
      );
    }

    // Handle individual meal update
    if (updateMeal) {
      const { dayIndex, mealType, meal } = updateMeal;

      if (dayIndex === undefined || !mealType || !meal) {
        return NextResponse.json(
          { error: 'updateMeal requires dayIndex, mealType, and meal' },
          { status: 400 }
        );
      }

      // Update the specific meal in the plan
      const updatedDays = existingPlan.days.map((day, idx) => {
        if (idx === dayIndex) {
          return {
            ...day,
            meals: day.meals.map(m =>
              m.mealType === mealType ? meal : m
            )
          };
        }
        return day;
      });

      const updatedPlan: MealPlan = {
        ...existingPlan,
        days: updatedDays,
        updatedAt: new Date()
      };

      await firebaseService.saveMealPlan(updatedPlan);

      return NextResponse.json({
        success: true,
        mealPlan: updatedPlan,
        message: 'Meal updated successfully'
      });
    }

    // Handle status update
    if (status) {
      const validStatuses: MealPlanStatus[] = ['draft', 'approved', 'finalized'];
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { error: 'Invalid status. Must be: draft, approved, or finalized' },
          { status: 400 }
        );
      }

      await firebaseService.updateMealPlanStatus(planId, status);
      const updatedPlan = await firebaseService.getMealPlanById(planId);

      return NextResponse.json({
        success: true,
        mealPlan: updatedPlan,
        message: `Meal plan ${status === 'approved' ? 'approved' : status === 'finalized' ? 'finalized' : 'updated'} successfully`
      });
    }

    return NextResponse.json(
      { error: 'Either status or updateMeal is required' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Update meal plan error:', error);
    return NextResponse.json(
      { error: 'Failed to update meal plan' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a meal plan
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const planId = searchParams.get('planId');

    if (!planId) {
      return NextResponse.json(
        { error: 'planId is required' },
        { status: 400 }
      );
    }

    const deleted = await firebaseService.deleteMealPlan(planId);

    if (!deleted) {
      return NextResponse.json(
        { error: 'Meal plan not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Meal plan deleted successfully'
    });
  } catch (error) {
    console.error('Delete meal plan error:', error);
    return NextResponse.json(
      { error: 'Failed to delete meal plan' },
      { status: 500 }
    );
  }
}
