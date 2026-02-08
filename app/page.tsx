'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Sparkles, Settings, Share2, BadgeCheck, BookOpen,
  Calendar, MessageCircle, Clock, Users, ArrowRight, Loader2
} from 'lucide-react';
import { getLatestMealPlan, initializeDemoFamily } from '@/lib/firebase';
import type { MealPlan, PlannedMeal } from '@/lib/types';

export default function HomePage() {
  const [mealPlan, setMealPlan] = useState<MealPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const id = await initializeDemoFamily();
      const plan = await getLatestMealPlan(id);
      setMealPlan(plan);
    } catch (error) {
      console.error('Failed to load:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const todaysMeals = getTodaysMeals(mealPlan);

  return (
    <div className="max-w-[900px] mx-auto space-y-12">
      {/* Badge */}
      <div
        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-primary-50 text-primary-600 text-[13px] font-semibold border border-primary-100 animate-fade-in"
      >
        <Sparkles className="w-3.5 h-3.5" />
        AI-Powered Meal Planning
      </div>

      {/* Hero */}
      <div className="space-y-4 animate-fade-in" style={{ animationDelay: '0.1s' }}>
        <h1 className="text-[32px] sm:text-[38px] font-bold tracking-tighter leading-[1.15] text-gray-950">
          From &lsquo;what should we eat&rsquo;{' '}
          <br className="hidden sm:block" />
          <span className="gradient-text">to a plan in a few seconds.</span>
        </h1>
        <p className="text-base text-gray-500 max-w-[560px] leading-relaxed">
          MealMind turns 30 minutes of recipe scrolling into a one-minute meal plan — tailored
          to your family&apos;s diet, taste, and schedule.
        </p>
        <div className="pt-2">
          <Link
            href="/meal-plan"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-xl font-semibold hover:bg-gray-800 transition-colors shadow-sm"
          >
            <Sparkles className="w-4 h-4" />
            Generate Your Meal Plan
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* 3 Step Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <StepCard
          icon={<Settings className="w-5 h-5" />}
          iconBg="bg-primary-50"
          iconColor="text-primary-600"
          step="Step 1"
          title="Set needs & preferences"
          description="Add preferred ingredients, diets, and favourite recipes once."
          delay={0.35}
        />
        <StepCard
          icon={<Sparkles className="w-5 h-5" />}
          iconBg="bg-accent-50"
          iconColor="text-accent-600"
          step="Step 2"
          title="Get a plan"
          description="AI generates a quality-checked meal plan, built from using your saved recipes or generating something completely new."
          delay={0.45}
        />
        <StepCard
          icon={<Share2 className="w-5 h-5" />}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
          step="Step 3"
          title="Shop & share"
          description="One-tap shopping list and calendar export. Share the plan and discuss it with others if you'd like."
          delay={0.55}
        />
      </div>

      {/* Feature Pills */}
      <div className="flex flex-wrap gap-2.5 animate-fade-in" style={{ animationDelay: '0.7s' }}>
        <FeaturePill icon={<BadgeCheck className="w-4 h-4" />} label="Quality-checked plans" />
        <FeaturePill icon={<BookOpen className="w-4 h-4" />} label="Trusted recipes" />
        <FeaturePill icon={<Calendar className="w-4 h-4" />} label="Calendar export" />
        <FeaturePill icon={<MessageCircle className="w-4 h-4" />} label="Family group chat" />
      </div>

      {/* Stats Row */}
      <div className="flex items-center gap-5 flex-wrap animate-fade-in" style={{ animationDelay: '0.85s' }}>
        <Stat number="87%" label="struggle with meal decisions weekly" />
        <div className="w-px h-8 bg-gray-200 hidden sm:block" />
        <Stat number="60s" label="to a full weekly plan" />
        <div className="w-px h-8 bg-gray-200 hidden sm:block" />
        <Stat number="0" label="decision fatigue" />
      </div>

      {/* Dashboard Section — shows if meal plan exists */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
        </div>
      ) : mealPlan ? (
        <div className="space-y-4 pt-8 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 tracking-tight">
              Your Current Plan
            </h2>
            <Link
              href="/meal-plan"
              className="text-sm font-medium text-primary-600 hover:text-primary-700 flex items-center gap-1"
            >
              View Full Plan <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Today's Meals */}
          {todaysMeals.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {todaysMeals.map((meal) => (
                <TodayMealCard key={meal.mealType} meal={meal} />
              ))}
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl p-6 text-center text-gray-500 text-sm">
              No meals planned for today. Check your full plan for upcoming meals.
            </div>
          )}

          {/* Quick Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Link
              href="/meal-plan"
              className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-300 hover:shadow-sm transition-all"
            >
              <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-primary-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Meal Plan</p>
                <p className="text-xs text-gray-500">View & manage</p>
              </div>
            </Link>
            <Link
              href="/shopping"
              className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-300 hover:shadow-sm transition-all"
            >
              <div className="w-10 h-10 rounded-lg bg-accent-50 flex items-center justify-center">
                <BadgeCheck className="w-5 h-5 text-accent-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Shopping List</p>
                <p className="text-xs text-gray-500">Check ingredients</p>
              </div>
            </Link>
            <Link
              href="/recipes"
              className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-300 hover:shadow-sm transition-all"
            >
              <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Recipes</p>
                <p className="text-xs text-gray-500">Browse collection</p>
              </div>
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ── Helper Components ── */

function StepCard({
  icon, iconBg, iconColor, step, title, description, delay
}: {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  step: string;
  title: string;
  description: string;
  delay: number;
}) {
  return (
    <div
      className="step-card opacity-0 animate-fade-up"
      style={{ animationDelay: `${delay}s`, animationFillMode: 'forwards' }}
    >
      <div className={`w-10 h-10 rounded-[10px] flex items-center justify-center mb-4 ${iconBg}`}>
        <span className={iconColor}>{icon}</span>
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-2">{step}</p>
      <h3 className="text-base font-semibold tracking-tight text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-500 leading-relaxed">{description}</p>
    </div>
  );
}

function FeaturePill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="feature-pill">
      <span className="text-gray-500">{icon}</span>
      {label}
    </div>
  );
}

function Stat({ number, label }: { number: string; label: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[28px] font-bold tracking-tighter gradient-text">{number}</span>
      <span className="text-sm text-gray-500">{label}</span>
    </div>
  );
}

function TodayMealCard({ meal }: { meal: PlannedMeal }) {
  const mealEmoji: Record<string, string> = {
    breakfast: '🌅',
    lunch: '☀️',
    dinner: '🌙',
    snack: '🍎',
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition-all">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{mealEmoji[meal.mealType] || '🍽️'}</span>
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          {meal.mealType}
        </span>
      </div>
      <h4 className="font-semibold text-sm text-gray-900 line-clamp-1">{meal.recipeName}</h4>
      {meal.recipeDescription && (
        <p className="text-xs text-gray-500 mt-1 line-clamp-1">{meal.recipeDescription}</p>
      )}
      <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {(meal.prepTimeMinutes || 0) + (meal.cookTimeMinutes || 0)} min
        </span>
        <span className="flex items-center gap-1">
          <Users className="w-3 h-3" />
          {meal.servings}
        </span>
      </div>
    </div>
  );
}

/* ── Utility ── */

function getTodaysMeals(mealPlan: MealPlan | null): PlannedMeal[] {
  if (!mealPlan?.days) return [];
  const today = new Date().toISOString().split('T')[0];
  const todayPlan = mealPlan.days.find(day => day.date === today);
  return todayPlan?.meals || [];
}
