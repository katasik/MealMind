'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import ShoppingList from '@/components/ShoppingList';
import { getLatestMealPlan, initializeDemoFamily } from '@/lib/firebase';
import type { MealPlan } from '@/lib/types';

export default function ShoppingPage() {
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [mealPlan, setMealPlan] = useState<MealPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const id = await initializeDemoFamily();
      setFamilyId(id);
      const plan = await getLatestMealPlan(id);
      setMealPlan(plan);
    } catch (error) {
      console.error('Failed to load:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-12 h-12 text-primary-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        {mealPlan && familyId ? (
          <ShoppingList mealPlanId={mealPlan.id} familyId={familyId} />
        ) : (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
              <span className="text-3xl">🛒</span>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No Meal Plan</h2>
            <p className="text-gray-500 max-w-md mx-auto">
              Generate a meal plan first to create a shopping list. Go to the{' '}
              <a href="/meal-plan" className="text-primary-600 hover:text-primary-700 font-medium">
                Meal Plan
              </a>{' '}
              page to get started.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
