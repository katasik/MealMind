import { NextRequest, NextResponse } from 'next/server';
import { firebaseService } from '../../../../lib/firebase';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

interface TelegramUpdate {
  message?: {
    message_id: number;
    chat: {
      id: number;
      first_name?: string;
      username?: string;
    };
    text?: string;
    date: number;
  };
}

// Helper to calculate week start (Monday) for a given date
function getWeekStartDate(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

// Helper to get the current week's meal plan and shopping list
// Also checks next week if current week has no meal plan (handles weekend edge case)
async function getCurrentWeekContext(familyId: string) {
  const today = new Date();
  const weekStartDate = getWeekStartDate(today);

  // Try current week first
  let mealPlan = await firebaseService.getMealPlan(familyId, weekStartDate);
  let usedWeekStart = weekStartDate;

  // If no meal plan for current week, try next week (handles Sunday/weekend planning)
  if (!mealPlan) {
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextWeekStart = getWeekStartDate(nextWeek);
    mealPlan = await firebaseService.getMealPlan(familyId, nextWeekStart);
    if (mealPlan) {
      usedWeekStart = nextWeekStart;
    }
  }

  let shoppingList = null;
  if (mealPlan) {
    shoppingList = await firebaseService.getMealPlanShoppingListByPlanId(mealPlan.id);
  }

  return { mealPlan, shoppingList, weekStartDate: usedWeekStart };
}

// Helper to format today's meals
function getTodaysMeals(mealPlan: any): string {
  if (!mealPlan) return 'No meal plan for this week.';

  const today = new Date().toISOString().split('T')[0];
  const todayPlan = mealPlan.days.find((day: any) => day.date === today);

  if (!todayPlan || todayPlan.meals.length === 0) {
    return 'No meals planned for today.';
  }

  let result = "Today's meals:\n";
  for (const meal of todayPlan.meals) {
    result += `\n${meal.mealType.charAt(0).toUpperCase() + meal.mealType.slice(1)}: ${meal.recipeName}`;
    if (meal.recipeDescription) {
      result += `\n   ${meal.recipeDescription}`;
    }
  }
  return result;
}

// Use AI to answer complex questions
async function answerWithAI(
  question: string,
  mealPlan: any,
  shoppingList: any
): Promise<string> {
  const today = new Date().toISOString().split('T')[0];

  let context = 'You are MealMind, a helpful meal planning assistant. Answer the user\'s question based on their meal plan and shopping list.\n\n';

  if (mealPlan) {
    context += 'MEAL PLAN:\n';
    for (const day of mealPlan.days) {
      const isToday = day.date === today;
      context += `${day.dayName}${isToday ? ' (TODAY)' : ''}:\n`;
      for (const meal of day.meals) {
        context += `  - ${meal.mealType}: ${meal.recipeName}\n`;
        if (meal.ingredients) {
          context += `    Ingredients: ${meal.ingredients.map((i: any) => `${i.amount} ${i.unit} ${i.name}`).join(', ')}\n`;
        }
      }
    }
  } else {
    context += 'No meal plan is currently set up.\n';
  }

  if (shoppingList) {
    context += '\nSHOPPING LIST:\n';
    const unchecked = shoppingList.items.filter((i: any) => !i.checked);
    for (const item of unchecked) {
      context += `- ${item.amount} ${item.unit} ${item.ingredientName} (${item.category})\n`;
    }
  }

  context += `\nToday is: ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}\n`;
  context += '\nUser question: ' + question;
  context += '\n\nProvide a helpful, concise answer. If asking about what to buy (like "what kind of chicken"), give specific advice based on the recipe that uses it.';

  try {
    const result = await model.generateContent(context);
    return result.response.text();
  } catch (error) {
    console.error('AI error:', error);
    return "I'm having trouble processing that question. Please try again.";
  }
}

// Send message to Telegram
async function sendTelegramMessage(chatId: number, text: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return;

  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'Markdown'
    })
  });
}

// POST - Handle Telegram webhook
export async function POST(request: NextRequest) {
  try {
    const update: TelegramUpdate = await request.json();

    if (!update.message?.text) {
      return NextResponse.json({ ok: true });
    }

    const chatId = update.message.chat.id;
    const text = update.message.text.trim();
    const familyId = 'demo-family'; // In production, map chatId to familyId

    // Register the chat for future use
    await firebaseService.registerTelegramChat(chatId, update.message.chat.username || 'user');

    // Get current context
    const { mealPlan, shoppingList } = await getCurrentWeekContext(familyId);

    // Handle commands
    if (text.startsWith('/')) {
      const commandParts = text.split(' ');
      const command = commandParts[0].toLowerCase();
      const payload = commandParts.slice(1).join(' ');

      switch (command) {
        case '/start':
          // Handle deep link payload for auto-connection
          if (payload && payload.startsWith('family_')) {
            try {
              await firebaseService.linkTelegramChatToFamily(chatId, payload);
              await sendTelegramMessage(chatId,
                "🎉 Success! You're connected to MealMind!\n\n" +
                "✅ Chat linked to your family\n\n" +
                "You can now:\n" +
                "📅 View meal plans: /today, /week, /list\n" +
                "❓ Ask me questions about your meals!\n\n" +
                "Try asking: \"What should we make for dinner tonight?\""
              );
            } catch (error) {
              console.error('Error auto-linking chat:', error);
              await sendTelegramMessage(chatId, "Failed to connect to your family. Please try again or contact support.");
            }
          } else if (payload === 'demo') {
            // Handle demo mode
            try {
              await firebaseService.linkTelegramChatToFamily(chatId, 'demo-family');
              await sendTelegramMessage(chatId,
                "🎯 Demo Mode Activated!\n\n" +
                "You're now connected to a demo account.\n\n" +
                "Try these:\n" +
                "/today - See today's meals\n" +
                "/week - View the full week\n" +
                "/list - Check the shopping list\n\n" +
                "Or just ask: \"What should I buy for dinner?\""
              );
            } catch (error) {
              console.error('Error linking to demo:', error);
              await sendTelegramMessage(chatId, "Failed to connect to demo. Please try again.");
            }
          } else {
            // Normal start message
            await sendTelegramMessage(chatId,
              "Hi! I'm MealMind, your meal planning assistant.\n\n" +
              "You can ask me things like:\n" +
              "- What should we make for dinner tonight?\n" +
              "- What's on my shopping list?\n" +
              "- What kind of chicken should I buy?\n" +
              "- Show me today's meals\n\n" +
              "Commands:\n" +
              "/today - Show today's meals\n" +
              "/week - Show this week's plan\n" +
              "/list - Show shopping list"
            );
          }
          break;

        case '/today':
          await sendTelegramMessage(chatId, getTodaysMeals(mealPlan));
          break;

        case '/week':
          if (!mealPlan) {
            await sendTelegramMessage(chatId, "No meal plan for this week. Create one on the website!");
          } else {
            let weekMsg = "*This Week's Meals*\n";
            for (const day of mealPlan.days) {
              weekMsg += `\n*${day.dayName}*\n`;
              for (const meal of day.meals) {
                weekMsg += `  ${meal.mealType}: ${meal.recipeName}\n`;
              }
            }
            await sendTelegramMessage(chatId, weekMsg);
          }
          break;

        case '/list':
          if (!shoppingList) {
            await sendTelegramMessage(chatId, "No shopping list available. Approve a meal plan first!");
          } else {
            const unchecked = shoppingList.items.filter((i: any) => !i.checked);
            if (unchecked.length === 0) {
              await sendTelegramMessage(chatId, "Your shopping list is complete! All items checked off.");
            } else {
              let listMsg = `*Shopping List* (${unchecked.length} items)\n`;
              const byCategory: Record<string, any[]> = {};
              for (const item of unchecked) {
                const cat = item.category || 'Other';
                if (!byCategory[cat]) byCategory[cat] = [];
                byCategory[cat].push(item);
              }
              for (const [cat, items] of Object.entries(byCategory)) {
                listMsg += `\n*${cat}*\n`;
                for (const item of items) {
                  listMsg += `☐ ${item.amount} ${item.unit} ${item.ingredientName}\n`;
                }
              }
              await sendTelegramMessage(chatId, listMsg);
            }
          }
          break;

        default:
          await sendTelegramMessage(chatId, "Unknown command. Try /start for help.");
      }

      return NextResponse.json({ ok: true });
    }

    // Handle natural language questions
    const lowerText = text.toLowerCase();

    // Quick patterns for common questions
    if (lowerText.includes('dinner') && (lowerText.includes('tonight') || lowerText.includes('today'))) {
      if (!mealPlan) {
        await sendTelegramMessage(chatId, "No meal plan set up for this week.");
      } else {
        const today = new Date().toISOString().split('T')[0];
        const todayPlan = mealPlan.days.find((d: any) => d.date === today);
        const dinner = todayPlan?.meals.find((m: any) => m.mealType === 'dinner');
        if (dinner) {
          let msg = `Tonight's dinner: *${dinner.recipeName}*`;
          if (dinner.recipeDescription) msg += `\n${dinner.recipeDescription}`;
          if (dinner.prepTime || dinner.cookTime) {
            msg += `\n⏱ ${(dinner.prepTime || 0) + (dinner.cookTime || 0)} min total`;
          }
          await sendTelegramMessage(chatId, msg);
        } else {
          await sendTelegramMessage(chatId, "No dinner planned for tonight.");
        }
      }
      return NextResponse.json({ ok: true });
    }

    // For complex questions, use AI
    const answer = await answerWithAI(text, mealPlan, shoppingList);
    await sendTelegramMessage(chatId, answer);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Telegram webhook error:', error);
    return NextResponse.json({ ok: true }); // Always return ok to Telegram
  }
}

// GET - Verify webhook (Telegram sends GET to verify)
export async function GET() {
  return NextResponse.json({ status: 'Webhook active' });
}
