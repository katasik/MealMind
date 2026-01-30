'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, Loader2 } from 'lucide-react';
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
  const [, setDeleting] = useState<string | null>(null);

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
    // Fetch user preferences to get target language
    let targetLanguage = 'en';
    try {
      const prefsResponse = await fetch('/api/settings?userId=demo-user&familyId=demo-family');
      const prefsData = await prefsResponse.json();
      targetLanguage = prefsData.user?.preferences?.targetLanguage || 'en';
    } catch (error) {
      console.error('Failed to fetch language preference, using English:', error);
    }

    for (const recipe of parsedRecipes) {
      await fetch('/api/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipe,
          familyId: 'demo-family',
          userId: 'demo-user',
          userName: 'Demo User',
          targetLanguage
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
    <div className="min-h-screen bg-[#F9FAFB]">
      <Navigation />

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-3xl">📖</span>
              <h1 className="text-3xl font-bold text-[#1F2937]">My Recipes</h1>
            </div>
            <p className="text-[#6B7280] ml-12">
              {recipes.length} recipe{recipes.length !== 1 ? 's' : ''} saved
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#1F2937] text-white rounded-md font-medium hover:bg-[#2F2D2A] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Recipe
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-8">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search recipes by name, cuisine, or tags..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#E5E7EB] rounded-md focus:border-[#1F2937] focus:outline-none text-sm placeholder:text-[#6B7280]"
          />
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-[#6B7280] animate-spin mb-4" />
            <p className="text-[#6B7280] text-sm">Loading recipes...</p>
          </div>
        ) : recipes.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16"
          >
            <div className="text-5xl mb-4">📝</div>
            <h2 className="text-xl font-semibold text-[#1F2937] mb-2">No recipes yet</h2>
            <p className="text-[#6B7280] mb-6 max-w-md mx-auto">
              Start building your recipe collection by adding your first recipe!
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#1F2937] text-white rounded-md font-medium hover:bg-[#2F2D2A] transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Your First Recipe
            </button>
          </motion.div>
        ) : filteredRecipes.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">🔍</div>
            <h2 className="text-xl font-semibold text-[#1F2937] mb-2">No matches found</h2>
            <p className="text-[#6B7280]">
              Try a different search term or{' '}
              <button
                onClick={() => setSearchQuery('')}
                className="text-[#0EA5E9] hover:underline"
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
