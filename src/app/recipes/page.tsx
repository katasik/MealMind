'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, ChefHat, Loader2, BookOpen } from 'lucide-react';
import type { Recipe } from '@/types';
import RecipeCard from '@/components/RecipeCard';
import AddRecipeModal from '@/components/AddRecipeModal';
import RecipeDetailModal from '@/components/RecipeDetailModal';
import Navigation from '@/components/Navigation';

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchRecipes = async () => {
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

  useEffect(() => {
    fetchRecipes();
  }, []);

  const handleSaveRecipes = async (parsedRecipes: any[]) => {
    for (const recipe of parsedRecipes) {
      await fetch('/api/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipe,
          familyId: 'demo-family',
          userId: 'demo-user',
          userName: 'Demo User'
        })
      });
    }
    await fetchRecipes();
  };

  const handleDeleteRecipe = async (recipeId: string) => {
    if (!confirm('Are you sure you want to delete this recipe?')) return;

    setDeleting(recipeId);
    try {
      const response = await fetch(`/api/recipes?recipeId=${recipeId}&userId=demo-user`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setRecipes(recipes.filter(r => r.id !== recipeId));
        if (selectedRecipe?.id === recipeId) {
          setSelectedRecipe(null);
        }
      }
    } catch (error) {
      console.error('Failed to delete recipe:', error);
    } finally {
      setDeleting(null);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50">
      <Navigation />

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <BookOpen className="w-8 h-8 text-orange-500" />
              My Recipes
            </h1>
            <p className="text-gray-600 mt-1">
              {recipes.length} recipe{recipes.length !== 1 ? 's' : ''} saved
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-5 py-3 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 transition-colors shadow-md hover:shadow-lg"
          >
            <Plus className="w-5 h-5" />
            Add Recipe
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-8">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search recipes by name, cuisine, or tags..."
            className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none bg-white"
          />
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-10 h-10 text-orange-500 animate-spin mb-4" />
            <p className="text-gray-600">Loading recipes...</p>
          </div>
        ) : recipes.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20"
          >
            <ChefHat className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-700 mb-2">No recipes yet</h2>
            <p className="text-gray-500 mb-6">
              Start building your recipe collection by adding your first recipe!
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Add Your First Recipe
            </button>
          </motion.div>
        ) : filteredRecipes.length === 0 ? (
          <div className="text-center py-20">
            <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-700 mb-2">No matches found</h2>
            <p className="text-gray-500">
              Try a different search term or{' '}
              <button
                onClick={() => setSearchQuery('')}
                className="text-orange-500 hover:underline"
              >
                clear the search
              </button>
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRecipes.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                onView={setSelectedRecipe}
                onDelete={handleDeleteRecipe}
                canDelete={true}
              />
            ))}
          </div>
        )}
      </main>

      {/* Modals */}
      <AddRecipeModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={handleSaveRecipes}
      />

      <RecipeDetailModal
        recipe={selectedRecipe}
        isOpen={!!selectedRecipe}
        onClose={() => setSelectedRecipe(null)}
        onDelete={handleDeleteRecipe}
        canDelete={true}
      />
    </div>
  );
}
