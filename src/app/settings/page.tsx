'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Heart, X, Plus, Loader2, Check, Clock, Globe, MessageCircle, Copy, ExternalLink } from 'lucide-react';
import Navigation from '@/components/Navigation';
import type { DietaryRestriction, SupportedLanguage } from '@/types';

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
  { value: 'quick', label: 'Quick', desc: '< 30 min', icon: '⚡' },
  { value: 'moderate', label: 'Moderate', desc: '30-60 min', icon: '🍳' },
  { value: 'extended', label: 'Extended', desc: '60+ min', icon: '👨‍🍳' },
  { value: 'any', label: 'Any', desc: 'No limit', icon: '⏰' }
];

const LANGUAGES: { value: SupportedLanguage; label: string; flag: string }[] = [
  { value: 'en', label: 'English', flag: '🇬🇧' },
  { value: 'hu', label: 'Magyar', flag: '🇭🇺' },
  { value: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { value: 'es', label: 'Español', flag: '🇪🇸' },
  { value: 'fr', label: 'Français', flag: '🇫🇷' },
  { value: 'it', label: 'Italiano', flag: '🇮🇹' }
];

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  // Dietary restrictions
  const [restrictions, setRestrictions] = useState<DietaryRestriction[]>([]);
  const [customRestriction, setCustomRestriction] = useState('');

  // User preferences
  const [favoriteIngredients, setFavoriteIngredients] = useState<string[]>([]);
  const [dislikedIngredients, setDislikedIngredients] = useState<string[]>([]);
  const [cuisinePreferences, setCuisinePreferences] = useState<string[]>([]);
  const [cookingTime, setCookingTime] = useState<'quick' | 'moderate' | 'extended' | 'any'>('moderate');
  const [targetLanguage, setTargetLanguage] = useState<SupportedLanguage>('en');

  // Input states
  const [newFavorite, setNewFavorite] = useState('');
  const [newDisliked, setNewDisliked] = useState('');

  // Telegram integration
  const familyId = 'demo-family'; // In production, get from auth context
  // Use the bot username from env, fallback to the configured one
  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'mealmind_helper_bot';
  // For demo, use 'demo' payload; for real users, use 'family_' prefix
  const telegramDeepLink = `https://t.me/${botUsername}?start=demo`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
        setTargetLanguage(prefs.targetLanguage || 'en');
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
            cookingTime,
            targetLanguage
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
      <div className="min-h-screen bg-[#F9FAFB]">
        <Navigation />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-[#6B7280] animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <Navigation />

      <main className="max-w-3xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-3xl">⚙️</span>
              <h1 className="text-3xl font-bold text-[#1F2937]">Settings</h1>
            </div>
            <p className="text-[#6B7280] ml-12">
              Customize your meal planning preferences
            </p>
          </div>
          <button
            onClick={saveSettings}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-[#1F2937] text-white rounded-md font-medium hover:bg-[#2F2D2A] disabled:opacity-50 transition-colors"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : saved ? (
              <Check className="w-4 h-4" />
            ) : null}
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
          </button>
        </div>

        {/* Telegram Integration */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-[#E5E7EB] rounded-lg p-5 mb-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <MessageCircle className="w-5 h-5 text-[#0EA5E9]" />
            <h2 className="text-lg font-semibold text-[#1F2937]">Telegram Integration</h2>
          </div>
          <p className="text-[#6B7280] text-sm mb-4">
            Connect your Telegram to access meal plans, shopping lists, and ask questions on the go.
          </p>

          <div className="space-y-3">
            {/* Deep Link Button */}
            <a
              href={telegramDeepLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-[#0EA5E9] text-white rounded-md font-medium hover:bg-[#0284C7] transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Open Telegram & Connect
            </a>

            {/* Manual Command */}
            <div className="pt-2 border-t border-[#E5E7EB]">
              <p className="text-xs text-[#6B7280] mb-2">
                Or manually connect by sending this command to @{botUsername}:
              </p>
              <div className="flex gap-2">
                <code className="flex-1 px-3 py-2 bg-[#F3F4F6] text-[#1F2937] rounded-md text-sm font-mono">
                  /setfamily {familyId}
                </code>
                <button
                  onClick={() => copyToClipboard(`/setfamily ${familyId}`)}
                  className="px-3 py-2 bg-[#F3F4F6] text-[#1F2937] rounded-md hover:bg-[#E5E7EB] transition-colors"
                  title="Copy command"
                >
                  {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Dietary Restrictions */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white border border-[#E5E7EB] rounded-lg p-5 mb-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-[#EB5757]" />
            <h2 className="text-lg font-semibold text-[#1F2937]">Dietary Restrictions</h2>
          </div>
          <p className="text-[#6B7280] text-sm mb-4">
            Select any dietary restrictions. Recipes will be filtered to ensure safety.
          </p>

          <div className="flex flex-wrap gap-2 mb-4">
            {COMMON_RESTRICTIONS.map((restriction) => {
              const isSelected = restrictions.some(r => r.name === restriction.name);
              return (
                <button
                  key={restriction.name}
                  onClick={() => toggleRestriction(restriction.name, restriction.type)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    isSelected
                      ? 'bg-[#1F2937] text-white'
                      : 'bg-[#F3F4F6] text-[#1F2937] hover:bg-[#E5E7EB]'
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
                    className="flex items-center gap-1 px-2.5 py-1 bg-[#DDEBF1] text-[#0B6E99] rounded-md text-sm"
                  >
                    {restriction.name}
                    <button
                      onClick={() => setRestrictions(restrictions.filter(r => r.id !== restriction.id))}
                      className="ml-1 hover:text-[#084B6A]"
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
              className="flex-1 px-3 py-2 bg-white border border-[#E5E7EB] rounded-md focus:border-[#1F2937] focus:outline-none text-sm"
            />
            <button
              onClick={addCustomRestriction}
              className="px-3 py-2 bg-[#F3F4F6] text-[#1F2937] rounded-md hover:bg-[#E5E7EB] transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </motion.section>

        {/* Cuisine Preferences */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white border border-[#E5E7EB] rounded-lg p-5 mb-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <Heart className="w-5 h-5 text-[#EB5757]" />
            <h2 className="text-lg font-semibold text-[#1F2937]">Cuisine Preferences</h2>
          </div>
          <p className="text-[#6B7280] text-sm mb-4">
            Select your favorite cuisines for recipe suggestions.
          </p>

          <div className="flex flex-wrap gap-2">
            {CUISINES.map((cuisine) => {
              const isSelected = cuisinePreferences.includes(cuisine);
              return (
                <button
                  key={cuisine}
                  onClick={() => toggleCuisine(cuisine)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    isSelected
                      ? 'bg-[#1F2937] text-white'
                      : 'bg-[#F3F4F6] text-[#1F2937] hover:bg-[#E5E7EB]'
                  }`}
                >
                  {cuisine}
                </button>
              );
            })}
          </div>
        </motion.section>

        {/* Language Preference */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white border border-[#E5E7EB] rounded-lg p-5 mb-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <Globe className="w-5 h-5 text-[#0EA5E9]" />
            <h2 className="text-lg font-semibold text-[#1F2937]">Recipe Language</h2>
          </div>
          <p className="text-[#6B7280] text-sm mb-4">
            All AI-generated recipes will be in this language.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.value}
                onClick={() => setTargetLanguage(lang.value)}
                className={`p-3 rounded-md text-center transition-colors ${
                  targetLanguage === lang.value
                    ? 'bg-[#1F2937] text-white'
                    : 'bg-[#F3F4F6] text-[#1F2937] hover:bg-[#E5E7EB]'
                }`}
              >
                <div className="text-xl mb-1">{lang.flag}</div>
                <div className="text-sm font-medium">{lang.label}</div>
              </button>
            ))}
          </div>
        </motion.section>

        {/* Cooking Time */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white border border-[#E5E7EB] rounded-lg p-5 mb-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-5 h-5 text-[#0EA5E9]" />
            <h2 className="text-lg font-semibold text-[#1F2937]">Cooking Time Preference</h2>
          </div>
          <p className="text-[#6B7280] text-sm mb-4">
            How much time do you typically have to cook?
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {COOKING_TIMES.map((time) => (
              <button
                key={time.value}
                onClick={() => setCookingTime(time.value as any)}
                className={`p-3 rounded-md text-center transition-colors ${
                  cookingTime === time.value
                    ? 'bg-[#1F2937] text-white'
                    : 'bg-[#F3F4F6] text-[#1F2937] hover:bg-[#E5E7EB]'
                }`}
              >
                <div className="text-xl mb-1">{time.icon}</div>
                <div className="text-sm font-medium">{time.label}</div>
                <div className="text-xs opacity-70">{time.desc}</div>
              </button>
            ))}
          </div>
        </motion.section>

        {/* Favorite & Disliked Ingredients */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white border border-[#E5E7EB] rounded-lg p-5"
        >
          <h2 className="text-lg font-semibold text-[#1F2937] mb-4">Ingredient Preferences</h2>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Favorites */}
            <div>
              <label className="block text-sm font-medium text-[#1F2937] mb-2">
                Favorite Ingredients
              </label>
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={newFavorite}
                  onChange={(e) => setNewFavorite(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addIngredient('favorite')}
                  placeholder="Add ingredient..."
                  className="flex-1 px-3 py-2 bg-white border border-[#E5E7EB] rounded-md focus:border-[#1F2937] focus:outline-none text-sm"
                />
                <button
                  onClick={() => addIngredient('favorite')}
                  className="px-3 py-2 bg-[#DBEDDB] text-[#1E7C45] rounded-md hover:bg-[#C8E4C8] transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {favoriteIngredients.map((ing) => (
                  <span
                    key={ing}
                    className="flex items-center gap-1 px-2.5 py-1 bg-[#DBEDDB] text-[#1E7C45] rounded-md text-sm"
                  >
                    {ing}
                    <button
                      onClick={() => removeIngredient(ing, 'favorite')}
                      className="ml-1 hover:text-[#156534]"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                {favoriteIngredients.length === 0 && (
                  <span className="text-sm text-[#6B7280]">No favorites added</span>
                )}
              </div>
            </div>

            {/* Disliked */}
            <div>
              <label className="block text-sm font-medium text-[#1F2937] mb-2">
                Disliked Ingredients
              </label>
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={newDisliked}
                  onChange={(e) => setNewDisliked(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addIngredient('disliked')}
                  placeholder="Add ingredient..."
                  className="flex-1 px-3 py-2 bg-white border border-[#E5E7EB] rounded-md focus:border-[#1F2937] focus:outline-none text-sm"
                />
                <button
                  onClick={() => addIngredient('disliked')}
                  className="px-3 py-2 bg-[#FDEBEC] text-[#EB5757] rounded-md hover:bg-[#FBD4D7] transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {dislikedIngredients.map((ing) => (
                  <span
                    key={ing}
                    className="flex items-center gap-1 px-2.5 py-1 bg-[#FDEBEC] text-[#EB5757] rounded-md text-sm"
                  >
                    {ing}
                    <button
                      onClick={() => removeIngredient(ing, 'disliked')}
                      className="ml-1 hover:text-[#C93C3C]"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                {dislikedIngredients.length === 0 && (
                  <span className="text-sm text-[#6B7280]">No dislikes added</span>
                )}
              </div>
            </div>
          </div>
        </motion.section>
      </main>
    </div>
  );
}
