import { NextRequest, NextResponse } from 'next/server';
import { firebaseService } from '@/lib/firebase';
import { opikService } from '@/lib/opik';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { recipeId, feedback, userId = 'demo-user' } = body;

    if (!recipeId || !feedback) {
      return NextResponse.json(
        { error: 'Missing recipeId or feedback' },
        { status: 400 }
      );
    }

    // Map feedback to reaction type
    const reactionType = feedback === 'love' ? 'love'
      : feedback === 'like' ? 'like'
      : feedback === 'dislike' ? 'dislike'
      : 'reject';

    // Save feedback to Firebase
    await firebaseService.saveFeedback({
      messageId: recipeId,
      userId,
      type: reactionType,
      timestamp: new Date()
    });

    // Log feedback to Opik for analytics
    await opikService.logUserFeedback(recipeId, userId, reactionType);

    return NextResponse.json({
      success: true,
      message: 'Feedback saved successfully'
    });

  } catch (error) {
    console.error('Feedback API error:', error);
    return NextResponse.json(
      { error: 'Failed to save feedback' },
      { status: 500 }
    );
  }
}