import 'dotenv/config';
import { Telegraf, Markup, Context } from 'telegraf';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { firebaseService } from '../lib/firebase';
import type { Recipe } from '../types';

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');

// Store sessions by chat ID (works for both private and group chats)
const chatSessions = new Map<number, {
  conversationHistory: Array<{ role: string; content: string; userName?: string }>;
  members: Map<number, { name: string; dietaryRestrictions: string[] }>;
  lastRecipeId?: string;
  lastRecipeText?: string;
  pendingVotes?: {
    recipeId: string;
    votes: Map<number, 'love' | 'like' | 'dislike'>;
    messageId?: number;
  };
  loadedFromDb?: boolean;
  // Recipe capture mode
  pendingRecipeCapture?: {
    userId: number;
    userName: string;
    awaitingInput: boolean;
  };
}>();

// Load session from Firebase if not already loaded
async function loadSessionFromDb(chatId: number): Promise<void> {
  const session = chatSessions.get(chatId);
  if (session?.loadedFromDb) return;

  console.log(`[Firebase] Attempting to load chat ${chatId}...`);

  try {
    const data = await firebaseService.getTelegramChat(chatId);
    console.log(`[Firebase] Got data for chat ${chatId}:`, JSON.stringify(data, null, 2));

    const currentSession = getSession(chatId);

    if (data?.members) {
      // Merge Firebase data with current session
      for (const [odId, member] of Object.entries(data.members)) {
        console.log(`[Firebase] Loading member ${odId}:`, member);
        currentSession.members.set(Number(odId), member);
      }
      console.log(`[Firebase] Loaded ${Object.keys(data.members).length} members for chat ${chatId}`);
    } else {
      console.log(`[Firebase] No members data found for chat ${chatId}`);
    }

    currentSession.loadedFromDb = true;
  } catch (error) {
    console.error('[Firebase] Error loading session:', error);
  }
}

// Get or create session for a chat
function getSession(chatId: number) {
  if (!chatSessions.has(chatId)) {
    chatSessions.set(chatId, {
      conversationHistory: [],
      members: new Map(),
      loadedFromDb: false
    });
  }
  return chatSessions.get(chatId)!;
}

// Get or add member to session (and save to Firebase)
async function getMemberAsync(chatId: number, session: ReturnType<typeof getSession>, userId: number, userName: string) {
  const isNew = !session.members.has(userId);
  if (isNew) {
    session.members.set(userId, {
      name: userName,
      dietaryRestrictions: []
    });
    // Save new member to Firebase
    await firebaseService.saveTelegramMember(chatId, userId, {
      name: userName,
      dietaryRestrictions: []
    });
  }
  return session.members.get(userId)!;
}

// Sync version for quick access (doesn't save to Firebase)
function getMember(session: ReturnType<typeof getSession>, userId: number, userName: string) {
  if (!session.members.has(userId)) {
    session.members.set(userId, {
      name: userName,
      dietaryRestrictions: []
    });
  }
  return session.members.get(userId)!;
}

// Save member restrictions to Firebase
async function saveMemberRestrictions(chatId: number, userId: number, member: { name: string; dietaryRestrictions: string[] }) {
  console.log(`[Firebase] Saving member ${userId} for chat ${chatId}:`, member);
  try {
    await firebaseService.saveTelegramMember(chatId, userId, member);
    console.log(`[Firebase] Saved successfully`);
  } catch (error) {
    console.error('[Firebase] Error saving member:', error);
  }
}

// Get combined dietary restrictions for all members in a chat
function getCombinedRestrictions(session: ReturnType<typeof getSession>): string[] {
  const allRestrictions = new Set<string>();
  session.members.forEach(member => {
    member.dietaryRestrictions.forEach(r => allRestrictions.add(r));
  });
  return Array.from(allRestrictions);
}

// Check if message is from a group chat
function isGroupChat(ctx: Context): boolean {
  return ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup';
}

// Get user display name
function getUserName(ctx: Context): string {
  const user = ctx.from;
  if (!user) return 'Someone';
  return user.first_name || user.username || 'Someone';
}

// Generate a simple recipe ID
function generateRecipeId() {
  return `recipe_${Date.now()}`;
}

// Extract ingredients from recipe text and format as shopping list
function extractShoppingList(recipeText: string): string {
  // Try to find the ingredients section
  const ingredientsMatch = recipeText.match(/ingredients[:\s]*\n([\s\S]*?)(?=\n\s*(?:instructions|steps|directions|method|preparation|\d+\.|$))/i);

  if (ingredientsMatch) {
    const ingredientsSection = ingredientsMatch[1];
    const items = ingredientsSection
      .split('\n')
      .map(line => line.replace(/^[-*•]\s*/, '').trim())
      .filter(line => line.length > 0 && !line.toLowerCase().includes('ingredient'));

    if (items.length > 0) {
      return '🛒 Shopping List\n\n' + items.map(item => `☐ ${item}`).join('\n');
    }
  }

  // Fallback: just note that the recipe was approved
  return '🛒 Check the recipe above for the full ingredients list!';
}

// Clean markdown formatting that Telegram doesn't support well
function cleanMarkdown(text: string): string {
  return text
    // Remove ** bold markers (Telegram uses *text* for italic, not bold)
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    // Remove __ bold markers
    .replace(/__([^_]+)__/g, '$1')
    // Keep single * for emphasis but make sure they're paired
    .replace(/\*([^*\n]+)\*/g, '$1')
    // Clean up any leftover stray asterisks at start of lines (bullet points are fine)
    .replace(/^\*\s+/gm, '• ');
}

// Get voting status message
function getVotingStatus(session: ReturnType<typeof getSession>): string {
  if (!session.pendingVotes) return '';

  const totalMembers = session.members.size;
  const votedCount = session.pendingVotes.votes.size;
  const votes = session.pendingVotes.votes;

  let status = `\n\n📊 Votes: ${votedCount}/${totalMembers}\n`;

  session.members.forEach((member, odId) => {
    const vote = votes.get(odId);
    if (vote) {
      const emoji = vote === 'love' ? '❤️' : vote === 'like' ? '👍' : '👎';
      status += `${emoji} ${member.name}\n`;
    } else {
      status += `⏳ ${member.name} (waiting)\n`;
    }
  });

  return status;
}

// Parse recipe text using Gemini
async function parseRecipeText(rawText: string): Promise<Partial<Recipe> | null> {
  const prompt = `Parse the following recipe text into a structured JSON format.

Recipe text:
${rawText}

Return ONLY valid JSON (no markdown, no code blocks) in this exact format:
{
  "name": "Recipe Name",
  "description": "Brief description of the dish",
  "ingredients": [
    {"name": "ingredient name", "amount": "1", "unit": "cup", "category": "produce"}
  ],
  "instructions": ["Step 1 instruction", "Step 2 instruction"],
  "prepTime": 15,
  "cookTime": 20,
  "servings": 4,
  "cuisine": "Italian",
  "difficulty": "easy",
  "tags": ["quick", "vegetarian"]
}

Notes:
- prepTime and cookTime should be in minutes (numbers only)
- difficulty must be "easy", "medium", or "hard"
- If you can't determine a value, use reasonable defaults
- If this doesn't appear to be a recipe, return: {"error": "Not a recipe"}`;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response.text();

    // Clean up the response (remove markdown code blocks if present)
    const cleanedResponse = response
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .trim();

    const parsed = JSON.parse(cleanedResponse);

    if (parsed.error) {
      return null;
    }

    return parsed;
  } catch (error) {
    console.error('Error parsing recipe:', error);
    return null;
  }
}

// Parse recipe from image using Gemini vision
async function parseRecipeFromImage(imageBuffer: Buffer, mimeType: string): Promise<Partial<Recipe> | null> {
  const prompt = `Look at this image and extract any recipe information you can see.

Return ONLY valid JSON (no markdown, no code blocks) in this exact format:
{
  "name": "Recipe Name",
  "description": "Brief description of the dish",
  "ingredients": [
    {"name": "ingredient name", "amount": "1", "unit": "cup", "category": "produce"}
  ],
  "instructions": ["Step 1 instruction", "Step 2 instruction"],
  "prepTime": 15,
  "cookTime": 20,
  "servings": 4,
  "cuisine": "Unknown",
  "difficulty": "medium",
  "tags": ["homemade"]
}

Notes:
- Extract as much information as you can see from the image
- If you can't see certain details, use reasonable defaults
- prepTime and cookTime should be in minutes (numbers only)
- If this doesn't appear to be a recipe image, return: {"error": "Not a recipe"}`;

  try {
    const base64Image = imageBuffer.toString('base64');

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: mimeType,
          data: base64Image
        }
      }
    ]);

    const response = result.response.text();
    const cleanedResponse = response
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .trim();

    const parsed = JSON.parse(cleanedResponse);

    if (parsed.error) {
      return null;
    }

    return parsed;
  } catch (error) {
    console.error('Error parsing recipe from image:', error);
    return null;
  }
}

// Check if a recipe is safe for given dietary restrictions
function isRecipeSafeForRestrictions(recipe: Recipe, restrictions: string[]): boolean {
  if (restrictions.length === 0) return true;

  const ingredientNames = recipe.ingredients.map(i => i.name.toLowerCase()).join(' ');
  const recipeTags = recipe.tags.map(t => t.toLowerCase());
  const allText = `${ingredientNames} ${recipeTags.join(' ')} ${recipe.name.toLowerCase()}`;

  for (const restriction of restrictions) {
    const r = restriction.toLowerCase();

    // Gluten check
    if (r.includes('gluten') || r.includes('celiac')) {
      if (/flour|bread|pasta|wheat|barley|rye|couscous|semolina/i.test(allText)) {
        return false;
      }
    }

    // Dairy check
    if (r.includes('dairy') || r.includes('lactose')) {
      if (/milk|cheese|cream|butter|yogurt|yoghurt|whey|casein/i.test(allText)) {
        return false;
      }
    }

    // Vegetarian check
    if (r.includes('vegetarian')) {
      if (/chicken|beef|pork|lamb|fish|salmon|tuna|shrimp|bacon|ham|meat/i.test(allText)) {
        return false;
      }
    }

    // Vegan check
    if (r.includes('vegan')) {
      if (/chicken|beef|pork|lamb|fish|salmon|tuna|shrimp|bacon|ham|meat|milk|cheese|cream|butter|egg|honey/i.test(allText)) {
        return false;
      }
    }

    // Nut allergy check
    if (r.includes('nut')) {
      if (/peanut|almond|walnut|cashew|pecan|hazelnut|pistachio|macadamia/i.test(allText)) {
        return false;
      }
    }

    // Shellfish check
    if (r.includes('shellfish')) {
      if (/shrimp|lobster|crab|clam|mussel|oyster|scallop/i.test(allText)) {
        return false;
      }
    }
  }

  return true;
}

// Check if a query is food/meal related (generic meal request)
function isMealRelatedQuery(query: string): boolean {
  const mealKeywords = /dinner|lunch|breakfast|meal|eat|food|tonight|today|hungry|supper|brunch|snack|cook|make/i;
  return mealKeywords.test(query);
}

// Find matching saved recipes
async function findMatchingSavedRecipes(
  chatId: number,
  query: string,
  restrictions: string[]
): Promise<Recipe[]> {
  try {
    const allRecipes = await firebaseService.getTelegramChatRecipes(chatId);

    // Filter out deleted recipes and those that don't match restrictions
    const safeRecipes = allRecipes.filter(recipe =>
      !(recipe as any).deleted && isRecipeSafeForRestrictions(recipe, restrictions)
    );

    if (safeRecipes.length === 0) return [];

    // Extract keywords from query (excluding common words)
    const commonWords = ['want', 'like', 'need', 'make', 'cook', 'something', 'recipe', 'for', 'the', 'and', 'what', 'should', 'can', 'could', 'tonight', 'today', 'dinner', 'lunch', 'breakfast', 'meal', 'eat', 'food', 'have', 'some', 'about', 'how'];
    const keywords = query.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2 && !commonWords.includes(w));

    // Score and rank recipes
    const scored = safeRecipes.map(recipe => {
      let score = 0;
      const searchText = `${recipe.name} ${recipe.description} ${recipe.tags.join(' ')} ${recipe.cuisine}`.toLowerCase();

      for (const keyword of keywords) {
        if (searchText.includes(keyword)) {
          score += 10;
        }
        // Check ingredients
        for (const ing of recipe.ingredients) {
          if (ing.name.toLowerCase().includes(keyword)) {
            score += 5;
          }
        }
      }

      return { recipe, score };
    });

    // Get recipes with keyword matches
    const matchedRecipes = scored
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(s => s.recipe);

    // If we have keyword matches, return them
    if (matchedRecipes.length > 0) {
      return matchedRecipes;
    }

    // If no keyword matches but it's a generic meal query and we have saved recipes,
    // return a random selection of safe recipes
    if (isMealRelatedQuery(query) && safeRecipes.length > 0) {
      // Shuffle and return up to 3 random recipes
      const shuffled = [...safeRecipes].sort(() => Math.random() - 0.5);
      return shuffled.slice(0, 3);
    }

    return [];
  } catch (error) {
    console.error('Error finding matching recipes:', error);
    return [];
  }
}

// Format recipe for display
function formatRecipeForDisplay(recipe: Recipe): string {
  let text = `📖 ${recipe.name}\n\n`;
  text += `${recipe.description}\n\n`;

  text += `⏱ Prep: ${recipe.prepTime} min | Cook: ${recipe.cookTime} min | Serves: ${recipe.servings}\n`;
  text += `🍽 ${recipe.cuisine} | ${recipe.difficulty}\n\n`;

  text += `📝 Ingredients:\n`;
  for (const ing of recipe.ingredients) {
    text += `• ${ing.amount} ${ing.unit} ${ing.name}\n`;
  }

  text += `\n👨‍🍳 Instructions:\n`;
  recipe.instructions.forEach((step, i) => {
    text += `${i + 1}. ${step}\n`;
  });

  if (recipe.tags.length > 0) {
    text += `\n🏷 ${recipe.tags.join(', ')}`;
  }

  return text;
}

// Download file from URL
async function downloadFile(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? require('https') : require('http');
    protocol.get(url, (response: any) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk: Buffer) => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    }).on('error', reject);
  });
}

/**
 * Start command
 */
bot.command('start', async (ctx) => {
  const chatId = ctx.chat.id;
  const session = getSession(chatId);
  session.conversationHistory = [];

  // Register the user in this chat
  const userName = getUserName(ctx);
  getMember(session, ctx.from.id, userName);

  const isGroup = isGroupChat(ctx);

  if (isGroup) {
    await ctx.reply(
      'Welcome to MealMind! 👨‍👩‍👧‍👦\n\n' +
      'I help your group plan meals together!\n\n' +
      'Commands:\n' +
      '/recipe - Get a recipe suggestion\n' +
      '/myrestrictions - Set YOUR dietary restrictions\n' +
      '/allrestrictions - View everyone\'s restrictions\n' +
      '/members - See who\'s in the meal planning group\n' +
      '/clear - Clear conversation history\n' +
      '/help - Show commands\n\n' +
      'Everyone in the group can set their own dietary restrictions, and I\'ll make sure recipes work for everyone!'
    );
  } else {
    await ctx.reply(
      'Welcome to MealMind!\n\n' +
      'I help you plan meals and find recipes.\n\n' +
      'Commands:\n' +
      '/recipe - Get a recipe suggestion\n' +
      '/restrictions - Set dietary restrictions\n' +
      '/clear - Clear conversation history\n' +
      '/help - Show commands\n\n' +
      'Or just chat with me about what you want to eat!\n\n' +
      'Tip: Add me to a family group chat to plan meals together!'
    );
  }
});

/**
 * Recipe command - Generate a recipe
 */
bot.command('recipe', async (ctx) => {
  await ctx.reply('What kind of meal would you like? (e.g., "quick pasta dinner", "healthy breakfast", "vegetarian lunch")');
});

/**
 * Set dietary restrictions (for private chats)
 */
bot.command('restrictions', async (ctx) => {
  const chatId = ctx.chat.id;
  await loadSessionFromDb(chatId);
  const session = getSession(chatId);
  const userName = getUserName(ctx);
  const member = getMember(session, ctx.from.id, userName);

  const args = ctx.message.text.replace('/restrictions', '').trim();

  if (!args) {
    const current = member.dietaryRestrictions.length > 0
      ? member.dietaryRestrictions.join(', ')
      : 'None set';
    await ctx.reply(
      `Current restrictions: ${current}\n\n` +
      'To set restrictions, use:\n' +
      '/restrictions gluten-free, dairy-free, nut allergy'
    );
    return;
  }

  member.dietaryRestrictions = args.split(',').map(r => r.trim());
  await saveMemberRestrictions(chatId, ctx.from.id, member);
  await ctx.reply(`Dietary restrictions saved: ${member.dietaryRestrictions.join(', ')}`);
});

/**
 * Set YOUR dietary restrictions (for group chats - same as /restrictions but clearer name)
 */
bot.command('myrestrictions', async (ctx) => {
  const chatId = ctx.chat.id;
  await loadSessionFromDb(chatId);
  const session = getSession(chatId);
  const userName = getUserName(ctx);
  const member = getMember(session, ctx.from.id, userName);

  const args = ctx.message.text.replace('/myrestrictions', '').trim();

  if (!args) {
    const current = member.dietaryRestrictions.length > 0
      ? member.dietaryRestrictions.join(', ')
      : 'None set';
    await ctx.reply(
      `${userName}'s restrictions: ${current}\n\n` +
      'To set your restrictions, use:\n' +
      '/myrestrictions gluten-free, dairy-free, nut allergy'
    );
    return;
  }

  member.dietaryRestrictions = args.split(',').map(r => r.trim());
  await saveMemberRestrictions(chatId, ctx.from.id, member);
  await ctx.reply(`${userName}'s dietary restrictions saved: ${member.dietaryRestrictions.join(', ')}`);
});

/**
 * View all restrictions in the group
 */
bot.command('allrestrictions', async (ctx) => {
  const chatId = ctx.chat.id;
  await loadSessionFromDb(chatId);
  const session = getSession(chatId);

  if (session.members.size === 0) {
    await ctx.reply('No one has set dietary restrictions yet. Use /myrestrictions to add yours!');
    return;
  }

  let message = 'Dietary restrictions in this group:\n\n';
  session.members.forEach((member) => {
    const restrictions = member.dietaryRestrictions.length > 0
      ? member.dietaryRestrictions.join(', ')
      : 'None';
    message += `${member.name}: ${restrictions}\n`;
  });

  const combined = getCombinedRestrictions(session);
  if (combined.length > 0) {
    message += `\nCombined (for recipes): ${combined.join(', ')}`;
  }

  await ctx.reply(message);
});

/**
 * View members in the group
 */
bot.command('members', async (ctx) => {
  const chatId = ctx.chat.id;
  await loadSessionFromDb(chatId);
  const session = getSession(chatId);

  if (session.members.size === 0) {
    await ctx.reply('No members registered yet. Everyone who sends a message will be added automatically!');
    return;
  }

  let message = 'Meal planning group members:\n\n';
  session.members.forEach((member) => {
    message += `- ${member.name}\n`;
  });

  await ctx.reply(message);
});

/**
 * Clear conversation
 */
bot.command('clear', async (ctx) => {
  const chatId = ctx.chat.id;
  const session = getSession(chatId);
  session.conversationHistory = [];
  await ctx.reply('Conversation cleared! Start fresh.');
});

/**
 * Help command
 */
bot.command('help', async (ctx) => {
  const isGroup = isGroupChat(ctx);

  if (isGroup) {
    await ctx.reply(
      'MealMind Commands (Group):\n\n' +
      '📖 Recipes:\n' +
      '/recipe - Get a recipe suggestion\n' +
      '/addrecipe - Add your own recipe (text, PDF, or photo)\n' +
      '/myrecipes - View saved recipes\n' +
      '/viewrecipe [#] - See full recipe details\n\n' +
      '🥗 Dietary:\n' +
      '/myrestrictions - Set YOUR dietary restrictions\n' +
      '/allrestrictions - View everyone\'s restrictions\n\n' +
      '👥 Group:\n' +
      '/members - See group members\n' +
      '/clear - Clear conversation history\n' +
      '/help - Show this message\n\n' +
      'Just type naturally to chat about meals!\n' +
      'I\'ll suggest from your saved recipes first.'
    );
  } else {
    await ctx.reply(
      'MealMind Commands:\n\n' +
      '📖 Recipes:\n' +
      '/recipe - Get a recipe suggestion\n' +
      '/addrecipe - Add your own recipe (text, PDF, or photo)\n' +
      '/myrecipes - View saved recipes\n' +
      '/viewrecipe [#] - See full recipe details\n\n' +
      '🥗 Dietary:\n' +
      '/restrictions - Set/view dietary restrictions\n\n' +
      '⚙️ Other:\n' +
      '/clear - Clear conversation history\n' +
      '/help - Show this message\n\n' +
      'Just type naturally to chat about meals!\n' +
      'I\'ll suggest from your saved recipes first.'
    );
  }
});

/**
 * Add a recipe - start capture mode
 */
bot.command('addrecipe', async (ctx) => {
  const chatId = ctx.chat.id;
  const session = getSession(chatId);
  const userId = ctx.from.id;
  const userName = getUserName(ctx);

  session.pendingRecipeCapture = {
    userId,
    userName,
    awaitingInput: true
  };

  await ctx.reply(
    '📝 Recipe Submission Mode\n\n' +
    'You can now:\n' +
    '• Paste the full recipe text\n' +
    '• Upload a PDF file with the recipe\n' +
    '• Send a photo of a recipe\n\n' +
    'Send /cancel to exit recipe submission mode.'
  );
});

/**
 * Cancel recipe capture mode
 */
bot.command('cancel', async (ctx) => {
  const chatId = ctx.chat.id;
  const session = getSession(chatId);

  if (session.pendingRecipeCapture) {
    session.pendingRecipeCapture = undefined;
    await ctx.reply('Recipe submission cancelled.');
  } else {
    await ctx.reply('Nothing to cancel.');
  }
});

/**
 * List saved recipes
 */
bot.command('myrecipes', async (ctx) => {
  const chatId = ctx.chat.id;
  const session = getSession(chatId);

  await ctx.sendChatAction('typing');

  try {
    const recipes = await firebaseService.getTelegramChatRecipes(chatId);
    const activeRecipes = recipes.filter(r => !(r as any).deleted);

    if (activeRecipes.length === 0) {
      await ctx.reply(
        '📚 No saved recipes yet!\n\n' +
        'Use /addrecipe to add your first recipe by:\n' +
        '• Pasting recipe text\n' +
        '• Uploading a PDF\n' +
        '• Sending a photo of a recipe'
      );
      return;
    }

    let message = `📚 Your Saved Recipes (${activeRecipes.length})\n\n`;

    activeRecipes.slice(0, 10).forEach((recipe, i) => {
      const tags = recipe.tags?.slice(0, 3).join(', ') || '';
      const time = (recipe.prepTime || 0) + (recipe.cookTime || 0);
      message += `${i + 1}. ${recipe.name}\n`;
      message += `   ⏱ ${time} min`;
      if (tags) message += ` | ${tags}`;
      message += `\n   Added by ${recipe.addedByUserName || 'Unknown'}\n\n`;
    });

    if (activeRecipes.length > 10) {
      message += `...and ${activeRecipes.length - 10} more`;
    }

    message += '\nUse /viewrecipe [number] to see full details';

    // Store recipe IDs for /viewrecipe command
    (session as any).lastRecipeList = activeRecipes.slice(0, 10).map(r => r.id);

    await ctx.reply(message);
  } catch (error) {
    console.error('Error fetching recipes:', error);
    await ctx.reply('Sorry, I had trouble fetching your recipes. Please try again!');
  }
});

/**
 * View a specific recipe
 */
bot.command('viewrecipe', async (ctx) => {
  const chatId = ctx.chat.id;
  const session = getSession(chatId);
  const args = ctx.message.text.replace('/viewrecipe', '').trim();

  if (!args) {
    await ctx.reply('Usage: /viewrecipe [number]\n\nFirst use /myrecipes to see your recipe list.');
    return;
  }

  const index = parseInt(args) - 1;
  const recipeList = (session as any).lastRecipeList as string[] | undefined;

  if (!recipeList || index < 0 || index >= recipeList.length) {
    await ctx.reply('Invalid recipe number. Use /myrecipes to see available recipes.');
    return;
  }

  await ctx.sendChatAction('typing');

  try {
    const recipes = await firebaseService.getTelegramChatRecipes(chatId);
    const recipe = recipes.find(r => r.id === recipeList[index]);

    if (!recipe || (recipe as any).deleted) {
      await ctx.reply('Recipe not found or has been deleted.');
      return;
    }

    const text = formatRecipeForDisplay(recipe);

    await ctx.reply(text, Markup.inlineKeyboard([
      [Markup.button.callback('🍳 Make This Tonight', `use_saved_${recipe.id}`)],
      [Markup.button.callback('🗑 Delete Recipe', `delete_recipe_${recipe.id}`)]
    ]));
  } catch (error) {
    console.error('Error viewing recipe:', error);
    await ctx.reply('Sorry, I had trouble loading the recipe. Please try again!');
  }
});

/**
 * Handle saved recipe actions
 */
bot.action(/use_saved_(.+)/, async (ctx) => {
  const recipeId = ctx.match[1];
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const session = getSession(chatId);
  const isGroup = ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup';

  try {
    const recipes = await firebaseService.getTelegramChatRecipes(chatId);
    const recipe = recipes.find(r => r.id === recipeId);

    if (!recipe) {
      await ctx.answerCbQuery('Recipe not found!');
      return;
    }

    await ctx.answerCbQuery('Great choice!');

    const text = formatRecipeForDisplay(recipe);

    // Set as current recipe for voting
    session.lastRecipeId = recipe.id;
    session.lastRecipeText = text;
    session.pendingVotes = undefined;

    const votingNote = isGroup && session.members.size > 1
      ? '\n\n👆 Everyone vote on this recipe!'
      : '';

    await ctx.reply(
      `🍳 Let's make this!\n\n${text}${votingNote}`,
      Markup.inlineKeyboard([
        Markup.button.callback('❤️ Love it', 'feedback_love'),
        Markup.button.callback('👍 Good', 'feedback_like'),
        Markup.button.callback('👎 Not for me', 'feedback_dislike')
      ])
    );
  } catch (error) {
    console.error('Error using saved recipe:', error);
    await ctx.answerCbQuery('Error loading recipe');
  }
});

bot.action(/delete_recipe_(.+)/, async (ctx) => {
  const recipeId = ctx.match[1];
  const chatId = ctx.chat?.id;
  const userId = ctx.from?.id;
  if (!chatId || !userId) return;

  try {
    const deleted = await firebaseService.deleteTelegramRecipe(recipeId, userId);

    if (deleted) {
      await ctx.answerCbQuery('Recipe deleted!');
      await ctx.editMessageText('🗑 This recipe has been deleted.');
    } else {
      await ctx.answerCbQuery('You can only delete recipes you added.');
    }
  } catch (error) {
    console.error('Error deleting recipe:', error);
    await ctx.answerCbQuery('Error deleting recipe');
  }
});

/**
 * Handle "Generate New Recipe" button
 */
bot.action('generate_new_recipe', async (ctx) => {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  await ctx.answerCbQuery('Generating a new recipe...');
  await ctx.editMessageReplyMarkup(undefined);

  const session = getSession(chatId);
  const isGroup = ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup';

  await ctx.sendChatAction('typing');

  try {
    const combinedRestrictions = getCombinedRestrictions(session);
    const restrictionsText = combinedRestrictions.length > 0
      ? `\n\nDIETARY RESTRICTIONS (must comply for all group members): ${combinedRestrictions.join(', ')}`
      : '';

    const prompt = `You are MealMind, a helpful meal planning assistant on Telegram.
${isGroup ? `This is a group chat with ${session.members.size} members planning meals together.` : ''}
${restrictionsText}

Generate a recipe suggestion. Include:
- Recipe name
- Brief description
- Ingredients list (with amounts)
- Step-by-step instructions
- Cooking time

Keep it concise but complete. Use emojis sparingly for visual appeal.`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = cleanMarkdown(response.text());

    session.lastRecipeId = generateRecipeId();
    session.lastRecipeText = text;
    session.pendingVotes = undefined;

    const votingNote = isGroup && session.members.size > 1
      ? '\n\n👆 Everyone vote on this recipe!'
      : '';

    await ctx.reply(
      text + votingNote,
      Markup.inlineKeyboard([
        Markup.button.callback('❤️ Love it', 'feedback_love'),
        Markup.button.callback('👍 Good', 'feedback_like'),
        Markup.button.callback('👎 Not for me', 'feedback_dislike')
      ])
    );
  } catch (error) {
    console.error('Error generating recipe:', error);
    await ctx.reply('Sorry, I had trouble generating a recipe. Please try again!');
  }
});

/**
 * Handle PDF uploads
 */
bot.on('document', async (ctx) => {
  const chatId = ctx.chat.id;
  const session = getSession(chatId);
  const userId = ctx.from.id;
  const userName = getUserName(ctx);

  // Check if in recipe capture mode
  if (!session.pendingRecipeCapture?.awaitingInput) {
    // Not in capture mode, but if it's a PDF, offer to add as recipe
    if (ctx.message.document.mime_type === 'application/pdf') {
      await ctx.reply(
        'I see you sent a PDF! Would you like me to extract a recipe from it?\n\n' +
        'Use /addrecipe first, then send the PDF.'
      );
    }
    return;
  }

  const doc = ctx.message.document;

  if (doc.mime_type !== 'application/pdf') {
    await ctx.reply('Please send a PDF file, or paste the recipe text directly.');
    return;
  }

  // Check file size - Telegram API has a 20MB limit for getFile
  const fileSize = doc.file_size || 0;
  const maxSize = 20 * 1024 * 1024; // 20MB in bytes

  if (fileSize > maxSize) {
    await ctx.reply(
      '📄 This PDF is too large (over 20MB).\n\n' +
      'Please try one of these alternatives:\n' +
      '• Copy and paste the recipe text directly\n' +
      '• Take a photo of the recipe\n' +
      '• Use a smaller PDF file'
    );
    session.pendingRecipeCapture = undefined;
    return;
  }

  await ctx.reply('📄 Processing PDF...');
  await ctx.sendChatAction('typing');

  try {
    // Download the file
    const fileLink = await ctx.telegram.getFileLink(doc.file_id);
    const fileBuffer = await downloadFile(fileLink.href);

    // Parse PDF
    const pdfParse = require('pdf-parse');
    const pdfData = await pdfParse(fileBuffer);
    const pdfText = pdfData.text;

    if (!pdfText || pdfText.trim().length < 50) {
      await ctx.reply('Could not extract enough text from this PDF. Try pasting the recipe text directly.');
      session.pendingRecipeCapture = undefined;
      return;
    }

    // Parse recipe from extracted text
    const parsedRecipe = await parseRecipeText(pdfText);

    if (!parsedRecipe) {
      await ctx.reply('Could not identify a recipe in this PDF. Try pasting the recipe text directly.');
      session.pendingRecipeCapture = undefined;
      return;
    }

    // Save the recipe
    const recipeId = await firebaseService.saveTelegramRecipe(
      chatId,
      parsedRecipe as any,
      { userId, userName }
    );

    session.pendingRecipeCapture = undefined;

    await ctx.reply(
      `✅ Recipe saved: ${parsedRecipe.name}\n\n` +
      `📖 ${parsedRecipe.description || ''}\n` +
      `⏱ ${parsedRecipe.prepTime || 0} + ${parsedRecipe.cookTime || 0} min\n\n` +
      `Use /myrecipes to see all your saved recipes!`
    );
  } catch (error) {
    console.error('Error processing PDF:', error);
    await ctx.reply('Sorry, I had trouble processing that PDF. Try pasting the recipe text directly.');
    session.pendingRecipeCapture = undefined;
  }
});

/**
 * Handle photo uploads (recipe images)
 */
bot.on('photo', async (ctx) => {
  const chatId = ctx.chat.id;
  const session = getSession(chatId);
  const userId = ctx.from.id;
  const userName = getUserName(ctx);

  // Check if in recipe capture mode
  if (!session.pendingRecipeCapture?.awaitingInput) {
    await ctx.reply(
      'I see you sent a photo! Would you like me to extract a recipe from it?\n\n' +
      'Use /addrecipe first, then send the photo.'
    );
    return;
  }

  await ctx.reply('📷 Analyzing image...');
  await ctx.sendChatAction('typing');

  try {
    // Get the largest photo size
    const photos = ctx.message.photo;
    const largestPhoto = photos[photos.length - 1];

    // Download the file
    const fileLink = await ctx.telegram.getFileLink(largestPhoto.file_id);
    const fileBuffer = await downloadFile(fileLink.href);

    // Determine mime type (Telegram photos are typically JPEG)
    const mimeType = 'image/jpeg';

    // Parse recipe from image using Gemini vision
    const parsedRecipe = await parseRecipeFromImage(fileBuffer, mimeType);

    if (!parsedRecipe) {
      await ctx.reply('Could not identify a recipe in this image. Try a clearer photo or paste the recipe text directly.');
      session.pendingRecipeCapture = undefined;
      return;
    }

    // Save the recipe
    const recipeId = await firebaseService.saveTelegramRecipe(
      chatId,
      parsedRecipe as any,
      { userId, userName }
    );

    session.pendingRecipeCapture = undefined;

    await ctx.reply(
      `✅ Recipe saved: ${parsedRecipe.name}\n\n` +
      `📖 ${parsedRecipe.description || ''}\n` +
      `⏱ ${parsedRecipe.prepTime || 0} + ${parsedRecipe.cookTime || 0} min\n\n` +
      `Use /myrecipes to see all your saved recipes!`
    );
  } catch (error) {
    console.error('Error processing photo:', error);
    await ctx.reply('Sorry, I had trouble analyzing that photo. Try a clearer image or paste the recipe text directly.');
    session.pendingRecipeCapture = undefined;
  }
});

/**
 * Handle feedback button callbacks
 */
bot.action(/feedback_(.+)/, async (ctx) => {
  const feedback = ctx.match[1] as 'love' | 'like' | 'dislike';
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const session = getSession(chatId);
  const userId = ctx.from.id;
  const userName = ctx.from.first_name || ctx.from.username || 'Someone';
  const isGroup = ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup';

  // For private chats, just acknowledge and remove buttons
  if (!isGroup) {
    let message = '';
    switch (feedback) {
      case 'love':
        message = '❤️ You loved this recipe! I\'ll suggest more like it.';
        break;
      case 'like':
        message = '👍 Thanks for the feedback!';
        break;
      case 'dislike':
        message = '👎 Got it, I\'ll suggest something different next time.';
        break;
    }
    await ctx.answerCbQuery(message);
    await ctx.editMessageReplyMarkup(undefined);
    return;
  }

  // Group chat voting logic
  // Make sure voting user is registered as a member (so they count toward total)
  getMember(session, userId, userName);

  // Initialize pending votes if not exists
  if (!session.pendingVotes || session.pendingVotes.recipeId !== session.lastRecipeId) {
    session.pendingVotes = {
      recipeId: session.lastRecipeId || '',
      votes: new Map()
    };
  }

  // Check if user already voted
  if (session.pendingVotes.votes.has(userId)) {
    await ctx.answerCbQuery('You already voted! Waiting for others...');
    return;
  }

  // Register vote
  session.pendingVotes.votes.set(userId, feedback);

  const emoji = feedback === 'love' ? '❤️' : feedback === 'like' ? '👍' : '👎';

  // Check if everyone has voted
  const totalMembers = session.members.size;
  const votedCount = session.pendingVotes.votes.size;

  // Build status message
  const statusMessage = getVotingStatus(session);

  // If someone dislikes, immediately reject and suggest new recipe
  if (feedback === 'dislike') {
    await ctx.answerCbQuery(`${emoji} Got it, suggesting something else...`);
    await ctx.editMessageReplyMarkup(undefined); // Remove buttons

    // Generate a new recipe automatically
    await ctx.sendChatAction('typing');

    try {
      const combinedRestrictions = getCombinedRestrictions(session);
      const restrictionsText = combinedRestrictions.length > 0
        ? `\n\nDIETARY RESTRICTIONS (must comply for all group members): ${combinedRestrictions.join(', ')}`
        : '';

      const prompt = `You are MealMind, a helpful meal planning assistant on Telegram.
This is a group chat with ${session.members.size} members planning meals together.
${restrictionsText}

The previous recipe suggestion was rejected by ${userName}. Please suggest a DIFFERENT recipe.
Generate a new recipe suggestion. Include:
- Recipe name
- Brief description
- Ingredients list (with amounts)
- Step-by-step instructions
- Cooking time

Keep it concise but complete. Use emojis sparingly for visual appeal.`;

      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = cleanMarkdown(response.text());

      // Save new recipe
      session.lastRecipeId = generateRecipeId();
      session.lastRecipeText = text;
      session.pendingVotes = undefined;

      const votingNote = '\n\n👆 Everyone vote on this recipe! Once all members vote, I\'ll confirm the meal and provide a shopping list.';

      await ctx.reply(
        `👎 ${userName} wasn't feeling that one. Here's another option:\n\n${text}${votingNote}`,
        Markup.inlineKeyboard([
          Markup.button.callback('❤️ Love it', 'feedback_love'),
          Markup.button.callback('👍 Good', 'feedback_like'),
          Markup.button.callback('👎 Not for me', 'feedback_dislike')
        ])
      );
    } catch (error) {
      console.error('Error generating new recipe:', error);
      await ctx.reply('Sorry, I had trouble suggesting another recipe. Please try asking again!');
    }
    return;
  }

  // For love/like votes
  if (votedCount < totalMembers) {
    // Not everyone has voted yet - just acknowledge silently
    await ctx.answerCbQuery(`${emoji} Vote recorded! Waiting for ${totalMembers - votedCount} more...`);
  } else {
    // Everyone has voted and all approved! 🎉
    await ctx.answerCbQuery('🎉 Everyone approved!');
    await ctx.editMessageReplyMarkup(undefined); // Remove buttons

    // Generate shopping list
    const shoppingList = extractShoppingList(session.lastRecipeText || '');

    await ctx.reply(
      `🎉 Everyone approved! That's tonight's meal!\n\n` +
      `📊 Final votes:\n${statusMessage}\n\n` +
      `${shoppingList}\n\n` +
      `Enjoy your meal! 🍽️`
    );
    session.pendingVotes = undefined;
  }
});

/**
 * Handle regular messages
 */
bot.on('text', async (ctx) => {
  const chatId = ctx.chat.id;
  await loadSessionFromDb(chatId);
  const session = getSession(chatId);
  const userName = getUserName(ctx);
  const userId = ctx.from.id;
  await getMemberAsync(chatId, session, userId, userName);
  const userMessage = ctx.message.text;
  const isGroup = isGroupChat(ctx);

  // Check if in recipe capture mode
  if (session.pendingRecipeCapture?.awaitingInput) {
    await ctx.sendChatAction('typing');

    // Try to parse the text as a recipe
    const parsedRecipe = await parseRecipeText(userMessage);

    if (!parsedRecipe) {
      await ctx.reply(
        'I couldn\'t identify a recipe in that text. Please make sure it includes:\n' +
        '• Recipe name\n' +
        '• Ingredients list\n' +
        '• Instructions\n\n' +
        'Or send /cancel to exit recipe submission mode.'
      );
      return;
    }

    // Save the recipe
    try {
      await firebaseService.saveTelegramRecipe(
        chatId,
        parsedRecipe as any,
        { userId, userName }
      );

      session.pendingRecipeCapture = undefined;

      await ctx.reply(
        `✅ Recipe saved: ${parsedRecipe.name}\n\n` +
        `📖 ${parsedRecipe.description || ''}\n` +
        `⏱ ${parsedRecipe.prepTime || 0} + ${parsedRecipe.cookTime || 0} min\n\n` +
        `Use /myrecipes to see all your saved recipes!`
      );
    } catch (error) {
      console.error('Error saving recipe:', error);
      await ctx.reply('Sorry, I had trouble saving that recipe. Please try again!');
      session.pendingRecipeCapture = undefined;
    }
    return;
  }

  // Add to history (with user name for group chats)
  session.conversationHistory.push({
    role: 'user',
    content: userMessage,
    userName: isGroup ? userName : undefined
  });

  // Keep history manageable
  if (session.conversationHistory.length > 10) {
    session.conversationHistory = session.conversationHistory.slice(-10);
  }

  await ctx.sendChatAction('typing');

  try {
    // Get combined restrictions for all members in this chat
    const combinedRestrictions = getCombinedRestrictions(session);
    const restrictionsText = combinedRestrictions.length > 0
      ? `\n\nDIETARY RESTRICTIONS (must comply for all group members): ${combinedRestrictions.join(', ')}`
      : '';

    // Build history text (include user names for group chats)
    const historyText = session.conversationHistory
      .slice(0, -1) // Exclude current message
      .map(m => {
        if (m.userName) {
          return `${m.userName}: ${m.content}`;
        }
        return `${m.role}: ${m.content}`;
      })
      .join('\n');

    const isRecipeRequest = /recipe|suggest|cook|make|eat|meal|dinner|lunch|breakfast|hungry|food/i.test(userMessage);

    // Build context about the group
    const groupContext = isGroup && session.members.size > 1
      ? `\nThis is a group chat with ${session.members.size} members planning meals together.`
      : '';

    let prompt: string;

    if (isRecipeRequest) {
      // First check for matching saved recipes
      const matchingRecipes = await findMatchingSavedRecipes(chatId, userMessage, combinedRestrictions);

      if (matchingRecipes.length > 0) {
        // Offer saved recipes first
        let message = `📚 I found ${matchingRecipes.length} recipe(s) from your collection that might work!\n\n`;

        matchingRecipes.forEach((recipe, i) => {
          const time = (recipe.prepTime || 0) + (recipe.cookTime || 0);
          message += `${i + 1}. ${recipe.name}\n`;
          message += `   ⏱ ${time} min | ${recipe.cuisine || 'Various'}\n\n`;
        });

        message += 'Choose a recipe or tap "Generate New" for a fresh suggestion!';

        // Build keyboard with recipe options
        const buttons = matchingRecipes.map((recipe, i) =>
          [Markup.button.callback(`${i + 1}. ${recipe.name.slice(0, 25)}`, `use_saved_${recipe.id}`)]
        );
        buttons.push([Markup.button.callback('✨ Generate New Recipe', 'generate_new_recipe')]);

        await ctx.reply(message, Markup.inlineKeyboard(buttons));
        return;
      }

      // No matching saved recipes, generate new one
      prompt = `You are MealMind, a helpful meal planning assistant on Telegram.${groupContext}
${restrictionsText}

${historyText ? `Previous conversation:\n${historyText}\n\n` : ''}${isGroup ? `${userName}: ` : 'User: '}${userMessage}

Generate a recipe suggestion. Include:
- Recipe name
- Brief description
- Ingredients list (with amounts)
- Step-by-step instructions
- Cooking time

Keep it concise but complete. Use emojis sparingly for visual appeal.`;
    } else {
      prompt = `You are MealMind, a friendly meal planning assistant on Telegram.${groupContext}
${restrictionsText}

${historyText ? `Previous conversation:\n${historyText}\n\n` : ''}${isGroup ? `${userName}: ` : 'User: '}${userMessage}

Respond helpfully and conversationally. If they seem to want food suggestions, offer to help with recipes.`;
    }

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = cleanMarkdown(response.text());

    // Add to history
    session.conversationHistory.push({ role: 'assistant', content: text });

    // Send response with feedback buttons if it's a recipe
    if (isRecipeRequest) {
      session.lastRecipeId = generateRecipeId();
      session.lastRecipeText = text; // Save for shopping list extraction
      session.pendingVotes = undefined; // Reset any previous votes

      // In group chats, add voting instructions
      const votingNote = isGroup && session.members.size > 1
        ? '\n\n👆 Everyone vote on this recipe! Once all members vote, I\'ll confirm the meal and provide a shopping list.'
        : '';

      const recipeWithNote = text + votingNote;

      // Send with inline keyboard for feedback
      if (recipeWithNote.length > 4000) {
        const chunks: string[] = [];
        for (let i = 0; i < recipeWithNote.length; i += 4000) {
          chunks.push(recipeWithNote.slice(i, i + 4000));
        }
        // Send all but the last chunk without buttons
        for (let i = 0; i < chunks.length - 1; i++) {
          await ctx.reply(chunks[i]);
        }
        // Send the last chunk with feedback buttons
        await ctx.reply(chunks[chunks.length - 1],
          Markup.inlineKeyboard([
            Markup.button.callback('❤️ Love it', 'feedback_love'),
            Markup.button.callback('👍 Good', 'feedback_like'),
            Markup.button.callback('👎 Not for me', 'feedback_dislike')
          ])
        );
      } else {
        await ctx.reply(recipeWithNote,
          Markup.inlineKeyboard([
            Markup.button.callback('❤️ Love it', 'feedback_love'),
            Markup.button.callback('👍 Good', 'feedback_like'),
            Markup.button.callback('👎 Not for me', 'feedback_dislike')
          ])
        );
      }
    } else {
      // Regular message without feedback buttons
      if (text.length > 4000) {
        const chunks: string[] = [];
        for (let i = 0; i < text.length; i += 4000) {
          chunks.push(text.slice(i, i + 4000));
        }
        for (const chunk of chunks) {
          await ctx.reply(chunk);
        }
      } else {
        await ctx.reply(text);
      }
    }

  } catch (error) {
    console.error('Error:', error);
    await ctx.reply('Sorry, I had trouble processing that. Please try again!');
  }
});

// Error handling
bot.catch((err, ctx) => {
  console.error('Bot error:', err);
  ctx.reply('Something went wrong! Please try again.');
});

// Start bot
async function main() {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.error('Error: TELEGRAM_BOT_TOKEN is not set');
    console.log('\nTo use the Telegram bot:');
    console.log('1. Message @BotFather on Telegram');
    console.log('2. Send /newbot and follow prompts');
    console.log('3. Add TELEGRAM_BOT_TOKEN=your_token to .env');
    process.exit(1);
  }

  if (!process.env.GEMINI_API_KEY) {
    console.error('Error: GEMINI_API_KEY is not set');
    process.exit(1);
  }

  console.log('Starting MealMind Telegram Bot...');
  await bot.launch();
  console.log('Bot is running! Message your bot on Telegram.');
}

main();

// Graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
