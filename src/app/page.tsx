'use client';

import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Send, Heart, ThumbsUp, ThumbsDown, Clock, Sparkles, BookOpen } from 'lucide-react';
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
          conversationHistory: messages
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
      // Force generate new by sending a specific request
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
    <div className="h-screen flex flex-col bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50">
      <Navigation />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {messages.map((message, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-6 py-4 ${
                  message.role === 'user'
                    ? 'bg-orange-500 text-white'
                    : 'bg-white shadow-md'
                }`}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>

                {/* Saved Recipe Options */}
                {message.savedRecipeOptions && message.savedRecipeOptions.length > 0 && (
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                      <BookOpen className="w-4 h-4" />
                      <span>From your saved recipes:</span>
                    </div>
                    {message.savedRecipeOptions.map((recipe) => (
                      <button
                        key={recipe.id}
                        onClick={() => selectSavedRecipe(recipe.id)}
                        disabled={loading}
                        className="w-full text-left p-4 bg-gray-50 rounded-xl hover:bg-orange-50 hover:border-orange-200 border-2 border-transparent transition-colors disabled:opacity-50"
                      >
                        <div className="font-semibold text-gray-900">{recipe.name}</div>
                        {recipe.description && (
                          <p className="text-sm text-gray-600 mt-1 line-clamp-2">{recipe.description}</p>
                        )}
                        <div className="flex gap-3 mt-2 text-xs text-gray-500">
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
                      className="w-full p-3 bg-orange-100 text-orange-700 rounded-xl hover:bg-orange-200 transition-colors flex items-center justify-center gap-2 font-medium disabled:opacity-50"
                    >
                      <Sparkles className="w-4 h-4" />
                      Generate New Recipe
                    </button>
                  </div>
                )}

                {/* Recipe Card */}
                {message.recipe && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-xl">
                    <h3 className="font-bold text-lg mb-2 text-gray-900">
                      {message.recipe.name}
                    </h3>
                    <p className="text-sm text-gray-600 mb-3">
                      {message.recipe.description}
                    </p>
                    <div className="flex gap-4 text-sm text-gray-700">
                      <span>{message.recipe.prepTime + message.recipe.cookTime} min</span>
                      <span>{message.recipe.servings} servings</span>
                      <span>{message.recipe.difficulty}</span>
                    </div>

                    {/* Ingredients */}
                    {message.recipe.ingredients && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <h4 className="font-semibold text-sm text-gray-800 mb-2">Ingredients:</h4>
                        <ul className="text-sm text-gray-600 space-y-1">
                          {message.recipe.ingredients.slice(0, 5).map((ing: any, i: number) => (
                            <li key={i}>- {ing.amount} {ing.unit} {ing.name}</li>
                          ))}
                          {message.recipe.ingredients.length > 5 && (
                            <li className="text-gray-400">...and {message.recipe.ingredients.length - 5} more</li>
                          )}
                        </ul>
                      </div>
                    )}

                    {/* Instructions */}
                    {message.recipe.instructions && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <h4 className="font-semibold text-sm text-gray-800 mb-2">Instructions:</h4>
                        <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
                          {message.recipe.instructions.slice(0, 4).map((step: string, i: number) => (
                            <li key={i}>{step}</li>
                          ))}
                          {message.recipe.instructions.length > 4 && (
                            <li className="text-gray-400">...and {message.recipe.instructions.length - 4} more steps</li>
                          )}
                        </ol>
                      </div>
                    )}

                    {/* Evaluation Scores */}
                    {message.evaluation && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-gray-600">Safety: </span>
                            <span className="font-semibold text-green-600">
                              {(message.evaluation.metrics.dietaryCompliance * 100).toFixed(0)}%
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-600">Feasibility: </span>
                            <span className="font-semibold">
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
                  <div className="mt-4">
                    {message.feedback ? (
                      <div className="text-sm text-gray-500 flex items-center gap-2">
                        {message.feedback === 'love' && <><Heart className="w-4 h-4 text-red-500 fill-red-500" /> You loved this recipe!</>}
                        {message.feedback === 'like' && <><ThumbsUp className="w-4 h-4 text-green-500 fill-green-500" /> Thanks for your feedback!</>}
                        {message.feedback === 'dislike' && <><ThumbsDown className="w-4 h-4 text-gray-500" /> Got it, we&apos;ll suggest something different next time.</>}
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleFeedback(index, 'love')}
                          className="flex items-center gap-1 px-3 py-1.5 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 text-sm transition-colors"
                        >
                          <Heart className="w-4 h-4" />
                          Love it
                        </button>
                        <button
                          onClick={() => handleFeedback(index, 'like')}
                          className="flex items-center gap-1 px-3 py-1.5 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 text-sm transition-colors"
                        >
                          <ThumbsUp className="w-4 h-4" />
                          Good
                        </button>
                        <button
                          onClick={() => handleFeedback(index, 'dislike')}
                          className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 text-sm transition-colors"
                        >
                          <ThumbsDown className="w-4 h-4" />
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
              <div className="bg-white shadow-md rounded-2xl px-6 py-4">
                <div className="flex gap-2">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="bg-white border-t border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex gap-4">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Ask for meal suggestions, recipes, or just chat..."
            className="flex-1 px-6 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
            disabled={loading}
          />
          <button
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            className="px-6 py-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
          >
            <Send className="w-5 h-5" />
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
