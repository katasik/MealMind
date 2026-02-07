'use client';

import { useEffect, useState } from 'react';
import MealPlanner from '@/components/MealPlanner';
import ShoppingList from '@/components/ShoppingList';
import { getCurrentMealPlan, initializeDemoFamily } from '@/lib/firebase';
import { Loader2 } from 'lucide-react';
import type { MealPlan } from '@/lib/types';

export default function HomePage() {
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [mealPlan, setMealPlan] = useState<MealPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'meals' | 'shopping'>('meals');

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // Initialize demo family (in production, this would come from auth)
      const id = await initializeDemoFamily();
      setFamilyId(id);

      // Load current meal plan
      const plan = await getCurrentMealPlan(id);
      setMealPlan(plan);
    } catch (error) {
      console.error('Failed to initialize:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-primary-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Loading MealMind...</p>
        </div>
      </div>
    );
  }

  if (!familyId) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Failed to initialize. Please refresh the page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tab navigation for mobile */}
      <div className="flex space-x-2 md:hidden">
        <button
          onClick={() => setActiveTab('meals')}
          className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
            activeTab === 'meals'
              ? 'bg-primary-600 text-white'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          Meal Plan
        </button>
        <button
          onClick={() => setActiveTab('shopping')}
          className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
            activeTab === 'shopping'
              ? 'bg-primary-600 text-white'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          Shopping
        </button>
      </div>

      {/* Desktop: side by side, Mobile: tabs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Meal Planner - takes 2/3 on desktop */}
        <div
          className={`lg:col-span-2 ${activeTab !== 'meals' ? 'hidden md:block' : ''}`}
        >
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <MealPlanner initialMealPlan={mealPlan} familyId={familyId} onMealPlanChange={setMealPlan} />
          </div>
        </div>

        {/* Shopping List - takes 1/3 on desktop */}
        <div className={`${activeTab !== 'shopping' ? 'hidden md:block' : ''}`}>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sticky top-24">
            {mealPlan ? (
              <ShoppingList mealPlanId={mealPlan.id} />
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>Generate a meal plan to see your shopping list</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
