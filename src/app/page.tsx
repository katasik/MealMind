'use client';

import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Send, Heart, ThumbsUp, ThumbsDown, Clock, Sparkles, BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import Navigation from '@/components/Navigation';

interface SavedRecipeOption {
  id: string;
  name: string;
  description?: string;
  prepTime: number;
  cookTime: number;
  cuisine?: string;
  difficulty: string;
  tags?: string[];
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  recipe?: any;
  shoppingList?: any[];
  evaluation?: any;
  savedRecipeOptions?: SavedRecipeOption[];
  timestamp: Date;
  feedback?: 'love' | 'like' | 'dislike';
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Hi! I'm MealMind, your AI meal planning assistant. What are you in the mood for today?",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [expandedRecipes, setExpandedRecipes] = useState<Set<number>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const toggleRecipeExpand = (index: number) => {
    setExpandedRecipes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  const sendMessage = async (customMessage?: string) => {
    const messageToSend = customMessage || input;
    if (!messageToSend.trim() || loading) return;

    const userMessage: Message = {
      role: 'user',
      content: messageToSend,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    if (!customMessage) setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageToSend,
          conversationHistory: messages,
          familyId: 'demo-family',
          userId: 'demo-user'
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get response');
      }

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.message,
        recipe: data.recipe,
        shoppingList: data.shoppingList,
        evaluation: data.evaluation,
        savedRecipeOptions: data.savedRecipeOptions,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: error instanceof Error ? `Error: ${error.message}. Please make sure your GEMINI_API_KEY is set in .env` : "Sorry, I had trouble processing that. Can you try again?",
        timestamp: new Date()
      }]);
    } finally {
      setLoading(false);
    }
  };

  const selectSavedRecipe = async (recipeId: string) => {
    setLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Use this recipe',
          useRecipeId: recipeId,
          conversationHistory: messages
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get recipe');
      }

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.message,
        recipe: data.recipe,
        shoppingList: data.shoppingList,
        evaluation: data.evaluation,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateNewRecipe = async () => {
    setLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Generate a new recipe suggestion for me',
          conversationHistory: messages,
          forceGenerate: true
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate recipe');
      }

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.message,
        recipe: data.recipe,
        shoppingList: data.shoppingList,
        evaluation: data.evaluation,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFeedback = async (messageIndex: number, type: 'love' | 'like' | 'dislike') => {
    setMessages(prev => prev.map((msg, idx) =>
      idx === messageIndex ? { ...msg, feedback: type } : msg
    ));

    const message = messages[messageIndex];
    if (message?.recipe?.id) {
      try {
        await fetch('/api/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipeId: message.recipe.id,
            feedback: type
          })
        });
      } catch (error) {
        console.error('Failed to save feedback:', error);
      }
    }
  };

  return (
    <div className="h-screen flex flex-col bg-[#FBFBFA]">
      <Navigation />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.map((message, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-4 py-3 ${
                  message.role === 'user'
                    ? 'bg-[#37352F] text-white'
                    : 'bg-white border border-[#E9E9E7]'
                }`}
              >
                <p className="whitespace-pre-wrap text-sm">{message.content}</p>

                {/* Saved Recipe Options */}
                {message.savedRecipeOptions && message.savedRecipeOptions.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center gap-2 text-xs text-[#787774] mb-2">
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>From your saved recipes:</span>
                    </div>
                    {message.savedRecipeOptions.map((recipe) => (
                      <button
                        key={recipe.id}
                        onClick={() => selectSavedRecipe(recipe.id)}
                        disabled={loading}
                        className="w-full text-left p-3 bg-[#F7F6F3] rounded-md hover:bg-[#EEEEEC] border border-transparent hover:border-[#E9E9E7] transition-colors disabled:opacity-50"
                      >
                        <div className="font-medium text-[#37352F] text-sm">{recipe.name}</div>
                        {recipe.description && (
                          <p className="text-xs text-[#787774] mt-1 line-clamp-2">{recipe.description}</p>
                        )}
                        <div className="flex gap-3 mt-2 text-[10px] text-[#787774]">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {recipe.prepTime + recipe.cookTime} min
                          </span>
                          {recipe.cuisine && <span>{recipe.cuisine}</span>}
                          <span className="capitalize">{recipe.difficulty}</span>
                        </div>
                      </button>
                    ))}
                    <button
                      onClick={generateNewRecipe}
                      disabled={loading}
                      className="w-full p-2.5 bg-[#F7F6F3] text-[#37352F] rounded-md hover:bg-[#EEEEEC] transition-colors flex items-center justify-center gap-2 text-sm font-medium disabled:opacity-50 border border-[#E9E9E7]"
                    >
                      <Sparkles className="w-4 h-4" />
                      Generate New Recipe
                    </button>
                  </div>
                )}

                {/* Recipe Card */}
                {message.recipe && (
                  <div className="mt-4 p-4 bg-[#F7F6F3] rounded-md border border-[#E9E9E7]">
                    <h3 className="font-semibold text-[#37352F] mb-1">
                      {message.recipe.name}
                    </h3>
                    <p className="text-xs text-[#787774] mb-3">
                      {message.recipe.description}
                    </p>
                    <div className="flex gap-3 text-xs text-[#787774]">
                      <span>{message.recipe.prepTime + message.recipe.cookTime} min</span>
                      <span>{message.recipe.servings} servings</span>
                      <span className="capitalize">{message.recipe.difficulty}</span>
                    </div>

                    {/* Ingredients */}
                    {message.recipe.ingredients && (
                      <div className="mt-3 pt-3 border-t border-[#E9E9E7]">
                        <h4 className="font-medium text-xs text-[#37352F] mb-2 uppercase tracking-wide">Ingredients</h4>
                        <ul className="text-xs text-[#787774] space-y-1">
                          {(expandedRecipes.has(index)
                            ? message.recipe.ingredients
                            : message.recipe.ingredients.slice(0, 5)
                          ).map((ing: any, i: number) => (
                            <li key={i} className="flex items-start gap-1.5">
                              <span className="text-[#37352F] opacity-40">•</span>
                              <span>{ing.amount} {ing.unit} {ing.name}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Instructions */}
                    {message.recipe.instructions && (
                      <div className="mt-3 pt-3 border-t border-[#E9E9E7]">
                        <h4 className="font-medium text-xs text-[#37352F] mb-2 uppercase tracking-wide">Instructions</h4>
                        <ol className="text-xs text-[#787774] space-y-1.5">
                          {(expandedRecipes.has(index)
                            ? message.recipe.instructions
                            : message.recipe.instructions.slice(0, 4)
                          ).map((step: string, i: number) => (
                            <li key={i} className="flex gap-2">
                              <span className="text-[#787774] font-medium">{i + 1}.</span>
                              <span>{step}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}

                    {/* Expand/Collapse Button */}
                    {(message.recipe.ingredients?.length > 5 || message.recipe.instructions?.length > 4) && (
                      <button
                        onClick={() => toggleRecipeExpand(index)}
                        className="mt-3 flex items-center gap-1 text-xs text-[#2383E2] hover:text-[#1B6EC2] font-medium"
                      >
                        {expandedRecipes.has(index) ? (
                          <>
                            <ChevronUp className="w-3.5 h-3.5" />
                            Show less
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-3.5 h-3.5" />
                            Show all ({message.recipe.ingredients?.length || 0} ingredients, {message.recipe.instructions?.length || 0} steps)
                          </>
                        )}
                      </button>
                    )}

                    {/* Evaluation Scores */}
                    {message.evaluation && (
                      <div className="mt-3 pt-3 border-t border-[#E9E9E7]">
                        <div className="grid grid-cols-2 gap-2 text-[10px]">
                          <div>
                            <span className="text-[#787774]">Safety: </span>
                            <span className="font-medium text-[#1E7C45]">
                              {(message.evaluation.metrics.dietaryCompliance * 100).toFixed(0)}%
                            </span>
                          </div>
                          <div>
                            <span className="text-[#787774]">Feasibility: </span>
                            <span className="font-medium text-[#37352F]">
                              {(message.evaluation.metrics.feasibility * 100).toFixed(0)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Feedback Buttons */}
                {message.role === 'assistant' && message.recipe && (
                  <div className="mt-3">
                    {message.feedback ? (
                      <div className="text-xs text-[#787774] flex items-center gap-2">
                        {message.feedback === 'love' && <><Heart className="w-3.5 h-3.5 text-[#EB5757] fill-[#EB5757]" /> You loved this recipe!</>}
                        {message.feedback === 'like' && <><ThumbsUp className="w-3.5 h-3.5 text-[#1E7C45] fill-[#1E7C45]" /> Thanks for your feedback!</>}
                        {message.feedback === 'dislike' && <><ThumbsDown className="w-3.5 h-3.5 text-[#787774]" /> Got it, we&apos;ll suggest something different next time.</>}
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleFeedback(index, 'love')}
                          className="flex items-center gap-1 px-2.5 py-1 bg-[#FDEBEC] text-[#EB5757] rounded-md hover:bg-[#FBD4D7] text-xs transition-colors"
                        >
                          <Heart className="w-3.5 h-3.5" />
                          Love it
                        </button>
                        <button
                          onClick={() => handleFeedback(index, 'like')}
                          className="flex items-center gap-1 px-2.5 py-1 bg-[#DBEDDB] text-[#1E7C45] rounded-md hover:bg-[#C8E4C8] text-xs transition-colors"
                        >
                          <ThumbsUp className="w-3.5 h-3.5" />
                          Good
                        </button>
                        <button
                          onClick={() => handleFeedback(index, 'dislike')}
                          className="flex items-center gap-1 px-2.5 py-1 bg-[#F7F6F3] text-[#787774] rounded-md hover:bg-[#EEEEEC] text-xs transition-colors"
                        >
                          <ThumbsDown className="w-3.5 h-3.5" />
                          Not for me
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-white border border-[#E9E9E7] rounded-lg px-4 py-3">
                <div className="flex gap-1.5">
                  <div className="w-2 h-2 bg-[#787774] rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-[#787774] rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                  <div className="w-2 h-2 bg-[#787774] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="bg-[#FBFBFA] border-t border-[#E9E9E7] px-6 py-4">
        <div className="max-w-3xl mx-auto flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Ask for meal suggestions, recipes, or just chat..."
            className="flex-1 px-4 py-2.5 bg-white border border-[#E9E9E7] rounded-md focus:border-[#37352F] focus:outline-none text-sm placeholder:text-[#787774]"
            disabled={loading}
          />
          <button
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            className="px-4 py-2.5 bg-[#37352F] text-white rounded-md hover:bg-[#2F2D2A] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors text-sm"
          >
            <Send className="w-4 h-4" />
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
