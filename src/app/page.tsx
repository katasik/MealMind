'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Check,
  Download,
  ShoppingCart,
  Loader2,
  Settings2,
  Send
} from 'lucide-react';
import Navigation from '@/components/Navigation';
import DayColumn from '@/components/mealplan/DayColumn';
import RecipeDetailModal from '@/components/mealplan/RecipeDetailModal';
import RecipeSelectModal from '@/components/mealplan/RecipeSelectModal';
import ShoppingListModal from '@/components/mealplan/ShoppingListModal';
import Toast from '@/components/Toast';
import type { MealPlan, MealType, PlannedMeal, MealPlanShoppingList, Recipe } from '@/types';

// Helper to get Monday of the current week
function getWeekStartDate(): string {
  const today = new Date();
  const day = today.getDay();
  const diff = today.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(today.setDate(diff));
  return monday.toISOString().split('T')[0];
}

// Helper to format date range for display
function formatDateRange(startDate: string, days: number): string {
  const start = new Date(startDate);
  const end = new Date(start);
  end.setDate(end.getDate() + days - 1);

  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  if (days === 1) {
    return start.toLocaleDateString('en-US', { ...opts, weekday: 'short' });
  }
  return `${start.toLocaleDateString('en-US', opts)} - ${end.toLocaleDateString('en-US', opts)}`;
}

// Helper to check if a date is today
function isToday(dateStr: string): boolean {
  const today = new Date().toISOString().split('T')[0];
  return dateStr === today;
}

const MEAL_OPTIONS: { value: MealType; label: string }[] = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snack' }
];

const DAY_OPTIONS = [1, 2, 3, 4, 5, 6, 7];

export default function HomePage() {
  const [startDate, setStartDate] = useState(getWeekStartDate());
  const [numberOfDays, setNumberOfDays] = useState(7);
  const [selectedMeals, setSelectedMeals] = useState<MealType[]>(['dinner']);
  const [mealPlan, setMealPlan] = useState<MealPlan | null>(null);
  const [shoppingList, setShoppingList] = useState<MealPlanShoppingList | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [regeneratingMeal, setRegeneratingMeal] = useState<{ dayIndex: number; mealType: MealType } | null>(null);
  const [selectedMeal, setSelectedMeal] = useState<PlannedMeal | null>(null);
  const [showRecipeModal, setShowRecipeModal] = useState(false);
  const [showShoppingModal, setShowShoppingModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isSendingTelegram, setIsSendingTelegram] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Recipe selection modal state
  const [showRecipeSelectModal, setShowRecipeSelectModal] = useState(false);
  const [selectingMeal, setSelectingMeal] = useState<{ dayIndex: number; mealType: MealType } | null>(null);

  // Fetch existing meal plan on load
  useEffect(() => {
    fetchMealPlan();
  }, [startDate]);

  const fetchMealPlan = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/mealplans?weekStartDate=${startDate}`);
      const data = await response.json();
      setMealPlan(data.mealPlan || null);

      if (data.mealPlan && (data.mealPlan.status === 'approved' || data.mealPlan.status === 'finalized')) {
        const listResponse = await fetch(`/api/shopping?mealPlanId=${data.mealPlan.id}`);
        const listData = await listResponse.json();
        setShoppingList(listData.shoppingList || null);
      } else {
        setShoppingList(null);
      }
    } catch (error) {
      console.error('Error fetching meal plan:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const generatePlan = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch('/api/mealplans/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weekStartDate: startDate,
          numberOfDays,
          mealsPerDay: selectedMeals
        })
      });
      const data = await response.json();
      if (data.success) {
        setMealPlan(data.mealPlan);
        setShowSettings(false);
      }
    } catch (error) {
      console.error('Error generating meal plan:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const regenerateMeal = async (dayIndex: number, mealType: MealType) => {
    setRegeneratingMeal({ dayIndex, mealType });
    try {
      const response = await fetch('/api/mealplans/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weekStartDate: startDate,
          numberOfDays,
          mealsPerDay: selectedMeals,
          regenerateMeal: { dayIndex, mealType }
        })
      });
      const data = await response.json();
      if (data.success) {
        setMealPlan(data.mealPlan);
      }
    } catch (error) {
      console.error('Error regenerating meal:', error);
    } finally {
      setRegeneratingMeal(null);
    }
  };

  const openRecipeSelector = (dayIndex: number, mealType: MealType) => {
    setSelectingMeal({ dayIndex, mealType });
    setShowRecipeSelectModal(true);
  };

  const handleRecipeSelect = async (recipe: Recipe) => {
    if (!mealPlan || !selectingMeal) return;

    // Convert Recipe to PlannedMeal
    const newMeal: PlannedMeal = {
      mealType: selectingMeal.mealType,
      recipeId: recipe.id,
      recipeName: recipe.name,
      recipeDescription: recipe.description,
      prepTime: recipe.prepTime,
      cookTime: recipe.cookTime,
      servings: recipe.servings,
      cuisine: recipe.cuisine,
      difficulty: recipe.difficulty,
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
      imageUrl: recipe.imageUrl
    };

    // Update the meal plan locally
    const updatedDays = mealPlan.days.map((day, idx) => {
      if (idx === selectingMeal.dayIndex) {
        return {
          ...day,
          meals: day.meals.map(meal =>
            meal.mealType === selectingMeal.mealType ? newMeal : meal
          )
        };
      }
      return day;
    });

    const updatedPlan = { ...mealPlan, days: updatedDays };
    setMealPlan(updatedPlan);

    // Save to backend
    try {
      await fetch('/api/mealplans', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: mealPlan.id,
          updateMeal: {
            dayIndex: selectingMeal.dayIndex,
            mealType: selectingMeal.mealType,
            meal: newMeal
          }
        })
      });
      setToast({ message: 'Recipe updated!', type: 'success' });
    } catch (error) {
      console.error('Error updating meal:', error);
      setToast({ message: 'Failed to update recipe', type: 'error' });
    }

    setShowRecipeSelectModal(false);
    setSelectingMeal(null);
  };

  const approvePlan = async () => {
    if (!mealPlan) return;
    setIsApproving(true);
    try {
      const statusResponse = await fetch('/api/mealplans', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: mealPlan.id, status: 'approved' })
      });
      const statusData = await statusResponse.json();

      if (statusData.success) {
        setMealPlan(statusData.mealPlan);
        const listResponse = await fetch('/api/shopping', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mealPlanId: mealPlan.id })
        });
        const listData = await listResponse.json();
        if (listData.success) {
          setShoppingList(listData.shoppingList);
          setShowShoppingModal(true);
        }
      }
    } catch (error) {
      console.error('Error approving plan:', error);
    } finally {
      setIsApproving(false);
    }
  };

  const removePlan = async () => {
    if (!mealPlan) return;
    if (!window.confirm('Remove this meal plan? This cannot be undone.')) return;
    setIsRemoving(true);
    try {
      const response = await fetch(`/api/mealplans?planId=${mealPlan.id}`, {
        method: 'DELETE'
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setMealPlan(null);
        setShoppingList(null);
        setShowShoppingModal(false);
        setToast({ message: 'Meal plan removed.', type: 'success' });
      } else {
        setToast({ message: data.error || 'Failed to remove meal plan', type: 'error' });
      }
    } catch (error) {
      console.error('Error removing plan:', error);
      setToast({ message: 'Failed to remove meal plan', type: 'error' });
    } finally {
      setIsRemoving(false);
    }
  };

  const toggleShoppingItem = async (itemId: string, checked: boolean) => {
    if (!shoppingList) return;
    setShoppingList({
      ...shoppingList,
      items: shoppingList.items.map(item =>
        item.id === itemId ? { ...item, checked } : item
      )
    });
    try {
      await fetch('/api/shopping', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listId: shoppingList.id, itemId, checked })
      });
    } catch (error) {
      console.error('Error updating shopping item:', error);
      fetchMealPlan();
    }
  };

  const finalizePlan = async () => {
    if (!mealPlan) return;
    setIsFinalizing(true);
    try {
      const response = await fetch('/api/mealplans', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: mealPlan.id, status: 'finalized' })
      });
      const data = await response.json();
      if (data.success) {
        setMealPlan(data.mealPlan);
        setShowShoppingModal(false);
      }
    } catch (error) {
      console.error('Error finalizing plan:', error);
    } finally {
      setIsFinalizing(false);
    }
  };

  const exportToCalendar = () => {
    if (!mealPlan) return;
    window.open(`/api/mealplans/export?mealPlanId=${mealPlan.id}`, '_blank');
  };

  const sendToTelegram = async () => {
    if (!shoppingList) return;
    setIsSendingTelegram(true);
    try {
      const response = await fetch('/api/shopping/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shoppingListId: shoppingList.id })
      });
      const data = await response.json();
      if (data.success) {
        setToast({ message: 'Shopping list sent to Telegram!', type: 'success' });
      } else {
        setToast({ message: data.error || 'Failed to send to Telegram', type: 'error' });
      }
    } catch (error) {
      console.error('Error sending to Telegram:', error);
      setToast({ message: 'Failed to send to Telegram', type: 'error' });
    } finally {
      setIsSendingTelegram(false);
    }
  };

  const goToPreviousWeek = () => {
    const date = new Date(startDate);
    date.setDate(date.getDate() - 7);
    setStartDate(date.toISOString().split('T')[0]);
  };

  const goToNextWeek = () => {
    const date = new Date(startDate);
    date.setDate(date.getDate() + 7);
    setStartDate(date.toISOString().split('T')[0]);
  };

  const viewRecipe = (dayIndex: number, mealType: MealType) => {
    if (!mealPlan) return;
    const meal = mealPlan.days[dayIndex]?.meals.find(m => m.mealType === mealType);
    if (meal) {
      setSelectedMeal(meal);
      setShowRecipeModal(true);
    }
  };

  const toggleMeal = (meal: MealType) => {
    setSelectedMeals(prev =>
      prev.includes(meal)
        ? prev.filter(m => m !== meal)
        : [...prev, meal]
    );
  };

  return (
    <div className="min-h-screen bg-[#FBFBFA]">
      <Navigation />

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Header - Notion style */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-3xl">🍽️</span>
            <h1 className="text-3xl font-bold text-[#37352F]">Meal Plan</h1>
          </div>
          <p className="text-[#787774] ml-12">
            Plan your meals with AI assistance
          </p>
        </div>

        {/* Controls Bar - Notion style */}
        <div className="flex flex-wrap items-center gap-3 mb-6 pb-4 border-b border-[#E9E9E7]">
          {/* Date Navigation */}
          <div className="flex items-center bg-white border border-[#E9E9E7] rounded-md">
            <button
              onClick={goToPreviousWeek}
              className="p-2 hover:bg-[#F7F6F3] transition-colors rounded-l-md"
            >
              <ChevronLeft className="w-4 h-4 text-[#787774]" />
            </button>
            <span className="px-3 py-1.5 text-sm text-[#37352F] font-medium min-w-[140px] text-center">
              {mealPlan ? formatDateRange(mealPlan.weekStartDate, mealPlan.days.length) : formatDateRange(startDate, numberOfDays)}
            </span>
            <button
              onClick={goToNextWeek}
              className="p-2 hover:bg-[#F7F6F3] transition-colors rounded-r-md"
            >
              <ChevronRight className="w-4 h-4 text-[#787774]" />
            </button>
          </div>

          {/* Settings Button */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-md border transition-colors ${
              showSettings
                ? 'bg-[#37352F] text-white border-[#37352F]'
                : 'bg-white text-[#37352F] border-[#E9E9E7] hover:bg-[#F7F6F3]'
            }`}
          >
            <Settings2 className="w-4 h-4" />
            Settings
          </button>

          <div className="flex-1" />

          {/* Action Buttons */}
          {mealPlan && mealPlan.status === 'draft' && (
            <div className="flex items-center gap-2">
              <button
                onClick={approvePlan}
                disabled={isApproving}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-[#2383E2] text-white rounded-md hover:bg-[#1B6EC2] transition-colors disabled:opacity-50"
              >
                {isApproving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Approve
              </button>
              <button
                onClick={removePlan}
                disabled={isRemoving}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white text-[#EB5757] border border-[#F5C2C7] rounded-md hover:bg-[#FDEBEC] transition-colors disabled:opacity-50"
              >
                {isRemoving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Remove
              </button>
            </div>
          )}

          {mealPlan && (mealPlan.status === 'approved' || mealPlan.status === 'finalized') && (
            <>
              <button
                onClick={() => setShowShoppingModal(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white text-[#37352F] border border-[#E9E9E7] rounded-md hover:bg-[#F7F6F3] transition-colors"
              >
                <ShoppingCart className="w-4 h-4" />
                Shopping List
              </button>
              <button
                onClick={exportToCalendar}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white text-[#37352F] border border-[#E9E9E7] rounded-md hover:bg-[#F7F6F3] transition-colors"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
              <button
                onClick={sendToTelegram}
                disabled={isSendingTelegram || !shoppingList}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-[#0088cc] text-white rounded-md hover:bg-[#0077b5] transition-colors disabled:opacity-50"
              >
                {isSendingTelegram ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Telegram
              </button>
            </>
          )}
        </div>

        {/* Settings Panel - Notion style */}
        <AnimatePresence>
          {showSettings && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mb-6"
            >
              <div className="bg-white border border-[#E9E9E7] rounded-lg p-4">
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Number of Days */}
                  <div>
                    <label className="block text-sm font-medium text-[#37352F] mb-2">
                      Number of days
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {DAY_OPTIONS.map(day => (
                        <button
                          key={day}
                          onClick={() => setNumberOfDays(day)}
                          className={`w-10 h-10 rounded-md text-sm font-medium transition-colors ${
                            numberOfDays === day
                              ? 'bg-[#37352F] text-white'
                              : 'bg-[#F7F6F3] text-[#37352F] hover:bg-[#E9E9E7]'
                          }`}
                        >
                          {day}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Meals to include */}
                  <div>
                    <label className="block text-sm font-medium text-[#37352F] mb-2">
                      Meals to include
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {MEAL_OPTIONS.map(option => (
                        <button
                          key={option.value}
                          onClick={() => toggleMeal(option.value)}
                          className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                            selectedMeals.includes(option.value)
                              ? 'bg-[#37352F] text-white'
                              : 'bg-[#F7F6F3] text-[#37352F] hover:bg-[#E9E9E7]'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Generate Button */}
                <div className="mt-4 pt-4 border-t border-[#E9E9E7]">
                  <button
                    onClick={generatePlan}
                    disabled={isGenerating || selectedMeals.length === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-[#37352F] text-white rounded-md hover:bg-[#2F2D2A] transition-colors disabled:opacity-50"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Generate {numberOfDays}-day plan
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Status Badge */}
        {mealPlan && (
          <div className="mb-4 flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                mealPlan.status === 'draft'
                  ? 'bg-[#FDF0D5] text-[#B4540A]'
                  : mealPlan.status === 'approved'
                  ? 'bg-[#DDEBF1] text-[#0B6E99]'
                  : 'bg-[#DBEDDB] text-[#1E7C45]'
              }`}
            >
              {mealPlan.status === 'draft' && '✏️ Draft'}
              {mealPlan.status === 'approved' && '✅ Approved'}
              {mealPlan.status === 'finalized' && '🎉 Ready'}
            </span>
            <button
              onClick={removePlan}
              disabled={isRemoving}
              className="inline-flex items-center gap-2 px-2.5 py-1 text-xs font-medium bg-white text-[#EB5757] border border-[#F5C2C7] rounded-full hover:bg-[#FDEBEC] transition-colors disabled:opacity-50"
            >
              {isRemoving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              Remove
            </button>
          </div>
        )}

        {/* Main Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-[#787774] animate-spin" />
          </div>
        ) : mealPlan ? (
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-3 min-w-max">
              {mealPlan.days.map((day, index) => (
                <DayColumn
                  key={day.date}
                  day={day}
                  dayIndex={index}
                  isToday={isToday(day.date)}
                  isDraft={mealPlan.status === 'draft'}
                  onRegenerateMeal={regenerateMeal}
                  onSelectFromSaved={openRecipeSelector}
                  onViewRecipe={viewRecipe}
                  regeneratingMeal={regeneratingMeal}
                />
              ))}
            </div>
          </div>
        ) : (
          /* Empty State - Notion style */
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <div className="text-5xl mb-4">📅</div>
            <h2 className="text-xl font-semibold text-[#37352F] mb-2">
              No meal plan yet
            </h2>
            <p className="text-[#787774] mb-6 max-w-md mx-auto">
              Configure your preferences above and generate a personalized meal plan.
            </p>
            <button
              onClick={() => setShowSettings(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#37352F] text-white rounded-md hover:bg-[#2F2D2A] transition-colors"
            >
              <Settings2 className="w-4 h-4" />
              Open Settings
            </button>
          </motion.div>
        )}

        {/* Regenerate Full Plan Button */}
        {mealPlan && mealPlan.status === 'draft' && (
          <div className="mt-6 text-center">
            <button
              onClick={generatePlan}
              disabled={isGenerating}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-[#787774] hover:text-[#37352F] hover:bg-[#F7F6F3] rounded-md transition-colors disabled:opacity-50"
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              Regenerate entire plan
            </button>
          </div>
        )}
      </main>

      <RecipeDetailModal
        isOpen={showRecipeModal}
        onClose={() => setShowRecipeModal(false)}
        meal={selectedMeal}
      />

      <RecipeSelectModal
        isOpen={showRecipeSelectModal}
        onClose={() => {
          setShowRecipeSelectModal(false);
          setSelectingMeal(null);
        }}
        onSelect={handleRecipeSelect}
        mealType={selectingMeal?.mealType || 'dinner'}
        currentRecipeName={
          selectingMeal && mealPlan
            ? mealPlan.days[selectingMeal.dayIndex]?.meals.find(
                m => m.mealType === selectingMeal.mealType
              )?.recipeName
            : undefined
        }
      />

      <ShoppingListModal
        isOpen={showShoppingModal}
        onClose={() => setShowShoppingModal(false)}
        shoppingList={shoppingList}
        onToggleItem={toggleShoppingItem}
        onFinalize={finalizePlan}
        isLoading={isFinalizing}
      />

      <Toast
        message={toast?.message || ''}
        type={toast?.type || 'info'}
        isVisible={!!toast}
        onClose={() => setToast(null)}
      />
    </div>
  );
}
