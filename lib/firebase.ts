import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Firestore,
  Timestamp,
  DocumentData,
} from 'firebase/firestore';
import type {
  Family,
  FamilyMember,
  UserPreferences,
  Recipe,
  MealPlan,
  ShoppingList,
} from './types';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp;
let db: Firestore;

function initFirebase() {
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApps()[0];
  }
  db = getFirestore(app);
  return { app, db };
}

export function getDb(): Firestore {
  if (!db) {
    initFirebase();
  }
  return db;
}

// Helper to convert Firestore timestamps
function convertTimestamp(data: DocumentData): DocumentData {
  const result = { ...data };
  for (const key of Object.keys(result)) {
    if (result[key] instanceof Timestamp) {
      result[key] = result[key].toDate();
    }
  }
  return result;
}

// Family functions
export async function getFamily(familyId: string): Promise<Family | null> {
  const db = getDb();
  const docRef = doc(db, 'families', familyId);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return null;
  return { id: docSnap.id, ...convertTimestamp(docSnap.data()) } as Family;
}

export async function getFamilyMembers(familyId: string): Promise<FamilyMember[]> {
  const db = getDb();
  const q = query(collection(db, 'families', familyId, 'members'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as FamilyMember[];
}

export async function getFamilyPreferences(familyId: string): Promise<UserPreferences> {
  const db = getDb();
  const docRef = doc(db, 'families', familyId, 'settings', 'preferences');
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) {
    return {
      favoriteIngredients: [],
      dislikedIngredients: [],
      cuisinePreferences: [],
      cookingTimePreference: 'any',
      targetLanguage: 'en',
    };
  }
  return docSnap.data() as UserPreferences;
}

export async function saveFamilyPreferences(
  familyId: string,
  preferences: UserPreferences
): Promise<void> {
  const db = getDb();
  const docRef = doc(db, 'families', familyId, 'settings', 'preferences');
  await setDoc(docRef, preferences, { merge: true });
}

export async function addFamilyMember(
  familyId: string,
  member: Omit<FamilyMember, 'id'>
): Promise<string> {
  const db = getDb();
  const colRef = collection(db, 'families', familyId, 'members');
  const docRef = doc(colRef);
  await setDoc(docRef, member);
  return docRef.id;
}

export async function updateFamilyMember(
  familyId: string,
  memberId: string,
  data: Partial<FamilyMember>
): Promise<void> {
  const db = getDb();
  const docRef = doc(db, 'families', familyId, 'members', memberId);
  await updateDoc(docRef, data);
}

export async function deleteFamilyMember(familyId: string, memberId: string): Promise<void> {
  const db = getDb();
  const docRef = doc(db, 'families', familyId, 'members', memberId);
  await deleteDoc(docRef);
}

// Recipe functions
export async function getFamilyRecipes(familyId: string): Promise<Recipe[]> {
  const db = getDb();
  const q = query(
    collection(db, 'recipes'),
    where('familyId', '==', familyId),
    orderBy('createdAt', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...convertTimestamp(doc.data()),
  })) as Recipe[];
}

export async function getRecipe(recipeId: string): Promise<Recipe | null> {
  const db = getDb();
  const docRef = doc(db, 'recipes', recipeId);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return null;
  return { id: docSnap.id, ...convertTimestamp(docSnap.data()) } as Recipe;
}

export async function deleteRecipe(recipeId: string): Promise<void> {
  const db = getDb();
  const docRef = doc(db, 'recipes', recipeId);
  await deleteDoc(docRef);
}

// Meal Plan functions
export async function getCurrentMealPlan(familyId: string): Promise<MealPlan | null> {
  const db = getDb();
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1));
  const weekStart = monday.toISOString().split('T')[0];

  const q = query(
    collection(db, 'mealPlans'),
    where('familyId', '==', familyId),
    where('weekStartDate', '==', weekStart),
    limit(1)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  return {
    id: snapshot.docs[0].id,
    ...convertTimestamp(snapshot.docs[0].data()),
  } as MealPlan;
}

export async function getMealPlan(mealPlanId: string): Promise<MealPlan | null> {
  const db = getDb();
  const docRef = doc(db, 'mealPlans', mealPlanId);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return null;
  return { id: docSnap.id, ...convertTimestamp(docSnap.data()) } as MealPlan;
}

export async function getLatestMealPlan(familyId: string): Promise<MealPlan | null> {
  const db = getDb();
  const q = query(
    collection(db, 'mealPlans'),
    where('familyId', '==', familyId),
    orderBy('weekStartDate', 'desc'),
    limit(1)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  return {
    id: snapshot.docs[0].id,
    ...convertTimestamp(snapshot.docs[0].data()),
  } as MealPlan;
}

export async function getMealPlanByWeek(
  familyId: string,
  weekStart: string
): Promise<MealPlan | null> {
  const db = getDb();
  const q = query(
    collection(db, 'mealPlans'),
    where('familyId', '==', familyId),
    where('weekStartDate', '==', weekStart),
    limit(1)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  return {
    id: snapshot.docs[0].id,
    ...convertTimestamp(snapshot.docs[0].data()),
  } as MealPlan;
}

export async function approveMealPlan(mealPlanId: string): Promise<void> {
  const db = getDb();
  const docRef = doc(db, 'mealPlans', mealPlanId);
  await updateDoc(docRef, { status: 'approved', updatedAt: Timestamp.now() });
}

// Shopping List functions
export async function getShoppingList(mealPlanId: string): Promise<ShoppingList | null> {
  const db = getDb();
  const q = query(
    collection(db, 'shoppingLists'),
    where('mealPlanId', '==', mealPlanId),
    limit(1)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  return {
    id: snapshot.docs[0].id,
    ...convertTimestamp(snapshot.docs[0].data()),
  } as ShoppingList;
}

export async function updateShoppingItemStatus(
  listId: string,
  itemId: string,
  checked: boolean
): Promise<void> {
  const db = getDb();
  const docRef = doc(db, 'shoppingLists', listId);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return;

  const data = docSnap.data();
  const items = data.items.map((item: { id: string }) =>
    item.id === itemId ? { ...item, checked } : item
  );
  await updateDoc(docRef, { items, updatedAt: Timestamp.now() });
}

// Telegram functions
export async function getTelegramChat(familyId: string): Promise<{ chatId: number } | null> {
  const db = getDb();
  const q = query(
    collection(db, 'telegramChats'),
    where('familyId', '==', familyId),
    limit(1)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const data = snapshot.docs[0].data();
  return { chatId: data.chatId };
}

// Initialize family for demo
export async function initializeDemoFamily(): Promise<string> {
  const db = getDb();
  const familyId = 'demo-family';

  const familyRef = doc(db, 'families', familyId);
  const familySnap = await getDoc(familyRef);

  if (!familySnap.exists()) {
    await setDoc(familyRef, {
      name: 'Demo Family',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    // Add demo members
    const membersRef = collection(db, 'families', familyId, 'members');
    await setDoc(doc(membersRef, 'member-1'), {
      name: 'Parent',
      dietaryRestrictions: [],
    });
    await setDoc(doc(membersRef, 'member-2'), {
      name: 'Child',
      dietaryRestrictions: ['nut-free'],
    });

    // Add default preferences
    const prefsRef = doc(db, 'families', familyId, 'settings', 'preferences');
    await setDoc(prefsRef, {
      favoriteIngredients: ['chicken', 'pasta', 'rice'],
      dislikedIngredients: ['olives'],
      cuisinePreferences: ['Italian', 'Mexican', 'Asian'],
      cookingTimePreference: 'moderate',
      targetLanguage: 'en',
    });
  }

  return familyId;
}
