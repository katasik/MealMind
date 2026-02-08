'use client';

import { useEffect, useState } from 'react';
import MealPlanner from '@/components/MealPlanner';
import ShoppingListModal from '@/components/ShoppingListModal';
import { getLatestMealPlan, getMealPlanByWeek, initializeDemoFamily } from '@/lib/firebase';
import { Loader2, ShoppingCart } from 'lucide-react';
import type { MealPlan } from '@/lib/types';

export default function MealPlanPage() {
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [mealPlan, setMealPlan] = useState<MealPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [viewedWeekStart, setViewedWeekStart] = useState<string | null>(null);
  const [showShoppingModal, setShowShoppingModal] = useState(false);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      const id = await initializeDemoFamily();
      setFamilyId(id);
      const plan = await getLatestMealPlan(id);
      setMealPlan(plan);
      if (plan) {
        setViewedWeekStart(plan.weekStartDate);
      } else {
        // Default to current week's Monday
        const today = new Date();
        const day = today.getDay();
        const diff = today.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(today);
        monday.setDate(diff);
        setViewedWeekStart(monday.toISOString().split('T')[0]);
      }
    } catch (error) {
      console.error('Failed to initialize:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleWeekChange = async (weekStart: string) => {
    if (!familyId) return;
    setViewedWeekStart(weekStart);
    const plan = await getMealPlanByWeek(familyId, weekStart);
    setMealPlan(plan);
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
      {/* Meal Planner - full width */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <MealPlanner
          initialMealPlan={mealPlan}
          familyId={familyId}
          onMealPlanChange={setMealPlan}
          viewedWeekStart={viewedWeekStart}
          onWeekChange={handleWeekChange}
        />
      </div>

      {/* Floating Action Button for Shopping List */}
      {mealPlan && (
        <button
          onClick={() => setShowShoppingModal(true)}
          className="fixed bottom-6 right-6 z-40 w-14 h-14 bg-primary-600 text-white rounded-full shadow-lg hover:bg-primary-700 transition-colors flex items-center justify-center hover:shadow-xl"
          title="Shopping List"
        >
          <ShoppingCart className="w-6 h-6" />
        </button>
      )}

      {/* Shopping List Modal */}
      {showShoppingModal && mealPlan && (
        <ShoppingListModal
          mealPlanId={mealPlan.id}
          familyId={familyId}
          onClose={() => setShowShoppingModal(false)}
        />
      )}
    </div>
  );
}
