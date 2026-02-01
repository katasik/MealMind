import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  Firestore
} from 'firebase/firestore';
import type {
  User,
  Family,
  Recipe,
  ChatMessage,
  FeedbackReaction,
  ShoppingList,
  DietaryRestriction,
  MealPlan,
  MealPlanStatus,
  MealType,
  PlannedMeal,
  MealPlanShoppingList,
  MealPlanShoppingItem
} from '../types';
import {
  DEMO_FAMILY_ID,
  generateDemoMealPlan,
  generateDemoShoppingList
} from './demo-data';

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};

class FirebaseService {
  private app: FirebaseApp | null = null;
  private db: Firestore | null = null;
  private mockMode: boolean = false;

  constructor() {
    // Check if Firebase is configured
    if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
      console.log('Firebase not configured - running in mock mode');
      this.mockMode = true;
      return;
    }

    // Initialize Firebase
    if (!getApps().length) {
      this.app = initializeApp(firebaseConfig);
    } else {
      this.app = getApps()[0];
    }

    this.db = getFirestore(this.app);
  }

  // Mock data for demo purposes
  private mockFamily: Family = {
    id: 'demo-family',
    name: 'Demo Family',
    members: ['demo-user'],
    dietaryRestrictions: [],
    createdAt: new Date()
  };

  private mockUser: User = {
    id: 'demo-user',
    name: 'Demo User',
    familyId: 'demo-family',
    preferences: {
      favoriteIngredients: ['chicken', 'pasta', 'tomatoes'],
      dislikedIngredients: [],
      cuisinePreferences: ['Italian', 'Mexican', 'Asian'],
      cookingTime: 'moderate'
    },
    createdAt: new Date()
  };

  private mockRecipes: Recipe[] = [];

  // Family Operations
  async createFamily(family: Omit<Family, 'id' | 'createdAt'>): Promise<Family> {
    const familyId = this.generateId();
    const newFamily: Family = {
      ...family,
      id: familyId,
      createdAt: new Date()
    };

    if (this.mockMode || !this.db) {
      this.mockFamily = newFamily;
      return newFamily;
    }

    await setDoc(doc(this.db, 'families', familyId), newFamily);
    return newFamily;
  }

  async getFamily(familyId: string): Promise<Family | null> {
    if (this.mockMode || !this.db) {
      return this.mockFamily;
    }

    const docRef = doc(this.db, 'families', familyId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return docSnap.data() as Family;
    }
    return null;
  }

  async updateFamily(familyId: string, updates: Partial<Family>): Promise<void> {
    if (this.mockMode || !this.db) {
      this.mockFamily = { ...this.mockFamily, ...updates };
      return;
    }

    await setDoc(doc(this.db, 'families', familyId), updates, { merge: true });
  }

  // User Operations
  async createUser(user: Omit<User, 'id' | 'createdAt'>): Promise<User> {
    const userId = this.generateId();
    const newUser: User = {
      ...user,
      id: userId,
      createdAt: new Date()
    };

    if (this.mockMode || !this.db) {
      this.mockUser = newUser;
      return newUser;
    }

    await setDoc(doc(this.db, 'users', userId), newUser);

    // Add user to family members
    const family = await this.getFamily(user.familyId);
    if (family) {
      family.members.push(userId);
      await this.updateFamily(user.familyId, { members: family.members });
    }

    return newUser;
  }

  async getUser(userId: string): Promise<User | null> {
    if (this.mockMode || !this.db) {
      return this.mockUser;
    }

    const docRef = doc(this.db, 'users', userId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return docSnap.data() as User;
    }

    // For demo user, create with defaults if doesn't exist
    if (userId === 'demo-user') {
      console.log('[Firebase] Creating default demo user');
      const defaultUser: User = {
        id: 'demo-user',
        name: 'Demo User',
        familyId: 'demo-family',
        preferences: {
          favoriteIngredients: [],
          dislikedIngredients: [],
          cuisinePreferences: [],
          cookingTime: 'moderate'
        },
        createdAt: new Date()
      };
      await setDoc(docRef, defaultUser);
      return defaultUser;
    }

    return null;
  }

  async getFamilyMembers(familyId: string): Promise<User[]> {
    if (this.mockMode || !this.db) {
      return [this.mockUser];
    }

    const q = query(
      collection(this.db, 'users'),
      where('familyId', '==', familyId)
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => doc.data() as User);
  }

  // Recipe Operations
  async saveRecipe(recipe: Recipe): Promise<void> {
    if (this.mockMode || !this.db) {
      console.log('Recipe saved (mock):', recipe.name);
      return;
    }

    await setDoc(doc(this.db, 'recipes', recipe.id), recipe);
  }

  async getRecipe(recipeId: string): Promise<Recipe | null> {
    if (this.mockMode || !this.db) {
      return null;
    }

    const docRef = doc(this.db, 'recipes', recipeId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return docSnap.data() as Recipe;
    }
    return null;
  }

  async getRecentRecipes(familyId: string, days: number = 7): Promise<Recipe[]> {
    if (this.mockMode || !this.db) {
      return [];
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const q = query(
      collection(this.db, 'recipes'),
      where('familyId', '==', familyId),
      where('createdAt', '>=', cutoffDate),
      orderBy('createdAt', 'desc')
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => doc.data() as Recipe);
  }

  // Chat Operations
  async saveChatMessage(message: ChatMessage): Promise<void> {
    if (this.mockMode || !this.db) {
      console.log('Message saved (mock):', message.content.substring(0, 50));
      return;
    }

    await setDoc(doc(this.db, 'messages', message.id), message);
  }

  async getConversationHistory(
    familyId: string,
    limitCount: number = 10
  ): Promise<ChatMessage[]> {
    if (this.mockMode || !this.db) {
      return [];
    }

    const q = query(
      collection(this.db, 'messages'),
      where('familyId', '==', familyId),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs
      .map(doc => doc.data() as ChatMessage)
      .reverse(); // Return in chronological order
  }

  // Feedback Operations
  async saveFeedback(feedback: FeedbackReaction): Promise<void> {
    if (this.mockMode || !this.db) {
      console.log('Feedback saved (mock):', feedback.type);
      return;
    }

    const feedbackId = `${feedback.messageId}_${feedback.userId}`;
    await setDoc(doc(this.db, 'feedback', feedbackId), feedback);
  }

  async getRecipeFeedback(recipeId: string): Promise<FeedbackReaction[]> {
    if (this.mockMode || !this.db) {
      return [];
    }

    const q = query(
      collection(this.db, 'feedback'),
      where('messageId', '==', recipeId)
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => doc.data() as FeedbackReaction);
  }

  // Shopping List Operations
  async saveShoppingList(list: ShoppingList): Promise<void> {
    if (this.mockMode || !this.db) {
      console.log('Shopping list saved (mock)');
      return;
    }

    await setDoc(doc(this.db, 'shoppingLists', list.id), list);
  }

  async getActiveShoppingList(familyId: string): Promise<ShoppingList | null> {
    if (this.mockMode || !this.db) {
      return null;
    }

    const q = query(
      collection(this.db, 'shoppingLists'),
      where('familyId', '==', familyId),
      where('completed', '==', false),
      orderBy('createdAt', 'desc'),
      limit(1)
    );

    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      return querySnapshot.docs[0].data() as ShoppingList;
    }
    return null;
  }

  // Telegram Bot Operations
  async getTelegramChat(chatId: number): Promise<{
    members: { [odId: string]: { name: string; dietaryRestrictions: string[] } };
  } | null> {
    if (this.mockMode || !this.db) {
      return null;
    }

    const docRef = doc(this.db, 'telegramChats', String(chatId));
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return docSnap.data() as {
        members: { [odId: string]: { name: string; dietaryRestrictions: string[] } };
      };
    }
    return null;
  }

  async saveTelegramChat(chatId: number, data: {
    members: { [odId: string]: { name: string; dietaryRestrictions: string[] } };
  }): Promise<void> {
    if (this.mockMode || !this.db) {
      console.log('Telegram chat saved (mock):', chatId);
      return;
    }

    await setDoc(doc(this.db, 'telegramChats', String(chatId)), {
      ...data,
      updatedAt: new Date()
    }, { merge: true });
  }

  async saveTelegramMember(chatId: number, odId: number, member: {
    name: string;
    dietaryRestrictions: string[];
  }): Promise<void> {
    if (this.mockMode || !this.db) {
      console.log('Telegram member saved (mock):', odId);
      return;
    }

    // First get existing data, then merge
    const docRef = doc(this.db, 'telegramChats', String(chatId));
    const docSnap = await getDoc(docRef);

    const existingData = docSnap.exists() ? docSnap.data() : {};
    const existingMembers = existingData.members || {};

    await setDoc(docRef, {
      members: {
        ...existingMembers,
        [String(odId)]: member
      },
      updatedAt: new Date()
    }, { merge: true });
  }

  async getAllTelegramChats(): Promise<{ chatId: number; members: { [userId: string]: { name: string; dietaryRestrictions: string[] } } }[]> {
    if (this.mockMode || !this.db) {
      console.log('Getting all telegram chats (mock)');
      return [];
    }

    const querySnapshot = await getDocs(collection(this.db, 'telegramChats'));
    return querySnapshot.docs.map(doc => ({
      chatId: Number(doc.id),
      members: doc.data().members || {}
    }));
  }

  async registerTelegramChat(chatId: number, username: string, familyId?: string): Promise<void> {
    if (this.mockMode || !this.db) {
      console.log('Telegram chat registered (mock):', chatId);
      return;
    }

    const docRef = doc(this.db, 'telegramChats', String(chatId));
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      await setDoc(docRef, {
        username,
        familyId: familyId || null,
        registeredAt: new Date(),
        updatedAt: new Date()
      });
    } else {
      const updateData: any = {
        username,
        updatedAt: new Date()
      };
      if (familyId) {
        updateData.familyId = familyId;
      }
      await setDoc(docRef, updateData, { merge: true });
    }
  }

  async linkTelegramChatToFamily(chatId: number, familyId: string): Promise<void> {
    if (this.mockMode || !this.db) {
      console.log('Telegram chat linked to family (mock):', chatId, familyId);
      return;
    }

    const docRef = doc(this.db, 'telegramChats', String(chatId));
    await setDoc(docRef, {
      familyId,
      updatedAt: new Date()
    }, { merge: true });
    console.log(`[Firebase] Linked chat ${chatId} to family ${familyId}`);
  }

  async getTelegramChatFamilyId(chatId: number): Promise<string | null> {
    if (this.mockMode || !this.db) {
      console.log('Getting telegram chat family ID (mock):', chatId);
      return null;
    }

    const docRef = doc(this.db, 'telegramChats', String(chatId));
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return docSnap.data().familyId || null;
    }
    return null;
  }

  // Telegram Recipe Operations
  async saveTelegramRecipe(
    chatId: number,
    recipe: Omit<Recipe, 'id' | 'createdAt' | 'telegramChatId' | 'addedByUserId' | 'addedByUserName' | 'source'>,
    addedBy: { userId: number; userName: string }
  ): Promise<string> {
    const recipeId = this.generateId();

    if (this.mockMode || !this.db) {
      console.log('Telegram recipe saved (mock):', recipeId);
      return recipeId;
    }

    const recipeWithMeta: Recipe = {
      ...recipe,
      id: recipeId,
      telegramChatId: chatId,
      addedByUserId: addedBy.userId,
      addedByUserName: addedBy.userName,
      source: 'user_submitted',
      createdAt: new Date()
    };

    await setDoc(doc(this.db, 'recipes', recipeId), recipeWithMeta);
    console.log(`[Firebase] Saved recipe ${recipeId} for chat ${chatId}`);
    return recipeId;
  }

  async getTelegramChatRecipes(chatId: number): Promise<Recipe[]> {
    if (this.mockMode || !this.db) {
      console.log('Getting telegram recipes (mock):', chatId);
      return [];
    }

    const q = query(
      collection(this.db, 'recipes'),
      where('telegramChatId', '==', chatId),
      orderBy('createdAt', 'desc')
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => doc.data() as Recipe);
  }

  async deleteTelegramRecipe(recipeId: string, userId: number): Promise<boolean> {
    if (this.mockMode || !this.db) {
      console.log('Deleting telegram recipe (mock):', recipeId);
      return true;
    }

    // Get recipe to check ownership
    const docRef = doc(this.db, 'recipes', recipeId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return false;
    }

    const recipe = docSnap.data() as Recipe;

    // Only allow deletion by the user who added it
    if (recipe.addedByUserId !== userId) {
      return false;
    }

    await setDoc(docRef, { deleted: true, deletedAt: new Date() }, { merge: true });
    return true;
  }

  // Web Recipe Operations
  async getWebRecipes(familyId: string): Promise<Recipe[]> {
    if (this.mockMode || !this.db) {
      console.log('Getting web recipes (mock):', familyId);
      return this.mockRecipes;
    }

    try {
      // Try query with ordering (requires composite index)
      const q = query(
        collection(this.db, 'recipes'),
        where('familyId', '==', familyId),
        orderBy('createdAt', 'desc')
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs
        .map(doc => doc.data() as Recipe)
        .filter(r => !(r as any).deleted);
    } catch (error: any) {
      // If composite index is missing, fallback to simpler query without ordering
      if (error?.code === 'failed-precondition') {
        console.log('Composite index not available, using simple query');
        const q = query(
          collection(this.db, 'recipes'),
          where('familyId', '==', familyId)
        );
        const querySnapshot = await getDocs(q);
        const recipes = querySnapshot.docs
          .map(doc => doc.data() as Recipe)
          .filter(r => !(r as any).deleted);
        // Sort in memory
        return recipes.sort((a, b) => {
          const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt as any);
          const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt as any);
          return dateB.getTime() - dateA.getTime();
        });
      }
      console.error('Error getting web recipes:', error);
      return [];
    }
  }

  async saveWebRecipe(
    familyId: string,
    recipe: Omit<Recipe, 'id' | 'createdAt' | 'familyId' | 'source'>,
    addedBy: { userId: string; userName: string }
  ): Promise<string> {
    const recipeId = this.generateId();

    if (this.mockMode || !this.db) {
      const newRecipe: Recipe = {
        ...recipe,
        id: recipeId,
        familyId,
        addedByUserId: addedBy.userId as any,
        addedByUserName: addedBy.userName,
        source: 'user_submitted',
        createdAt: new Date()
      };
      this.mockRecipes.push(newRecipe);
      console.log('Web recipe saved (mock):', recipeId);
      return recipeId;
    }

    const recipeWithMeta: Recipe = {
      ...recipe,
      id: recipeId,
      familyId,
      addedByUserId: addedBy.userId as any,
      addedByUserName: addedBy.userName,
      source: 'user_submitted',
      createdAt: new Date()
    };

    await setDoc(doc(this.db, 'recipes', recipeId), recipeWithMeta);
    console.log(`[Firebase] Saved web recipe ${recipeId} for family ${familyId}`);
    return recipeId;
  }

  async deleteWebRecipe(recipeId: string, userId: string): Promise<boolean> {
    if (this.mockMode || !this.db) {
      const index = this.mockRecipes.findIndex((r: Recipe) => r.id === recipeId);
      if (index > -1) {
        this.mockRecipes.splice(index, 1);
        console.log('Web recipe deleted (mock):', recipeId);
        return true;
      }
      return false;
    }

    const docRef = doc(this.db, 'recipes', recipeId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return false;
    }

    const recipe = docSnap.data() as Recipe;

    // Only allow deletion by the user who added it
    if (String(recipe.addedByUserId) !== userId) {
      return false;
    }

    await setDoc(docRef, { deleted: true, deletedAt: new Date() }, { merge: true });
    return true;
  }

  async getRecipeById(recipeId: string): Promise<Recipe | null> {
    if (this.mockMode || !this.db) {
      return this.mockRecipes.find((r: Recipe) => r.id === recipeId) || null;
    }

    const docRef = doc(this.db, 'recipes', recipeId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists() && !(docSnap.data() as any).deleted) {
      return docSnap.data() as Recipe;
    }
    return null;
  }

  async updateUserPreferences(userId: string, preferences: Partial<User['preferences']>): Promise<void> {
    if (this.mockMode || !this.db) {
      this.mockUser.preferences = { ...this.mockUser.preferences, ...preferences };
      console.log('User preferences updated (mock):', preferences);
      return;
    }

    // Ensure user document exists first
    const userRef = doc(this.db, 'users', userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists() && userId === 'demo-user') {
      // Create the user document first
      const defaultUser: User = {
        id: 'demo-user',
        name: 'Demo User',
        familyId: 'demo-family',
        preferences: {
          favoriteIngredients: [],
          dislikedIngredients: [],
          cuisinePreferences: [],
          cookingTime: 'moderate',
          ...preferences
        },
        createdAt: new Date()
      };
      await setDoc(userRef, defaultUser);
      console.log('[Firebase] Created demo user with preferences:', preferences);
    } else {
      // Update existing user
      await setDoc(userRef, { preferences }, { merge: true });
      console.log('[Firebase] Updated user preferences:', preferences);
    }
  }

  async updateFamilyRestrictions(familyId: string, restrictions: DietaryRestriction[]): Promise<void> {
    if (this.mockMode || !this.db) {
      this.mockFamily.dietaryRestrictions = restrictions;
      console.log('Family restrictions updated (mock):', restrictions);
      return;
    }

    await setDoc(doc(this.db, 'families', familyId), { dietaryRestrictions: restrictions }, { merge: true });
  }

  // ============================================
  // Meal Plan Operations
  // ============================================

  private mockMealPlans: MealPlan[] = [];
  private mockMealPlanShoppingLists: MealPlanShoppingList[] = [];

  async saveMealPlan(mealPlan: MealPlan): Promise<void> {
    if (this.mockMode || !this.db) {
      const existingIndex = this.mockMealPlans.findIndex(mp => mp.id === mealPlan.id);
      if (existingIndex >= 0) {
        this.mockMealPlans[existingIndex] = mealPlan;
      } else {
        this.mockMealPlans.push(mealPlan);
      }
      console.log('Meal plan saved (mock):', mealPlan.id);
      return;
    }

    await setDoc(doc(this.db, 'mealPlans', mealPlan.id), mealPlan);
    console.log('[Firebase] Meal plan saved:', mealPlan.id);
  }

  async getMealPlan(familyId: string, weekStartDate: string): Promise<MealPlan | null> {
    if (this.mockMode || !this.db) {
      return this.mockMealPlans.find(
        mp => mp.familyId === familyId && mp.weekStartDate === weekStartDate
      ) || null;
    }

    // First check Firebase for real data (even for demo-family)
    const q = query(
      collection(this.db, 'mealPlans'),
      where('familyId', '==', familyId),
      where('weekStartDate', '==', weekStartDate),
      limit(1)
    );

    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      return querySnapshot.docs[0].data() as MealPlan;
    }

    // Fall back to generated demo data only if no real data exists
    if (familyId === DEMO_FAMILY_ID) {
      const demoMealPlan = generateDemoMealPlan();
      if (demoMealPlan.weekStartDate === weekStartDate) {
        return demoMealPlan;
      }
    }

    return null;
  }

  async getMealPlanById(planId: string): Promise<MealPlan | null> {
    if (this.mockMode || !this.db) {
      return this.mockMealPlans.find(mp => mp.id === planId) || null;
    }

    const docRef = doc(this.db, 'mealPlans', planId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return docSnap.data() as MealPlan;
    }
    return null;
  }

  async updateMealPlanStatus(planId: string, status: MealPlanStatus): Promise<void> {
    if (this.mockMode || !this.db) {
      const plan = this.mockMealPlans.find(mp => mp.id === planId);
      if (plan) {
        plan.status = status;
        plan.updatedAt = new Date();
      }
      console.log('Meal plan status updated (mock):', planId, status);
      return;
    }

    await setDoc(doc(this.db, 'mealPlans', planId), {
      status,
      updatedAt: new Date()
    }, { merge: true });
    console.log('[Firebase] Meal plan status updated:', planId, status);
  }

  async updatePlannedMeal(
    planId: string,
    dayIndex: number,
    mealType: MealType,
    meal: PlannedMeal
  ): Promise<void> {
    if (this.mockMode || !this.db) {
      const plan = this.mockMealPlans.find(mp => mp.id === planId);
      if (plan && plan.days[dayIndex]) {
        const mealIndex = plan.days[dayIndex].meals.findIndex(m => m.mealType === mealType);
        if (mealIndex >= 0) {
          plan.days[dayIndex].meals[mealIndex] = meal;
        } else {
          plan.days[dayIndex].meals.push(meal);
        }
        plan.updatedAt = new Date();
      }
      console.log('Planned meal updated (mock):', planId, dayIndex, mealType);
      return;
    }

    // Get current plan
    const plan = await this.getMealPlanById(planId);
    if (plan && plan.days[dayIndex]) {
      const mealIndex = plan.days[dayIndex].meals.findIndex(m => m.mealType === mealType);
      if (mealIndex >= 0) {
        plan.days[dayIndex].meals[mealIndex] = meal;
      } else {
        plan.days[dayIndex].meals.push(meal);
      }
      plan.updatedAt = new Date();
      await setDoc(doc(this.db, 'mealPlans', planId), plan);
      console.log('[Firebase] Planned meal updated:', planId, dayIndex, mealType);
    }
  }

  async deleteMealPlan(planId: string): Promise<boolean> {
    if (this.mockMode || !this.db) {
      const index = this.mockMealPlans.findIndex(mp => mp.id === planId);
      if (index >= 0) {
        this.mockMealPlans.splice(index, 1);
        console.log('Meal plan deleted (mock):', planId);
        return true;
      }
      return false;
    }

    await setDoc(doc(this.db, 'mealPlans', planId), {
      deleted: true,
      deletedAt: new Date()
    }, { merge: true });
    return true;
  }

  // ============================================
  // Meal Plan Shopping List Operations
  // ============================================

  async saveMealPlanShoppingList(list: MealPlanShoppingList): Promise<void> {
    if (this.mockMode || !this.db) {
      const existingIndex = this.mockMealPlanShoppingLists.findIndex(l => l.id === list.id);
      if (existingIndex >= 0) {
        this.mockMealPlanShoppingLists[existingIndex] = list;
      } else {
        this.mockMealPlanShoppingLists.push(list);
      }
      console.log('Meal plan shopping list saved (mock):', list.id);
      return;
    }

    await setDoc(doc(this.db, 'mealPlanShoppingLists', list.id), list);
    console.log('[Firebase] Meal plan shopping list saved:', list.id);
  }

  async getMealPlanShoppingList(familyId: string, weekStartDate: string): Promise<MealPlanShoppingList | null> {
    if (this.mockMode || !this.db) {
      return this.mockMealPlanShoppingLists.find(
        l => l.familyId === familyId && l.weekStartDate === weekStartDate
      ) || null;
    }

    const q = query(
      collection(this.db, 'mealPlanShoppingLists'),
      where('familyId', '==', familyId),
      where('weekStartDate', '==', weekStartDate),
      limit(1)
    );

    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      return querySnapshot.docs[0].data() as MealPlanShoppingList;
    }
    return null;
  }

  async getMealPlanShoppingListById(listId: string): Promise<MealPlanShoppingList | null> {
    if (this.mockMode || !this.db) {
      return this.mockMealPlanShoppingLists.find(l => l.id === listId) || null;
    }

    const docRef = doc(this.db, 'mealPlanShoppingLists', listId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return docSnap.data() as MealPlanShoppingList;
    }
    return null;
  }

  async getMealPlanShoppingListByPlanId(mealPlanId: string): Promise<MealPlanShoppingList | null> {
    // Return demo shopping list for demo meal plan
    if (mealPlanId.startsWith('demo-mealplan-')) {
      const demoMealPlan = generateDemoMealPlan();
      if (mealPlanId === demoMealPlan.id) {
        return generateDemoShoppingList(demoMealPlan);
      }
      return null;
    }

    if (this.mockMode || !this.db) {
      return this.mockMealPlanShoppingLists.find(l => l.mealPlanId === mealPlanId) || null;
    }

    const q = query(
      collection(this.db, 'mealPlanShoppingLists'),
      where('mealPlanId', '==', mealPlanId),
      limit(1)
    );

    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      return querySnapshot.docs[0].data() as MealPlanShoppingList;
    }
    return null;
  }

  async updateMealPlanShoppingItem(
    listId: string,
    itemId: string,
    updates: Partial<MealPlanShoppingItem>
  ): Promise<void> {
    if (this.mockMode || !this.db) {
      const list = this.mockMealPlanShoppingLists.find(l => l.id === listId);
      if (list) {
        const itemIndex = list.items.findIndex(i => i.id === itemId);
        if (itemIndex >= 0) {
          list.items[itemIndex] = { ...list.items[itemIndex], ...updates };
          list.updatedAt = new Date();
        }
      }
      console.log('Shopping item updated (mock):', listId, itemId);
      return;
    }

    // Get current list
    const list = await this.getMealPlanShoppingListById(listId);
    if (list) {
      const itemIndex = list.items.findIndex(i => i.id === itemId);
      if (itemIndex >= 0) {
        list.items[itemIndex] = { ...list.items[itemIndex], ...updates };
        list.updatedAt = new Date();
        await setDoc(doc(this.db, 'mealPlanShoppingLists', listId), list);
        console.log('[Firebase] Shopping item updated:', listId, itemId);
      }
    }
  }

  async getActiveMealPlanShoppingList(familyId: string): Promise<MealPlanShoppingList | null> {
    if (this.mockMode || !this.db) {
      return this.mockMealPlanShoppingLists.find(
        l => l.familyId === familyId && l.status === 'active'
      ) || null;
    }

    const q = query(
      collection(this.db, 'mealPlanShoppingLists'),
      where('familyId', '==', familyId),
      where('status', '==', 'active'),
      orderBy('createdAt', 'desc'),
      limit(1)
    );

    try {
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        return querySnapshot.docs[0].data() as MealPlanShoppingList;
      }
    } catch (error: any) {
      // Fallback if index not available
      if (error?.code === 'failed-precondition') {
        const q2 = query(
          collection(this.db, 'mealPlanShoppingLists'),
          where('familyId', '==', familyId),
          where('status', '==', 'active')
        );
        const querySnapshot = await getDocs(q2);
        if (!querySnapshot.empty) {
          return querySnapshot.docs[0].data() as MealPlanShoppingList;
        }
      }
    }
    return null;
  }

  async updateMealPlanShoppingListStatus(listId: string, status: 'pending' | 'active' | 'completed'): Promise<void> {
    if (this.mockMode || !this.db) {
      const list = this.mockMealPlanShoppingLists.find(l => l.id === listId);
      if (list) {
        list.status = status;
        list.updatedAt = new Date();
      }
      console.log('Shopping list status updated (mock):', listId, status);
      return;
    }

    const list = await this.getMealPlanShoppingListById(listId);
    if (list) {
      list.status = status;
      list.updatedAt = new Date();
      await setDoc(doc(this.db, 'mealPlanShoppingLists', listId), list);
      console.log('[Firebase] Shopping list status updated:', listId, status);
    }
  }

  // Utility
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const firebaseService = new FirebaseService();
