'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Clock, Users, ChefHat, Check } from 'lucide-react';
import type { Recipe, MealType } from '@/types';

interface RecipeSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (recipe: Recipe) => void;
  mealType: MealType;
  currentRecipeName?: string;
}

const mealTypeLabels: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack'
};

export default function RecipeSelectModal({
  isOpen,
  onClose,
  onSelect,
  mealType,
  currentRecipeName
}: RecipeSelectModalProps) {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchRecipes();
    }
  }, [isOpen]);

  const fetchRecipes = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/recipes?familyId=demo-family');
      const data = await response.json();
      if (data.recipes) {
        setRecipes(data.recipes);
      }
    } catch (error) {
      console.error('Failed to fetch recipes:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredRecipes = recipes.filter(recipe => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      recipe.name.toLowerCase().includes(query) ||
      recipe.description?.toLowerCase().includes(query) ||
      recipe.cuisine?.toLowerCase().includes(query) ||
      recipe.tags?.some(tag => tag.toLowerCase().includes(query))
    );
  });

  const handleSelect = () => {
    if (selectedRecipe) {
      onSelect(selectedRecipe);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col border border-[#E9E9E7]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#E9E9E7]">
            <div>
              <h2 className="text-lg font-semibold text-[#37352F]">
                Choose {mealTypeLabels[mealType]}
              </h2>
              {currentRecipeName && (
                <p className="text-sm text-[#787774]">
                  Replacing: {currentRecipeName}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 text-[#787774] hover:text-[#37352F] hover:bg-[#F7F6F3] rounded-md transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Search */}
          <div className="px-5 py-3 border-b border-[#E9E9E7]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#787774]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search your recipes..."
                className="w-full pl-10 pr-4 py-2 bg-[#F7F6F3] border border-[#E9E9E7] rounded-md focus:border-[#37352F] focus:outline-none text-sm placeholder:text-[#9B9A97]"
              />
            </div>
          </div>

          {/* Recipe List */}
          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-[#37352F] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredRecipes.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-4xl mb-3">📝</div>
                <p className="text-[#787774]">
                  {searchQuery ? 'No recipes match your search' : 'No saved recipes yet'}
                </p>
              </div>
            ) : (
              <div className="grid gap-3">
                {filteredRecipes.map((recipe) => (
                  <div
                    key={recipe.id}
                    onClick={() => setSelectedRecipe(recipe)}
                    className={`flex gap-4 p-3 rounded-lg border cursor-pointer transition-all ${
                      selectedRecipe?.id === recipe.id
                        ? 'border-[#37352F] bg-[#F7F6F3]'
                        : 'border-[#E9E9E7] hover:border-[#D3D3D0] hover:bg-[#FBFBFA]'
                    }`}
                  >
                    {/* Image */}
                    {recipe.imageUrl ? (
                      <div className="w-20 h-20 rounded-md overflow-hidden flex-shrink-0 bg-[#F7F6F3]">
                        <img
                          src={recipe.imageUrl}
                          alt={recipe.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-20 h-20 rounded-md bg-[#F7F6F3] flex items-center justify-center flex-shrink-0">
                        <span className="text-2xl">🍽️</span>
                      </div>
                    )}

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-medium text-[#37352F] line-clamp-1">
                          {recipe.name}
                        </h3>
                        {selectedRecipe?.id === recipe.id && (
                          <div className="w-5 h-5 bg-[#37352F] rounded-full flex items-center justify-center flex-shrink-0">
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-[#787774] line-clamp-2 mt-0.5">
                        {recipe.description || 'A delicious recipe'}
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-[#787774]">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{(recipe.prepTime || 0) + (recipe.cookTime || 0)} min</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          <span>{recipe.servings}</span>
                        </div>
                        {recipe.difficulty && (
                          <div className="flex items-center gap-1">
                            <ChefHat className="w-3 h-3" />
                            <span className="capitalize">{recipe.difficulty}</span>
                          </div>
                        )}
                        {recipe.cuisine && (
                          <span className="text-[#9B9A97]">{recipe.cuisine}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-[#E9E9E7] bg-[#F7F6F3]">
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 text-[#37352F] bg-white border border-[#E9E9E7] rounded-md font-medium hover:bg-[#FBFBFA] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSelect}
                disabled={!selectedRecipe}
                className="flex-1 py-2.5 bg-[#37352F] text-white rounded-md font-medium hover:bg-[#2F2D2A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Use This Recipe
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
