'use client';

import { motion } from 'framer-motion';
import { Sparkles, BookOpen, Calendar, ShoppingCart, MessageCircle, CheckCircle, ArrowRight } from 'lucide-react';

interface LandingPageProps {
  onGetStarted: () => void;
}

export default function LandingPage({ onGetStarted }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F9FAFB] to-[#F3F4F6]">
      {/* Hero Section */}
      <div className="max-w-6xl mx-auto px-6 pt-20 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="text-6xl mb-6">🍽️</div>
          <h1 className="text-5xl md:text-6xl font-bold text-[#1F2937] mb-6">
            Stop Stressing About
            <br />
            <span className="text-[#0EA5E9]">What We Should Make for Dinner</span>
          </h1>
          <p className="text-xl text-[#6B7280] max-w-2xl mx-auto mb-8">
            Decision fatigue is over. Eat better, save money, and get your time back with AI-powered meal planning.
          </p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onGetStarted}
            className="inline-flex items-center gap-2 px-8 py-4 bg-[#0EA5E9] text-white text-lg font-medium rounded-lg hover:bg-[#1B6EC2] transition-colors shadow-lg"
          >
            Get Started Free
            <ArrowRight className="w-5 h-5" />
          </motion.button>
        </motion.div>

        {/* Problem Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="bg-white border border-[#E5E7EB] rounded-2xl p-8 mb-12"
        >
          <h2 className="text-2xl font-bold text-[#1F2937] mb-6 text-center">
            Sound Familiar?
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-4xl mb-3">😫</div>
              <h3 className="font-semibold text-[#1F2937] mb-2">Decision Fatigue</h3>
              <p className="text-sm text-[#6B7280]">
                Every evening, the same question: "What should we make for dinner?"
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-3">🍕</div>
              <h3 className="font-semibold text-[#1F2937] mb-2">Unhealthy Choices</h3>
              <p className="text-sm text-[#6B7280]">
                No plan means ordering takeout or making whatever's at home
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-3">💸</div>
              <h3 className="font-semibold text-[#1F2937] mb-2">Money Wasted</h3>
              <p className="text-sm text-[#6B7280]">
                Frequent takeout adds up fast, and grocery trips are inefficient
              </p>
            </div>
          </div>
        </motion.div>

        {/* How It Works */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mb-12"
        >
          <h2 className="text-3xl font-bold text-[#1F2937] mb-8 text-center">
            How MealMind Works
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Step 1 */}
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-[#DDEBF1] rounded-lg flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-[#0B6E99]" />
                </div>
                <h3 className="font-semibold text-[#1F2937]">Build Your Recipe Library</h3>
              </div>
              <p className="text-sm text-[#6B7280] mb-3">
                Upload PDFs, paste URLs, or add text from your favorite recipes. Even upload entire recipe books.
              </p>
              <ul className="text-xs text-[#6B7280] space-y-1">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-[#1E7C45] flex-shrink-0 mt-0.5" />
                  <span>Only use recipes you trust and love</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-[#1E7C45] flex-shrink-0 mt-0.5" />
                  <span>AI extracts all details automatically</span>
                </li>
              </ul>
            </div>

            {/* Step 2 */}
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-[#DDEBF1] rounded-lg flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-[#0B6E99]" />
                </div>
                <h3 className="font-semibold text-[#1F2937]">AI Generates Your Plan</h3>
              </div>
              <p className="text-sm text-[#6B7280] mb-3">
                Choose how many days and meals you want. AI creates a balanced, personalized plan from your recipes.
              </p>
              <ul className="text-xs text-[#6B7280] space-y-1">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-[#1E7C45] flex-shrink-0 mt-0.5" />
                  <span>Customize for 1-7 days</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-[#1E7C45] flex-shrink-0 mt-0.5" />
                  <span>Swap any meal you don't like</span>
                </li>
              </ul>
            </div>

            {/* Step 3 */}
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-[#DDEBF1] rounded-lg flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-[#0B6E99]" />
                </div>
                <h3 className="font-semibold text-[#1F2937]">Add to Calendar</h3>
              </div>
              <p className="text-sm text-[#6B7280] mb-3">
                Export your meal plan to your calendar or share with family. Everyone knows what we're making for dinner.
              </p>
              <ul className="text-xs text-[#6B7280] space-y-1">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-[#1E7C45] flex-shrink-0 mt-0.5" />
                  <span>Works with Google Calendar, iCal</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-[#1E7C45] flex-shrink-0 mt-0.5" />
                  <span>Share with family members</span>
                </li>
              </ul>
            </div>

            {/* Step 4 */}
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-[#DDEBF1] rounded-lg flex items-center justify-center">
                  <ShoppingCart className="w-5 h-5 text-[#0B6E99]" />
                </div>
                <h3 className="font-semibold text-[#1F2937]">Smart Shopping List</h3>
              </div>
              <p className="text-sm text-[#6B7280] mb-3">
                Get an instant shopping list. Mark what you already have at home, see what you need to buy.
              </p>
              <ul className="text-xs text-[#6B7280] space-y-1">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-[#1E7C45] flex-shrink-0 mt-0.5" />
                  <span>Auto-generated from your plan</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-[#1E7C45] flex-shrink-0 mt-0.5" />
                  <span>Check off items as you shop</span>
                </li>
              </ul>
            </div>

            {/* Step 5 */}
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-[#DDEBF1] rounded-lg flex items-center justify-center">
                  <MessageCircle className="w-5 h-5 text-[#0B6E99]" />
                </div>
                <h3 className="font-semibold text-[#1F2937]">Telegram Integration</h3>
              </div>
              <p className="text-sm text-[#6B7280] mb-3">
                Send reminders to yourself or family. Ask the AI bot about recipes while shopping.
              </p>
              <ul className="text-xs text-[#6B7280] space-y-1">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-[#1E7C45] flex-shrink-0 mt-0.5" />
                  <span>Shopping list via message</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-[#1E7C45] flex-shrink-0 mt-0.5" />
                  <span>Ask AI for recipe details on-the-go</span>
                </li>
              </ul>
            </div>

            {/* Step 6 */}
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-[#DDEBF1] rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-[#0B6E99]" />
                </div>
                <h3 className="font-semibold text-[#1F2937]">Cook & Enjoy</h3>
              </div>
              <p className="text-sm text-[#6B7280] mb-3">
                No more stress. No more takeout. Just delicious meals made with recipes you love.
              </p>
              <ul className="text-xs text-[#6B7280] space-y-1">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-[#1E7C45] flex-shrink-0 mt-0.5" />
                  <span>Healthier eating habits</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-[#1E7C45] flex-shrink-0 mt-0.5" />
                  <span>Save money on takeout</span>
                </li>
              </ul>
            </div>
          </div>
        </motion.div>

        {/* Benefits Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="bg-gradient-to-r from-[#0EA5E9] to-[#1B6EC2] rounded-2xl p-8 md:p-12 text-white mb-12"
        >
          <h2 className="text-3xl font-bold mb-6 text-center">
            Why MealMind?
          </h2>
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            <div className="text-center">
              <div className="text-4xl mb-3">⚡</div>
              <h3 className="font-semibold text-lg mb-2">Save Time</h3>
              <p className="text-sm opacity-90">
                No more daily "what should we make" conversations. Plan once, eat all week.
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-3">🥗</div>
              <h3 className="font-semibold text-lg mb-2">Eat Healthier</h3>
              <p className="text-sm opacity-90">
                Planned meals mean less takeout and more nutritious home cooking.
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-3">💰</div>
              <h3 className="font-semibold text-lg mb-2">Save Money</h3>
              <p className="text-sm opacity-90">
                Efficient grocery shopping and fewer takeout orders = serious savings.
              </p>
            </div>
          </div>
          <div className="text-center">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onGetStarted}
              className="inline-flex items-center gap-2 px-8 py-4 bg-white text-[#0EA5E9] text-lg font-medium rounded-lg hover:bg-[#F3F4F6] transition-colors shadow-lg"
            >
              Start Planning Now
              <ArrowRight className="w-5 h-5" />
            </motion.button>
          </div>
        </motion.div>

        {/* Footer */}
        <div className="text-center text-sm text-[#6B7280]">
          <p>Built with AI-powered recipe understanding and meal planning</p>
        </div>
      </div>
    </div>
  );
}
