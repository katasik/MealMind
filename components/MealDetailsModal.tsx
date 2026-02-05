'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, Users, RefreshCw, Search, Loader2 } from 'lucide-react';
import { getTotalTime } from '@/lib/utils';
import { getFamilyRecipes } from '@/lib/firebase';
import type { PlannedMeal, Recipe, MealType } from '@/lib/types';

interface MealDetailsModalProps {
  meal: PlannedMeal;
  familyId: string;
  onClose: () => void;
  onReplace?: (recipe: Recipe) => void;
}

const mealTypeStyles = {
  breakfast: 'bg-[#FAEBDD] text-[#B4540A]',
  lunch: 'bg-[#DBEDDB] text-[#2B7A6C]',
  dinner: 'bg-[#F5E0E9] text-[#B35F2A]',
  snack: 'bg-[#E8DEEE] text-[#6940A5]'
};

export default function MealDetailsModal({
  meal,
  familyId,
  onClose,
  onReplace
}: MealDetailsModalProps) {
  const [showReplacePicker, setShowReplacePicker] = useState(false);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isLoadingRecipes, setIsLoadingRecipes] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const totalTime = getTotalTime(meal.prepTimeMinutes, meal.cookTimeMinutes);

  useEffect(() => {
    if (showReplacePicker) {
      loadRecipes();
    }
  }, [showReplacePicker]);

  const loadRecipes = async () => {
    setIsLoadingRecipes(true);
    try {
      const data = await getFamilyRecipes(familyId);
      const filtered = (data as Recipe[]).filter(recipe =>
        recipe.mealTypes?.includes(meal.mealType as MealType)
      );
      setRecipes(filtered);
    } catch (error) {
      console.error('Failed to load recipes:', error);
    } finally {
      setIsLoadingRecipes(false);
    }
  };

  const handleReplaceRecipe = (recipe: Recipe) => {
    if (onReplace) {
      onReplace(recipe);
    }
    onClose();
  };

  const filteredRecipes = recipes.filter((recipe) => {
    if (searchQuery === '') return true;
    return (
      recipe.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      recipe.cuisine?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      recipe.tags?.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  });

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 10 }}
          transition={{ duration: 0.15 }}
          className="bg-[#F9FAFB] rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-[#E5E7EB]"
        >
          {showReplacePicker ? (
            /* Recipe Replacement View */
            <>
              {/* Header */}
              <div className="flex items-start justify-between p-5 border-b border-[#E5E7EB] flex-shrink-0">
                <div className="flex-1 pr-4">
                  <h2 className="text-xl font-semibold text-[#1F2937]">Replace Recipe</h2>
                  <p className="text-[#6B7280] text-sm mt-1">
                    Choose a {meal.mealType} recipe from your collection
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 hover:bg-[#F3F4F6] rounded transition-colors"
                >
                  <X className="w-5 h-5 text-[#6B7280]" />
                </button>
              </div>

              {/* Search */}
              <div className="px-5 py-4 border-b border-[#E5E7EB] flex-shrink-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
                  <input
                    type="text"
                    placeholder="Search recipes..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-[#E5E7EB] rounded-md focus:ring-2 focus:ring-[#1F2937] focus:border-[#1F2937] bg-white text-sm"
                  />
                </div>
              </div>

              {/* Recipe Grid */}
              <div className="flex-1 overflow-y-auto p-5">
                {isLoadingRecipes ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 text-[#6B7280] animate-spin" />
                  </div>
                ) : filteredRecipes.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-[#6B7280] text-sm">
                      {recipes.length === 0
                        ? `No ${meal.mealType} recipes in your collection yet.`
                        : 'No recipes match your search.'
                      }
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filteredRecipes.map((recipe) => (
                      <RecipePickerCard
                        key={recipe.id}
                        recipe={recipe}
                        onClick={() => handleReplaceRecipe(recipe)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-5 py-4 border-t border-[#E5E7EB] flex gap-3 flex-shrink-0">
                <button
                  onClick={() => setShowReplacePicker(false)}
                  className="flex-1 py-2.5 bg-[#1F2937] text-white rounded-md font-medium hover:bg-[#2F2D2A] transition-colors"
                >
                  Back to Meal Details
                </button>
              </div>
            </>
          ) : (
            /* Meal Details View */
            <>
              {/* Image */}
              {meal.imageUrl && (
                <div className="h-48 w-full bg-[#F3F4F6] overflow-hidden relative flex-shrink-0">
                  <img
                    src={meal.imageUrl}
                    alt={meal.recipeName}
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={onClose}
                    className="absolute top-3 right-3 p-1.5 bg-white/90 hover:bg-white rounded-md transition-colors shadow-sm"
                  >
                    <X className="w-5 h-5 text-[#6B7280]" />
                  </button>
                </div>
              )}

              {/* Header */}
              <div className={`flex items-start justify-between p-5 border-b border-[#E5E7EB] ${meal.imageUrl ? '' : ''}`}>
                <div className="flex-1 pr-4">
                  <div className="flex items-center gap-2 mb-2">
                    {meal.cuisine && (
                      <span className="text-xs font-medium text-[#6B7280] bg-[#F3F4F6] px-2 py-0.5 rounded">
                        {meal.cuisine}
                      </span>
                    )}
                    <span className={`text-xs font-medium px-2 py-0.5 rounded capitalize ${mealTypeStyles[meal.mealType] || 'bg-[#F3F4F6] text-[#6B7280]'}`}>
                      {meal.mealType}
                    </span>
                  </div>
                  <h2 className="text-xl font-semibold text-[#1F2937]">{meal.recipeName}</h2>
                  {meal.recipeDescription && (
                    <p className="text-[#6B7280] text-sm mt-1">{meal.recipeDescription}</p>
                  )}
                </div>
                {!meal.imageUrl && (
                  <button
                    onClick={onClose}
                    className="p-1.5 hover:bg-[#F3F4F6] rounded transition-colors"
                  >
                    <X className="w-5 h-5 text-[#6B7280]" />
                  </button>
                )}
              </div>

              {/* Meta Info */}
              <div className="flex items-center gap-4 px-5 py-3 bg-[#F3F4F6] border-b border-[#E5E7EB] text-sm flex-wrap">
                <div className="flex items-center gap-1.5 text-[#1F2937]">
                  <Clock className="w-4 h-4 text-[#6B7280]" />
                  <span>
                    <strong>{totalTime}</strong> min
                    {meal.prepTimeMinutes > 0 && meal.cookTimeMinutes > 0 && (
                      <span className="text-[#6B7280] ml-1">
                        ({meal.prepTimeMinutes} prep + {meal.cookTimeMinutes} cook)
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[#1F2937]">
                  <Users className="w-4 h-4 text-[#6B7280]" />
                  <span><strong>{meal.servings}</strong> servings</span>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-5">
                {/* Ingredients */}
                <div className="mb-6">
                  <h3 className="font-medium text-[#1F2937] mb-3 text-sm uppercase tracking-wide">
                    Ingredients
                  </h3>
                  <ul className="space-y-2">
                    {meal.ingredients.map((ing, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="w-1.5 h-1.5 bg-[#1F2937] rounded-full mt-2 flex-shrink-0 opacity-40" />
                        <span className="text-[#1F2937]">
                          {ing.amount && ing.amount > 0 && (
                            <>
                              <span className="font-medium">{ing.amount} {ing.unit}</span>{' '}
                            </>
                          )}
                          {ing.name}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Instructions */}
                <div className="mb-6">
                  <h3 className="font-medium text-[#1F2937] mb-3 text-sm uppercase tracking-wide">
                    Instructions
                  </h3>
                  <ol className="space-y-3">
                    {meal.instructions.map((step, i) => (
                      <li key={i} className="flex gap-3 text-sm">
                        <span className="w-5 h-5 bg-[#F3F4F6] text-[#6B7280] rounded flex items-center justify-center text-xs font-medium flex-shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        <span className="text-[#1F2937]">{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>

              {/* Footer */}
              <div className="px-5 py-4 border-t border-[#E5E7EB] flex gap-3 flex-shrink-0">
                {onReplace && (
                  <button
                    onClick={() => setShowReplacePicker(true)}
                    className="flex-1 py-2.5 bg-white text-[#1F2937] border border-[#E5E7EB] rounded-md font-medium hover:bg-[#F3F4F6] transition-colors flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Replace Recipe
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 bg-[#1F2937] text-white rounded-md font-medium hover:bg-[#2F2D2A] transition-colors"
                >
                  Close
                </button>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

// Recipe Picker Card Component
function RecipePickerCard({
  recipe,
  onClick
}: {
  recipe: Recipe;
  onClick: () => void;
}) {
  const totalTime = getTotalTime(recipe.prepTimeMinutes, recipe.cookTimeMinutes);

  const difficultyStyles = {
    easy: 'bg-[#DBEDDB] text-[#1E7C45]',
    medium: 'bg-[#FDF0D5] text-[#B4540A]',
    hard: 'bg-[#FDEBEC] text-[#EB5757]'
  };

  return (
    <div
      onClick={onClick}
      className="bg-white border border-[#E5E7EB] rounded-lg overflow-hidden hover:border-[#1F2937] hover:shadow-sm transition-all cursor-pointer flex flex-col"
    >
      {/* Image */}
      <div className="h-28 w-full bg-[#F3F4F6] overflow-hidden relative">
        {recipe.imageUrl ? (
          <img
            src={recipe.imageUrl}
            alt={recipe.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              const placeholder = e.currentTarget.nextElementSibling;
              if (placeholder) {
                placeholder.classList.remove('hidden');
              }
            }}
          />
        ) : null}
        <div className={`absolute inset-0 bg-gradient-to-br from-[#F3F4F6] to-[#E5E7EB] flex items-center justify-center ${recipe.imageUrl ? 'hidden' : ''}`}>
          <span className="text-3xl opacity-40">🍽️</span>
        </div>
      </div>

      {/* Content */}
      <div className="p-3 flex-1 flex flex-col">
        {/* Tags row */}
        <div className="flex items-center gap-1 mb-2 flex-wrap">
          {recipe.cuisine && (
            <span className="text-[10px] font-medium text-[#6B7280] bg-[#F3F4F6] px-2 py-0.5 rounded">
              {recipe.cuisine}
            </span>
          )}
          {recipe.difficulty && (
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded capitalize ${difficultyStyles[recipe.difficulty] || 'bg-[#F3F4F6] text-[#6B7280]'}`}>
              {recipe.difficulty}
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="font-semibold text-[#1F2937] text-sm mb-1 line-clamp-2">
          {recipe.name}
        </h3>

        {/* Description */}
        <p className="text-xs text-[#6B7280] mb-2 line-clamp-2 flex-1">
          {recipe.description || 'A delicious recipe to try!'}
        </p>

        {/* Stats */}
        <div className="flex items-center gap-3 text-xs text-[#6B7280]">
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>{totalTime}</span>
          </div>
          <div className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            <span>{recipe.servings ?? '-'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
