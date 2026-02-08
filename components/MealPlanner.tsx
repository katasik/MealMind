'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Calendar, Sparkles, Check, AlertCircle, Loader2, Trash2, Download, Info, X, BookOpen, Wand2, ChevronLeft, ChevronRight } from 'lucide-react';
import MealCard from './MealCard';
import MealDetailsModal from './MealDetailsModal';
import { cn, formatDate, getWeekStartDate, shiftWeek, formatWeekRange } from '@/lib/utils';
import { generateMealPlan, regenerateMeal, deleteMealPlan, approveMealPlan, downloadICalendar, getOpikScores } from '@/lib/api';
import type { MealPlan, MealType, PlannedMeal, Recipe, RecipeMode } from '@/lib/types';

interface MealPlannerProps {
  initialMealPlan?: MealPlan | null;
  familyId: string;
  onMealPlanChange?: (mealPlan: MealPlan | null) => void;
  viewedWeekStart?: string | null;
  onWeekChange?: (weekStart: string) => void;
}

export default function MealPlanner({ initialMealPlan, familyId, onMealPlanChange, viewedWeekStart, onWeekChange }: MealPlannerProps) {
  const [mealPlan, setMealPlanState] = useState<MealPlan | null>(initialMealPlan || null);

  // Use a ref to always have access to the latest callback without causing re-renders
  const onMealPlanChangeRef = useRef(onMealPlanChange);
  useEffect(() => {
    onMealPlanChangeRef.current = onMealPlanChange;
  }, [onMealPlanChange]);

  // Stable wrapper that notifies parent component
  const setMealPlan = useCallback((plan: MealPlan | null) => {
    setMealPlanState(plan);
    onMealPlanChangeRef.current?.(plan);
  }, []);
  // Sync internal state when parent navigates to a different week
  useEffect(() => {
    setMealPlanState(initialMealPlan || null);
  }, [initialMealPlan]);

  // Sync startDate to viewed week when no plan exists (so generate targets that week)
  useEffect(() => {
    if (viewedWeekStart && !mealPlan) {
      setStartDate(viewedWeekStart);
    }
  }, [viewedWeekStart, mealPlan]);

  const [isGenerating, setIsGenerating] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [regeneratingMeal, setRegeneratingMeal] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState(0);
  const [selectedMeal, setSelectedMeal] = useState<{ meal: PlannedMeal; dayIndex: number } | null>(null);

  // Configuration state
  const [numDays, setNumDays] = useState(7);
  const [selectedMeals, setSelectedMeals] = useState<MealType[]>(['breakfast', 'lunch', 'dinner']);
  const [showConfig, setShowConfig] = useState(false);
  const [startDate, setStartDate] = useState(() => {
    // Default to next Monday
    const today = new Date();
    const dayOfWeek = today.getDay();
    const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek);
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + (dayOfWeek === 1 ? 0 : daysUntilMonday));
    return nextMonday.toISOString().split('T')[0];
  });
  const [recipeMode, setRecipeMode] = useState<RecipeMode>('prioritize_saved');

  // Raw Opik scores (value + reason) fetched in the background.
  const [opikScores, setOpikScores] = useState<Record<string, { value: number; reason: string | null }> | null>(null);
  const [showScorePanel, setShowScorePanel] = useState(false);

  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const traceId = mealPlan?.opikTraceId;
    if (!traceId) { setOpikScores(null); return; }

    let attempts = 0;
    const maxAttempts = 20; // ~60 s at 3 s intervals

    const poll = async () => {
      const scores = await getOpikScores(traceId);
      const scoreCount = scores ? Object.keys(scores).length : 0;

      // Update state with whatever scores we have (even partial)
      if (scoreCount > 0) {
        setOpikScores(scores);
      }

      // Stop polling if we have all 3 OR hit max attempts
      attempts++;
      if (scoreCount >= 3 || attempts >= maxAttempts) {
        return;
      }

      pollRef.current = setTimeout(poll, 3000);
    };

    poll();
    return () => { if (pollRef.current) clearTimeout(pollRef.current); };
  }, [mealPlan?.opikTraceId]);

  const scoresReady = opikScores !== null && Object.keys(opikScores).length > 0;

  const toggleMeal = (meal: MealType) => {
    setSelectedMeals(prev =>
      prev.includes(meal)
        ? prev.filter(m => m !== meal)
        : [...prev, meal]
    );
  };

  const handleGenerate = async (feedbackFromPrevious?: Record<string, { value: number; reason: string | null }>) => {
    if (selectedMeals.length === 0) {
      setError('Please select at least one meal type');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setShowConfig(false);
    setOpikScores(null); // Clear old scores

    try {
      const response = await generateMealPlan(familyId, numDays, selectedMeals, feedbackFromPrevious, startDate, recipeMode);
      if (response.success && response.mealPlan) {
        setMealPlan(response.mealPlan);
      } else {
        setError(response.error || 'Failed to generate meal plan');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRemovePlan = async () => {
    if (!mealPlan) return;

    if (confirm('Are you sure you want to remove this meal plan?')) {
      try {
        await deleteMealPlan(mealPlan.id);
        setMealPlan(null);
        setSelectedDay(0);
      } catch (err) {
        console.error('Failed to delete meal plan:', err);
        setError('Failed to delete meal plan');
      }
    }
  };

  const handleApprovePlan = async () => {
    if (!mealPlan) return;

    try {
      await approveMealPlan(mealPlan.id);
      setMealPlan({ ...mealPlan, status: 'approved' });
    } catch (err) {
      console.error('Failed to approve meal plan:', err);
      setError('Failed to approve meal plan');
    }
  };

  const handleExportCalendar = () => {
    if (!mealPlan) return;
    const filename = `meal-plan-${mealPlan.weekStartDate}.ics`;
    downloadICalendar(mealPlan, filename);
  };

  const handleRegenerateMeal = async (dayIndex: number, mealType: MealType) => {
    if (!mealPlan) return;

    const key = `${dayIndex}-${mealType}`;
    setRegeneratingMeal(key);

    try {
      const response = await regenerateMeal(mealPlan.id, dayIndex, mealType);
      if (response.success && response.meal) {
        // Update local state
        const newDays = [...mealPlan.days];
        const dayMeals = newDays[dayIndex].meals.map((m) =>
          m.mealType === mealType ? response.meal! : m
        );
        newDays[dayIndex] = { ...newDays[dayIndex], meals: dayMeals };
        setMealPlan({ ...mealPlan, days: newDays });
      }
    } catch (err) {
      console.error('Failed to regenerate meal:', err);
    } finally {
      setRegeneratingMeal(null);
    }
  };

  const handleReplaceRecipe = async (recipe: Recipe) => {
    if (!mealPlan || !selectedMeal) return;

    const { dayIndex, meal } = selectedMeal;

    // Convert Recipe to PlannedMeal
    const newMeal: PlannedMeal = {
      mealType: meal.mealType,
      recipeId: recipe.id,
      recipeName: recipe.name,
      recipeDescription: recipe.description || undefined,
      prepTimeMinutes: recipe.prepTimeMinutes || 0,
      cookTimeMinutes: recipe.cookTimeMinutes || 0,
      servings: recipe.servings || 4,
      cuisine: recipe.cuisine || undefined,
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
      imageUrl: recipe.imageUrl
    };

    // Update local state
    const newDays = [...mealPlan.days];
    const dayMeals = newDays[dayIndex].meals.map((m) =>
      m.mealType === meal.mealType ? newMeal : m
    );
    newDays[dayIndex] = { ...newDays[dayIndex], meals: dayMeals };
    setMealPlan({ ...mealPlan, days: newDays });

    // Close modal
    setSelectedMeal(null);
  };

  const handlePrevWeek = async () => {
    if (!viewedWeekStart || !onWeekChange) return;
    setIsNavigating(true);
    await onWeekChange(shiftWeek(viewedWeekStart, -1));
    setIsNavigating(false);
    setSelectedDay(0);
  };

  const handleNextWeek = async () => {
    if (!viewedWeekStart || !onWeekChange) return;
    setIsNavigating(true);
    await onWeekChange(shiftWeek(viewedWeekStart, 1));
    setIsNavigating(false);
    setSelectedDay(0);
  };

  const WeekNavigation = () => (
    viewedWeekStart && onWeekChange ? (
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={handlePrevWeek}
          disabled={isNavigating}
          className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
          title="Previous week"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <p className="text-gray-500 font-medium min-w-[180px] text-center">
          {formatWeekRange(viewedWeekStart)}
        </p>
        <button
          onClick={handleNextWeek}
          disabled={isNavigating}
          className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
          title="Next week"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    ) : null
  );

  // Empty state
  if (!mealPlan && !isGenerating) {
    return (
      <div>
        {/* Week navigation even when no plan exists */}
        <WeekNavigation />

        <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-50 mb-4">
          <Calendar className="w-8 h-8 text-primary-600" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2 tracking-tight">No Meal Plan Yet</h2>
        <p className="text-gray-500 mb-6 max-w-md mx-auto">
          Generate a personalized weekly meal plan based on your family&apos;s preferences and
          dietary requirements.
        </p>

        {!showConfig ? (
          <button
            onClick={() => setShowConfig(true)}
            className="inline-flex items-center space-x-2 bg-primary-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors shadow-sm"
          >
            <Sparkles className="w-5 h-5" />
            <span>Generate Meal Plan</span>
          </button>
        ) : (
          <GenerationConfigPanel
            numDays={numDays}
            setNumDays={setNumDays}
            selectedMeals={selectedMeals}
            toggleMeal={toggleMeal}
            startDate={startDate}
            setStartDate={setStartDate}
            recipeMode={recipeMode}
            setRecipeMode={setRecipeMode}
            onGenerate={() => handleGenerate()}
            onCancel={() => setShowConfig(false)}
            disabled={selectedMeals.length === 0}
          />
        )}

        {error && (
          <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-lg inline-flex items-center space-x-2">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        )}
        </div>
      </div>
    );
  }

  // Loading state
  if (isGenerating) {
    return (
      <div className="text-center py-12">
        <Loader2 className="w-12 h-12 text-primary-600 animate-spin mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Creating Your Meal Plan</h2>
        <p className="text-gray-500">
          Our AI is crafting a personalized plan for your family...
        </p>
      </div>
    );
  }

  if (!mealPlan) return null;

  const currentDay = mealPlan.days[selectedDay];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Weekly Meal Plan</h1>
          {viewedWeekStart && onWeekChange ? (
            <WeekNavigation />
          ) : (
            <p className="text-gray-500">Week of {mealPlan.weekStartDate}</p>
          )}
        </div>

        <div className="flex items-center space-x-3 flex-wrap">
          {mealPlan.opikTraceId && (
            <button
              onClick={() => setShowScorePanel(true)}
              disabled={!scoresReady}
              className={cn(
                'inline-flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors',
                scoresReady
                  ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                  : 'bg-gray-100 text-gray-500 cursor-not-allowed'
              )}
            >
              {scoresReady ? (
                <>
                  <Info className="w-4 h-4" />
                  <span>Quality Score</span>
                </>
              ) : (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Evaluating...</span>
                </>
              )}
            </button>
          )}
          <button
            onClick={handleExportCalendar}
            className="inline-flex items-center space-x-2 bg-green-100 text-green-700 px-4 py-2 rounded-lg font-medium hover:bg-green-200 transition-colors"
            title="Export to calendar"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export</span>
          </button>
          <button
            onClick={handleRemovePlan}
            className="inline-flex items-center space-x-2 bg-red-100 text-red-700 px-4 py-2 rounded-lg font-medium hover:bg-red-200 transition-colors"
            title="Remove meal plan"
          >
            <Trash2 className="w-4 h-4" />
            <span className="hidden sm:inline">Remove</span>
          </button>
        </div>
      </div>

      {/* Quality Score Panel (modal) */}
      {showScorePanel && scoresReady && opikScores && (
        <QualityScorePanel
          opikScores={opikScores}
          passed={
            (opikScores.dietary_compliance?.value ?? 0) * 0.5 +
            (opikScores.variety?.value ?? 0) * 0.3 +
            (opikScores.nutrition?.value ?? 0) * 0.2 >= 0.6
          }
          status={mealPlan.status}
          onClose={() => setShowScorePanel(false)}
          onApprove={handleApprovePlan}
          onRegenerate={() => {
            setShowScorePanel(false);
            // Pass the current scores as feedback for the next iteration
            handleGenerate(opikScores);
          }}
        />
      )}

      {/* Configuration modal for regeneration */}
      {showConfig && (
        <GenerationConfigPanel
          numDays={numDays}
          setNumDays={setNumDays}
          selectedMeals={selectedMeals}
          toggleMeal={toggleMeal}
          startDate={startDate}
          setStartDate={setStartDate}
          recipeMode={recipeMode}
          setRecipeMode={setRecipeMode}
          onGenerate={() => handleGenerate()}
          onCancel={() => setShowConfig(false)}
          disabled={selectedMeals.length === 0}
        />
      )}

      {/* Day tabs */}
      <div className="flex overflow-x-auto space-x-2 pb-2">
        {mealPlan.days.map((day, index) => (
          <button
            key={day.date}
            onClick={() => setSelectedDay(index)}
            className={cn(
              'flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              selectedDay === index
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            <span className="block">{day.dayName.slice(0, 3)}</span>
            <span className="block text-xs opacity-75">
              {new Date(day.date).getDate()}
            </span>
          </button>
        ))}
      </div>

      {/* Current day meals */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">
          {currentDay.dayName}, {formatDate(currentDay.date)}
        </h2>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {currentDay.meals.map((meal) => (
            <MealCard
              key={`${currentDay.date}-${meal.mealType}`}
              meal={meal}
              onRegenerate={() => handleRegenerateMeal(selectedDay, meal.mealType as MealType)}
              isRegenerating={regeneratingMeal === `${selectedDay}-${meal.mealType}`}
              onClick={() => setSelectedMeal({ meal, dayIndex: selectedDay })}
            />
          ))}
        </div>
      </div>

      {/* Status badge */}
      <div className="pt-4 border-t border-gray-200">
        <span
          className={cn(
            'px-3 py-1 rounded-full text-sm font-medium',
            mealPlan.status === 'approved'
              ? 'bg-green-100 text-green-700'
              : mealPlan.status === 'completed'
                ? 'bg-gray-100 text-gray-700'
                : 'bg-yellow-100 text-yellow-700'
          )}
        >
          {mealPlan.status === 'draft'
            ? 'Draft'
            : mealPlan.status === 'approved'
              ? 'Approved'
              : 'Completed'}
        </span>
      </div>

      {/* Meal Details Modal */}
      {selectedMeal && (
        <MealDetailsModal
          meal={selectedMeal.meal}
          familyId={familyId}
          onClose={() => setSelectedMeal(null)}
          onReplace={handleReplaceRecipe}
        />
      )}
    </div>
  );
}

/* ── Generation Config Panel ── */

interface GenerationConfigPanelProps {
  numDays: number;
  setNumDays: (days: number) => void;
  selectedMeals: MealType[];
  toggleMeal: (meal: MealType) => void;
  startDate: string;
  setStartDate: (date: string) => void;
  recipeMode: RecipeMode;
  setRecipeMode: (mode: RecipeMode) => void;
  onGenerate: () => void;
  onCancel: () => void;
  disabled: boolean;
}

function GenerationConfigPanel({
  numDays, setNumDays, selectedMeals, toggleMeal,
  startDate, setStartDate, recipeMode, setRecipeMode,
  onGenerate, onCancel, disabled
}: GenerationConfigPanelProps) {
  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="max-w-md mx-auto bg-white rounded-xl border border-gray-200 p-6 space-y-5 text-left">
      {/* Start date */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">Start Date</label>
        <input
          type="date"
          value={startDate}
          min={today}
          onChange={(e) => setStartDate(e.target.value)}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
        />
      </div>

      {/* Days selector */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">Number of Days</label>
        <div className="grid grid-cols-4 gap-2">
          {[3, 5, 7, 14].map(days => (
            <button
              key={days}
              onClick={() => setNumDays(days)}
              className={cn(
                'py-2 rounded-lg text-sm font-medium transition-colors border',
                numDays === days
                  ? 'bg-primary-50 text-primary-700 border-primary-200'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              )}
            >
              {days} days
            </button>
          ))}
        </div>
      </div>

      {/* Meal type selector */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">Meals to Include</label>
        <div className="flex gap-2">
          {(['breakfast', 'lunch', 'dinner'] as MealType[]).map(meal => (
            <button
              key={meal}
              onClick={() => toggleMeal(meal)}
              className={cn(
                'flex-1 py-2 rounded-lg text-sm font-medium transition-colors border capitalize',
                selectedMeals.includes(meal)
                  ? 'bg-primary-50 text-primary-700 border-primary-200'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              )}
            >
              {meal}
            </button>
          ))}
        </div>
      </div>

      {/* Recipe mode */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">Recipe Source</label>
        <div className="space-y-2">
          <button
            onClick={() => setRecipeMode('prioritize_saved')}
            className={cn(
              'w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors',
              recipeMode === 'prioritize_saved'
                ? 'bg-primary-50 border-primary-200'
                : 'bg-white border-gray-200 hover:bg-gray-50'
            )}
          >
            <BookOpen className={cn('w-5 h-5 flex-shrink-0', recipeMode === 'prioritize_saved' ? 'text-primary-600' : 'text-gray-400')} />
            <div>
              <p className={cn('text-sm font-medium', recipeMode === 'prioritize_saved' ? 'text-primary-700' : 'text-gray-700')}>
                Prioritize my saved recipes
              </p>
              <p className="text-xs text-gray-500">Use your recipe library first, fill gaps with new ideas</p>
            </div>
          </button>
          <button
            onClick={() => setRecipeMode('new_only')}
            className={cn(
              'w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors',
              recipeMode === 'new_only'
                ? 'bg-primary-50 border-primary-200'
                : 'bg-white border-gray-200 hover:bg-gray-50'
            )}
          >
            <Wand2 className={cn('w-5 h-5 flex-shrink-0', recipeMode === 'new_only' ? 'text-primary-600' : 'text-gray-400')} />
            <div>
              <p className={cn('text-sm font-medium', recipeMode === 'new_only' ? 'text-primary-700' : 'text-gray-700')}>
                Generate completely new recipes
              </p>
              <p className="text-xs text-gray-500">Fresh ideas only — no saved recipes used</p>
            </div>
          </button>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex space-x-3 pt-1">
        <button
          onClick={onGenerate}
          disabled={disabled}
          className="flex-1 inline-flex items-center justify-center space-x-2 bg-primary-600 text-white px-4 py-2.5 rounded-lg font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        >
          <Sparkles className="w-4 h-4" />
          <span>Generate</span>
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2.5 text-gray-700 hover:bg-gray-100 rounded-lg font-medium transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

interface QualityScorePanelProps {
  opikScores: Record<string, { value: number; reason: string | null }>;
  passed: boolean;
  status: 'draft' | 'approved' | 'completed';
  onClose: () => void;
  onApprove: () => void;
  onRegenerate: () => void;
}

function QualityScorePanel({ opikScores, passed, status, onClose, onApprove, onRegenerate }: QualityScorePanelProps) {
  const [showFormula, setShowFormula] = useState(false);

  const d = opikScores.dietary_compliance?.value ?? 0;
  const v = opikScores.variety?.value ?? 0;
  const n = opikScores.nutrition?.value ?? 0;
  const overall = d * 0.5 + v * 0.3 + n * 0.2;
  const percentage = Math.round(overall * 100);

  const metrics = [
    { key: 'dietary_compliance', label: 'Dietary Compliance', value: d, weight: '50%' },
    { key: 'variety', label: 'Variety', value: v, weight: '30%' },
    { key: 'nutrition', label: 'Nutrition', value: n, weight: '20%' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-2">
          <h2 className="text-lg font-semibold text-gray-900">Quality Assessment</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 pb-6 space-y-5">
          {/* Overall score */}
          <div className="flex items-center space-x-3">
            <div className={cn(
              'flex items-center justify-center w-20 h-20 rounded-full text-xl font-bold',
              passed ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
            )}>
              {percentage}%
            </div>
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <span className={cn('text-sm font-semibold', passed ? 'text-green-700' : 'text-yellow-700')}>
                  {passed ? 'Looks good' : 'Needs attention'}
                </span>
                <button
                  onClick={() => setShowFormula(prev => !prev)}
                  className="text-gray-400 hover:text-indigo-600 transition-colors"
                  title="How is this calculated?"
                >
                  <Info className="w-4 h-4" />
                </button>
              </div>
              {showFormula && (
                <p className="text-xs text-gray-500 mt-1">
                  Dietary Compliance (50%) + Variety (30%) + Nutrition (20%). Scored by an AI judge.
                </p>
              )}
            </div>
          </div>

          {/* Per-metric breakdown */}
          <div className="space-y-3">
            {metrics.map(m => {
              const hasScore = opikScores[m.key] !== undefined;
              return (
                <div key={m.key} className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700">{m.label}</span>
                    {hasScore ? (
                      <span className="text-sm font-semibold text-gray-900">
                        {Math.round(m.value * 100)}%
                        <span className="text-xs font-normal text-gray-400 ml-1">({m.weight})</span>
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400 flex items-center space-x-1">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Evaluating...</span>
                      </span>
                    )}
                  </div>
                  {/* Bar */}
                  {hasScore ? (
                    <div className="w-full h-1.5 bg-gray-200 rounded-full">
                      <div
                        className={cn('h-1.5 rounded-full', m.value >= 0.7 ? 'bg-green-500' : m.value >= 0.5 ? 'bg-yellow-500' : 'bg-red-500')}
                        style={{ width: `${m.value * 100}%` }}
                      />
                    </div>
                  ) : (
                    <div className="w-full h-1.5 bg-gray-200 rounded-full">
                      <div className="h-1.5 rounded-full bg-gray-300 animate-pulse" style={{ width: '50%' }} />
                    </div>
                  )}
                  {/* Reason */}
                  {hasScore && opikScores[m.key]?.reason && (
                    <p className="text-xs text-gray-500 mt-1.5 italic">{opikScores[m.key].reason}</p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Action buttons */}
          <div className="flex space-x-3 pt-2">
            {status === 'draft' && (
              <button
                onClick={() => { onApprove(); onClose(); }}
                className="flex-1 inline-flex items-center justify-center space-x-2 bg-green-600 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-green-700 transition-colors"
              >
                <Check className="w-4 h-4" />
                <span>Approve Plan</span>
              </button>
            )}
            <button
              onClick={onRegenerate}
              className={cn(
                'inline-flex items-center justify-center space-x-2 px-4 py-2.5 rounded-lg font-medium transition-colors',
                status === 'draft' ? 'flex-1 bg-indigo-100 text-indigo-700 hover:bg-indigo-200' : 'w-full bg-indigo-600 text-white hover:bg-indigo-700'
              )}
            >
              <Sparkles className="w-4 h-4" />
              <span>Regenerate</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
