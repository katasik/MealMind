'use client';

import { useEffect, useState } from 'react';
import { Save, Plus, X, Loader2, Check } from 'lucide-react';
import {
  getFamilyMembers,
  getFamilyPreferences,
  saveFamilyPreferences,
  addFamilyMember,
  updateFamilyMember,
  deleteFamilyMember,
  initializeDemoFamily,
} from '@/lib/firebase';
import { cn, DIETARY_RESTRICTIONS, CUISINES, COOKING_TIME_OPTIONS } from '@/lib/utils';
import type { FamilyMember, UserPreferences } from '@/lib/types';

export default function SettingsPage() {
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [preferences, setPreferences] = useState<UserPreferences>({
    favoriteIngredients: [],
    dislikedIngredients: [],
    cuisinePreferences: [],
    cookingTimePreference: 'any',
    targetLanguage: 'en',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // New member form
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberRestrictions, setNewMemberRestrictions] = useState<string[]>([]);

  // Ingredient inputs
  const [newFavorite, setNewFavorite] = useState('');
  const [newDisliked, setNewDisliked] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const id = await initializeDemoFamily();
      setFamilyId(id);

      const [membersData, prefsData] = await Promise.all([
        getFamilyMembers(id),
        getFamilyPreferences(id),
      ]);

      setMembers(membersData as FamilyMember[]);
      setPreferences(prefsData);
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSavePreferences = async () => {
    if (!familyId) return;

    setIsSaving(true);
    try {
      await saveFamilyPreferences(familyId, preferences);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to save preferences:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddMember = async () => {
    if (!familyId || !newMemberName.trim()) return;

    try {
      const memberId = await addFamilyMember(familyId, {
        name: newMemberName.trim(),
        dietaryRestrictions: newMemberRestrictions,
      });
      setMembers([
        ...members,
        {
          id: memberId,
          name: newMemberName.trim(),
          dietaryRestrictions: newMemberRestrictions,
        },
      ]);
      setNewMemberName('');
      setNewMemberRestrictions([]);
    } catch (error) {
      console.error('Failed to add member:', error);
    }
  };

  const handleUpdateMemberRestrictions = async (
    memberId: string,
    restrictions: string[]
  ) => {
    if (!familyId) return;

    try {
      await updateFamilyMember(familyId, memberId, { dietaryRestrictions: restrictions });
      setMembers(
        members.map((m) =>
          m.id === memberId ? { ...m, dietaryRestrictions: restrictions } : m
        )
      );
    } catch (error) {
      console.error('Failed to update member:', error);
    }
  };

  const handleDeleteMember = async (memberId: string) => {
    if (!familyId || !confirm('Remove this family member?')) return;

    try {
      await deleteFamilyMember(familyId, memberId);
      setMembers(members.filter((m) => m.id !== memberId));
    } catch (error) {
      console.error('Failed to delete member:', error);
    }
  };

  const addIngredient = (type: 'favorite' | 'disliked') => {
    const value = type === 'favorite' ? newFavorite : newDisliked;
    if (!value.trim()) return;

    const key = type === 'favorite' ? 'favoriteIngredients' : 'dislikedIngredients';
    if (!preferences[key].includes(value.trim())) {
      setPreferences({
        ...preferences,
        [key]: [...preferences[key], value.trim()],
      });
    }

    if (type === 'favorite') setNewFavorite('');
    else setNewDisliked('');
  };

  const removeIngredient = (type: 'favorite' | 'disliked', ingredient: string) => {
    const key = type === 'favorite' ? 'favoriteIngredients' : 'dislikedIngredients';
    setPreferences({
      ...preferences,
      [key]: preferences[key].filter((i) => i !== ingredient),
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-12 h-12 text-primary-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500">Manage your family preferences and dietary restrictions</p>
      </div>

      {/* Family Members */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Family Members</h2>

        <div className="space-y-4">
          {members.map((member) => (
            <div
              key={member.id}
              className="border border-gray-200 rounded-lg p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-gray-900">{member.name}</h3>
                <button
                  onClick={() => handleDeleteMember(member.id)}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {DIETARY_RESTRICTIONS.map((restriction) => {
                  const isSelected = member.dietaryRestrictions.includes(restriction.id);
                  return (
                    <button
                      key={restriction.id}
                      onClick={() => {
                        const newRestrictions = isSelected
                          ? member.dietaryRestrictions.filter((r) => r !== restriction.id)
                          : [...member.dietaryRestrictions, restriction.id];
                        handleUpdateMemberRestrictions(member.id, newRestrictions);
                      }}
                      className={cn(
                        'px-3 py-1 rounded-full text-sm font-medium transition-colors',
                        isSelected
                          ? 'bg-primary-100 text-primary-700 border-2 border-primary-300'
                          : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200'
                      )}
                    >
                      {restriction.icon} {restriction.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Add member form */}
          <div className="border border-dashed border-gray-300 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Add Family Member</h4>
            <div className="flex gap-2">
              <input
                type="text"
                value={newMemberName}
                onChange={(e) => setNewMemberName(e.target.value)}
                placeholder="Name"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
              <button
                onClick={handleAddMember}
                disabled={!newMemberName.trim()}
                className="inline-flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                <span>Add</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Cuisine Preferences */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Cuisine Preferences</h2>
        <div className="flex flex-wrap gap-2">
          {CUISINES.map((cuisine) => {
            const isSelected = preferences.cuisinePreferences.includes(cuisine);
            return (
              <button
                key={cuisine}
                onClick={() => {
                  setPreferences({
                    ...preferences,
                    cuisinePreferences: isSelected
                      ? preferences.cuisinePreferences.filter((c) => c !== cuisine)
                      : [...preferences.cuisinePreferences, cuisine],
                  });
                }}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  isSelected
                    ? 'bg-primary-100 text-primary-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
              >
                {cuisine}
              </button>
            );
          })}
        </div>
      </section>

      {/* Cooking Time */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Cooking Time Preference</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {COOKING_TIME_OPTIONS.map((option) => (
            <button
              key={option.id}
              onClick={() =>
                setPreferences({
                  ...preferences,
                  cookingTimePreference: option.id as UserPreferences['cookingTimePreference'],
                })
              }
              className={cn(
                'px-4 py-3 rounded-lg text-sm font-medium transition-colors text-center',
                preferences.cookingTimePreference === option.id
                  ? 'bg-primary-100 text-primary-700 border-2 border-primary-300'
                  : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      {/* Ingredients */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Ingredient Preferences</h2>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Favorites */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Favorite Ingredients</h3>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newFavorite}
                onChange={(e) => setNewFavorite(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addIngredient('favorite')}
                placeholder="Add ingredient"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
              <button
                onClick={() => addIngredient('favorite')}
                className="px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-wrap gap-1">
              {preferences.favoriteIngredients.map((ing) => (
                <span
                  key={ing}
                  className="inline-flex items-center space-x-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-sm"
                >
                  <span>{ing}</span>
                  <button
                    onClick={() => removeIngredient('favorite', ing)}
                    className="hover:text-green-900"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Disliked */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Disliked Ingredients</h3>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newDisliked}
                onChange={(e) => setNewDisliked(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addIngredient('disliked')}
                placeholder="Add ingredient"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
              <button
                onClick={() => addIngredient('disliked')}
                className="px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-wrap gap-1">
              {preferences.dislikedIngredients.map((ing) => (
                <span
                  key={ing}
                  className="inline-flex items-center space-x-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-sm"
                >
                  <span>{ing}</span>
                  <button
                    onClick={() => removeIngredient('disliked', ing)}
                    className="hover:text-red-900"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Save button */}
      <div className="flex items-center justify-end space-x-4">
        {showSuccess && (
          <span className="inline-flex items-center space-x-1 text-green-600">
            <Check className="w-4 h-4" />
            <span>Saved!</span>
          </span>
        )}
        <button
          onClick={handleSavePreferences}
          disabled={isSaving}
          className="inline-flex items-center space-x-2 px-6 py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors disabled:opacity-50"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>Save Preferences</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
