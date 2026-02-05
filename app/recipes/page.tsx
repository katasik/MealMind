'use client';

import { useEffect, useState } from 'react';
import { Plus, Search, Loader2 } from 'lucide-react';
import RecipeCard from '@/components/RecipeCard';
import RecipeModal from '@/components/RecipeModal';
import AddRecipeModal from '@/components/AddRecipeModal';
import { getFamilyRecipes, deleteRecipe, initializeDemoFamily } from '@/lib/firebase';
import type { Recipe, MealType } from '@/lib/types';

export default function RecipesPage() {
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [filterMealType, setFilterMealType] = useState<MealType | 'all'>('all');

  useEffect(() => {
    loadRecipes();
  }, []);

  const loadRecipes = async () => {
    setIsLoading(true);
    try {
      const id = await initializeDemoFamily();
      setFamilyId(id);
      const data = await getFamilyRecipes(id);
      setRecipes(data as Recipe[]);
    } catch (error) {
      console.error('Failed to load recipes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteRecipe = async (recipeId: string) => {
    if (!confirm('Are you sure you want to delete this recipe?')) return;

    try {
      await deleteRecipe(recipeId);
      setRecipes(recipes.filter((r) => r.id !== recipeId));
    } catch (error) {
      console.error('Failed to delete recipe:', error);
    }
  };

  const handleRecipeAdded = (recipe: Recipe) => {
    setRecipes([recipe, ...recipes]);
    setShowAddModal(false);
  };

  // Filter recipes
  const filteredRecipes = recipes.filter((recipe) => {
    const matchesSearch =
      searchQuery === '' ||
      recipe.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      recipe.cuisine?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      recipe.tags?.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesMealType =
      filterMealType === 'all' || recipe.mealTypes?.includes(filterMealType);

    return matchesSearch && matchesMealType;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-12 h-12 text-primary-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Recipe Library</h1>
          <p className="text-gray-500">
            {recipes.length} recipe{recipes.length !== 1 ? 's' : ''} saved
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center space-x-2 bg-primary-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span>Add Recipe</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search recipes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>

        {/* Meal type filter */}
        <select
          value={filterMealType}
          onChange={(e) => setFilterMealType(e.target.value as MealType | 'all')}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        >
          <option value="all">All Meals</option>
          <option value="breakfast">Breakfast</option>
          <option value="lunch">Lunch</option>
          <option value="dinner">Dinner</option>
          <option value="snack">Snack</option>
        </select>
      </div>

      {/* Recipe grid */}
      {filteredRecipes.length === 0 ? (
        <div className="text-center py-12">
          {recipes.length === 0 ? (
            <>
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
                <span className="text-3xl">📖</span>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">No Recipes Yet</h2>
              <p className="text-gray-500 mb-6 max-w-md mx-auto">
                Start building your recipe library by importing recipes from URLs or pasting them
                directly.
              </p>
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center space-x-2 bg-primary-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-primary-700 transition-colors"
              >
                <Plus className="w-5 h-5" />
                <span>Add Your First Recipe</span>
              </button>
            </>
          ) : (
            <>
              <p className="text-gray-500">No recipes match your search criteria.</p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setFilterMealType('all');
                }}
                className="mt-4 text-primary-600 hover:text-primary-700 font-medium"
              >
                Clear filters
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredRecipes.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              onClick={() => setSelectedRecipe(recipe)}
              onDelete={() => handleDeleteRecipe(recipe.id)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {selectedRecipe && (
        <RecipeModal
          recipe={selectedRecipe}
          onClose={() => setSelectedRecipe(null)}
        />
      )}

      {showAddModal && familyId && (
        <AddRecipeModal
          familyId={familyId}
          onClose={() => setShowAddModal(false)}
          onSuccess={handleRecipeAdded}
        />
      )}
    </div>
  );
}
