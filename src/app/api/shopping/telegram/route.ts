import { NextRequest, NextResponse } from 'next/server';
import { firebaseService } from '../../../../lib/firebase';

// POST - Send shopping list to Telegram
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { shoppingListId, chatId } = body;

    if (!shoppingListId) {
      return NextResponse.json(
        { error: 'shoppingListId is required' },
        { status: 400 }
      );
    }

    // Check for Telegram bot token
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      return NextResponse.json(
        { error: 'Telegram bot not configured' },
        { status: 500 }
      );
    }

    // Get the shopping list
    const shoppingList = await firebaseService.getMealPlanShoppingListById(shoppingListId);
    if (!shoppingList) {
      return NextResponse.json(
        { error: 'Shopping list not found' },
        { status: 404 }
      );
    }

    // Get unchecked items only (items to buy)
    const itemsToBuy = shoppingList.items.filter(item => !item.checked);

    if (itemsToBuy.length === 0) {
      return NextResponse.json(
        { error: 'No items to buy - all items are checked off' },
        { status: 400 }
      );
    }

    // Group items by category
    const groupedItems: Record<string, typeof itemsToBuy> = {};
    for (const item of itemsToBuy) {
      const category = item.category || 'Other';
      if (!groupedItems[category]) {
        groupedItems[category] = [];
      }
      groupedItems[category].push(item);
    }

    // Format message for Telegram
    let message = '🛒 *Shopping List*\n';
    message += `📅 Week of ${new Date(shoppingList.weekStartDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}\n\n`;

    const categories = Object.keys(groupedItems).sort();
    for (const category of categories) {
      message += `*${category}*\n`;
      for (const item of groupedItems[category]) {
        message += `☐ ${item.amount} ${item.unit} ${item.ingredientName}\n`;
      }
      message += '\n';
    }

    message += `_${itemsToBuy.length} items to buy_`;

    // Get chat ID - try to find the user's Telegram chat
    // First check if a specific chatId was provided
    let targetChatId = chatId;

    if (!targetChatId) {
      // Try to get the first registered Telegram chat from Firebase
      // This is a simplified approach - in production, you'd want to associate
      // the web user with their Telegram chat ID
      try {
        const telegramChats = await firebaseService.getAllTelegramChats();
        if (telegramChats && telegramChats.length > 0) {
          targetChatId = telegramChats[0].chatId;
        }
      } catch (error) {
        console.error('Error fetching telegram chats:', error);
      }
    }

    if (!targetChatId) {
      return NextResponse.json(
        {
          error: 'No Telegram connection found. Please connect your Telegram account first by visiting Settings and clicking "Open Telegram & Connect".',
          requiresSetup: true
        },
        { status: 400 }
      );
    }

    // Send message via Telegram API
    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: targetChatId,
          text: message,
          parse_mode: 'Markdown'
        })
      }
    );

    const telegramResult = await telegramResponse.json();

    if (!telegramResult.ok) {
      console.error('Telegram API error:', telegramResult);
      return NextResponse.json(
        { error: telegramResult.description || 'Failed to send to Telegram' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Shopping list sent to Telegram',
      itemCount: itemsToBuy.length
    });
  } catch (error) {
    console.error('Send to Telegram error:', error);
    return NextResponse.json(
      { error: 'Failed to send shopping list to Telegram' },
      { status: 500 }
    );
  }
}
