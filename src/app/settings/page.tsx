'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Settings, AlertTriangle, Heart, X, Plus, Loader2, Check, Clock } from 'lucide-react';
import Navigation from '@/components/Navigation';
import type { DietaryRestriction, UserPreferences } from '@/types';

const COMMON_RESTRICTIONS = [
  { name: 'Gluten-Free', type: 'intolerance' as const },
  { name: 'Dairy-Free', type: 'intolerance' as const },
  { name: 'Nut-Free', type: 'allergy' as const },
  { name: 'Vegetarian', type: 'preference' as const },
  { name: 'Vegan', type: 'preference' as const },
  { name: 'Shellfish-Free', type: 'allergy' as const },
  { name: 'Egg-Free', type: 'allergy' as const },
  { name: 'Soy-Free', type: 'allergy' as const },
  { name: 'No Red Meat', type: 'preference' as const },
  { name: 'PCOS-Friendly', type: 'medical' as const },
  { name: 'Low-Sodium', type: 'medical' as const },
  { name: 'Diabetic-Friendly', type: 'medical' as const }
];

const CUISINES = [
  'Italian', 'Mexican', 'Chinese', 'Japanese', 'Indian',
  'Thai', 'Mediterranean', 'American', 'French', 'Korean',
  'Vietnamese', 'Greek', 'Spanish', 'Middle Eastern', 'Caribbean'
];

const COOKING_TIMES = [
  { value: 'quick', label: 'Quick (< 30 min)', icon: '⚡' },
  { value: 'moderate', label: 'Moderate (30-60 min)', icon: '🍳' },
  { value: 'extended', label: 'Extended (60+ min)', icon: '👨‍🍳' },
  { value: 'any', label: 'Any time', icon: '⏰' }
];

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Dietary restrictions
  const [restrictions, setRestrictions] = useState<DietaryRestriction[]>([]);
  const [customRestriction, setCustomRestriction] = useState('');

  // User preferences
  const [favoriteIngredients, setFavoriteIngredients] = useState<string[]>([]);
  const [dislikedIngredients, setDislikedIngredients] = useState<string[]>([]);
  const [cuisinePreferences, setCuisinePreferences] = useState<string[]>([]);
  const [cookingTime, setCookingTime] = useState<'quick' | 'moderate' | 'extended' | 'any'>('moderate');

  // Input states
  const [newFavorite, setNewFavorite] = useState('');
  const [newDisliked, setNewDisliked] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings?familyId=demo-family&userId=demo-user');
      const data = await response.json();

      if (data.family?.dietaryRestrictions) {
        setRestrictions(data.family.dietaryRestrictions);
      }

      if (data.user?.preferences) {
        const prefs = data.user.preferences;
        setFavoriteIngredients(prefs.favoriteIngredients || []);
        setDislikedIngredients(prefs.dislikedIngredients || []);
        setCuisinePreferences(prefs.cuisinePreferences || []);
        setCookingTime(prefs.cookingTime || 'moderate');
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    setSaved(false);

    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          familyId: 'demo-family',
          userId: 'demo-user',
          dietaryRestrictions: restrictions,
          preferences: {
            favoriteIngredients,
            dislikedIngredients,
            cuisinePreferences,
            cookingTime
          }
        })
      });

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const toggleRestriction = (name: string, type: DietaryRestriction['type']) => {
    const exists = restrictions.find(r => r.name === name);
    if (exists) {
      setRestrictions(restrictions.filter(r => r.name !== name));
    } else {
      setRestrictions([...restrictions, {
        id: `${Date.now()}`,
        name,
        type,
        severity: 'moderate'
      }]);
    }
  };

  const addCustomRestriction = () => {
    if (!customRestriction.trim()) return;
    const exists = restrictions.find(r => r.name.toLowerCase() === customRestriction.toLowerCase());
    if (!exists) {
      setRestrictions([...restrictions, {
        id: `${Date.now()}`,
        name: customRestriction.trim(),
        type: 'preference',
        severity: 'moderate'
      }]);
    }
    setCustomRestriction('');
  };

  const toggleCuisine = (cuisine: string) => {
    if (cuisinePreferences.includes(cuisine)) {
      setCuisinePreferences(cuisinePreferences.filter(c => c !== cuisine));
    } else {
      setCuisinePreferences([...cuisinePreferences, cuisine]);
    }
  };

  const addIngredient = (type: 'favorite' | 'disliked') => {
    const value = type === 'favorite' ? newFavorite : newDisliked;
    const setter = type === 'favorite' ? setFavoriteIngredients : setDislikedIngredients;
    const list = type === 'favorite' ? favoriteIngredients : dislikedIngredients;
    const inputSetter = type === 'favorite' ? setNewFavorite : setNewDisliked;

    if (!value.trim()) return;
    if (!list.includes(value.trim().toLowerCase())) {
      setter([...list, value.trim().toLowerCase()]);
    }
    inputSetter('');
  };

  const removeIngredient = (ingredient: string, type: 'favorite' | 'disliked') => {
    const setter = type === 'favorite' ? setFavoriteIngredients : setDislikedIngredients;
    const list = type === 'favorite' ? favoriteIngredients : dislikedIngredients;
    setter(list.filter(i => i !== ingredient));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50">
        <Navigation />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50">
      <Navigation />

      <main className="max-w-3xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Settings className="w-8 h-8 text-orange-500" />
              Settings
            </h1>
            <p className="text-gray-600 mt-1">
              Customize your meal planning preferences
            </p>
          </div>
          <button
            onClick={saveSettings}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-3 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 disabled:opacity-50 transition-colors shadow-md"
          >
            {saving ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : saved ? (
              <Check className="w-5 h-5" />
            ) : null}
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
          </button>
        </div>

        {/* Dietary Restrictions */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-md p-6 mb-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="w-6 h-6 text-orange-500" />
            <h2 className="text-xl font-bold text-gray-900">Dietary Restrictions</h2>
          </div>
          <p className="text-gray-600 text-sm mb-4">
            Select any dietary restrictions. Recipes will be filtered to ensure safety.
          </p>

          <div className="flex flex-wrap gap-2 mb-4">
            {COMMON_RESTRICTIONS.map((restriction) => {
              const isSelected = restrictions.some(r => r.name === restriction.name);
              return (
                <button
                  key={restriction.name}
                  onClick={() => toggleRestriction(restriction.name, restriction.type)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    isSelected
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {restriction.name}
                </button>
              );
            })}
          </div>

          {/* Custom restrictions */}
          {restrictions.filter(r => !COMMON_RESTRICTIONS.some(c => c.name === r.name)).length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {restrictions
                .filter(r => !COMMON_RESTRICTIONS.some(c => c.name === r.name))
                .map((restriction) => (
                  <span
                    key={restriction.id}
                    className="flex items-center gap-1 px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm"
                  >
                    {restriction.name}
                    <button
                      onClick={() => setRestrictions(restrictions.filter(r => r.id !== restriction.id))}
                      className="ml-1 hover:text-orange-900"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
            </div>
          )}

          <div className="flex gap-2">
            <input
              type="text"
              value={customRestriction}
              onChange={(e) => setCustomRestriction(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addCustomRestriction()}
              placeholder="Add custom restriction..."
              className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:border-orange-500 focus:outline-none text-sm"
            />
            <button
              onClick={addCustomRestriction}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </motion.section>

        {/* Cuisine Preferences */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl shadow-md p-6 mb-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <Heart className="w-6 h-6 text-orange-500" />
            <h2 className="text-xl font-bold text-gray-900">Cuisine Preferences</h2>
          </div>
          <p className="text-gray-600 text-sm mb-4">
            Select your favorite cuisines for recipe suggestions.
          </p>

          <div className="flex flex-wrap gap-2">
            {CUISINES.map((cuisine) => {
              const isSelected = cuisinePreferences.includes(cuisine);
              return (
                <button
                  key={cuisine}
                  onClick={() => toggleCuisine(cuisine)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    isSelected
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {cuisine}
                </button>
              );
            })}
          </div>
        </motion.section>

        {/* Cooking Time */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl shadow-md p-6 mb-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <Clock className="w-6 h-6 text-orange-500" />
            <h2 className="text-xl font-bold text-gray-900">Cooking Time Preference</h2>
          </div>
          <p className="text-gray-600 text-sm mb-4">
            How much time do you typically have to cook?
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {COOKING_TIMES.map((time) => (
              <button
                key={time.value}
                onClick={() => setCookingTime(time.value as any)}
                className={`p-4 rounded-xl text-center transition-colors ${
                  cookingTime === time.value
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <div className="text-2xl mb-1">{time.icon}</div>
                <div className="text-sm font-medium">{time.label}</div>
              </button>
            ))}
          </div>
        </motion.section>

        {/* Favorite & Disliked Ingredients */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl shadow-md p-6"
        >
          <h2 className="text-xl font-bold text-gray-900 mb-4">Ingredient Preferences</h2>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Favorites */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Favorite Ingredients
              </label>
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={newFavorite}
                  onChange={(e) => setNewFavorite(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addIngredient('favorite')}
                  placeholder="Add ingredient..."
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:border-orange-500 focus:outline-none text-sm"
                />
                <button
                  onClick={() => addIngredient('favorite')}
                  className="px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {favoriteIngredients.map((ing) => (
                  <span
                    key={ing}
                    className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm"
                  >
                    {ing}
                    <button
                      onClick={() => removeIngredient(ing, 'favorite')}
                      className="ml-1 hover:text-green-900"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                {favoriteIngredients.length === 0 && (
                  <span className="text-sm text-gray-400">No favorites added</span>
                )}
              </div>
            </div>

            {/* Disliked */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Disliked Ingredients
              </label>
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={newDisliked}
                  onChange={(e) => setNewDisliked(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addIngredient('disliked')}
                  placeholder="Add ingredient..."
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:border-orange-500 focus:outline-none text-sm"
                />
                <button
                  onClick={() => addIngredient('disliked')}
                  className="px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {dislikedIngredients.map((ing) => (
                  <span
                    key={ing}
                    className="flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm"
                  >
                    {ing}
                    <button
                      onClick={() => removeIngredient(ing, 'disliked')}
                      className="ml-1 hover:text-red-900"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                {dislikedIngredients.length === 0 && (
                  <span className="text-sm text-gray-400">No dislikes added</span>
                )}
              </div>
            </div>
          </div>
        </motion.section>
      </main>
    </div>
  );
}
