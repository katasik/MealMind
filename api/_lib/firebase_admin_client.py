"""Firebase Admin SDK client for server-side operations."""

import os
import json
from typing import Optional
import firebase_admin
from firebase_admin import credentials, firestore
from google.cloud.firestore_v1 import FieldFilter

_db = None


def get_firestore():
    """Initialize Firebase Admin SDK and return Firestore client."""
    global _db

    if _db is not None:
        return _db

    if not firebase_admin._apps:
        raw = os.environ.get('FIREBASE_SERVICE_ACCOUNT', '{}')
        print(f"DEBUG get_firestore: FIREBASE_SERVICE_ACCOUNT exists: {bool(raw and raw != '{}')}")
        try:
            service_account = json.loads(raw)
        except json.JSONDecodeError as e:
            raise RuntimeError(
                f"FIREBASE_SERVICE_ACCOUNT env var is not valid JSON: {e}. "
                f"Value starts with: {raw[:50]!r}..."
            ) from e
        if service_account:
            project_id = service_account.get('project_id', 'UNKNOWN')
            print(f"DEBUG get_firestore: Initializing Firebase for project: {project_id}")
            cred = credentials.Certificate(service_account)
            firebase_admin.initialize_app(cred)
        else:
            print("DEBUG get_firestore: No service account found, using default initialization")
            # For local development without credentials
            firebase_admin.initialize_app()

    _db = firestore.client()
    print("DEBUG get_firestore: Firestore client created successfully")
    return _db


# Family repository functions
def get_family(family_id: str) -> Optional[dict]:
    """Get family by ID."""
    db = get_firestore()
    doc = db.collection('families').document(family_id).get()
    if doc.exists:
        return {'id': doc.id, **doc.to_dict()}
    return None


def get_family_members(family_id: str) -> list:
    """Get all members of a family."""
    db = get_firestore()
    members = db.collection('families').document(family_id).collection('members').stream()
    return [{'id': m.id, **m.to_dict()} for m in members]


def get_family_preferences(family_id: str) -> dict:
    """Get family preferences."""
    db = get_firestore()
    doc = db.collection('families').document(family_id).collection('settings').document('preferences').get()
    if doc.exists:
        return doc.to_dict()
    return {
        'favoriteIngredients': [],
        'dislikedIngredients': [],
        'cuisinePreferences': [],
        'cookingTimePreference': 'any',
        'targetLanguage': 'en'
    }


def get_family_recipes(family_id: str) -> list:
    """Get all recipes for a family."""
    db = get_firestore()
    recipes = db.collection('recipes').where(
        filter=FieldFilter('familyId', '==', family_id)
    ).stream()
    return [{'id': r.id, **r.to_dict()} for r in recipes]


# Meal Plan repository functions
def get_meal_plan(meal_plan_id: str) -> Optional[dict]:
    """Get meal plan by ID."""
    db = get_firestore()
    doc = db.collection('mealPlans').document(meal_plan_id).get()
    if doc.exists:
        return {'id': doc.id, **doc.to_dict()}
    return None


def get_current_meal_plan(family_id: str, week_start: str) -> Optional[dict]:
    """Get meal plan for a specific week."""
    db = get_firestore()
    plans = db.collection('mealPlans').where(
        filter=FieldFilter('familyId', '==', family_id)
    ).where(
        filter=FieldFilter('weekStartDate', '==', week_start)
    ).limit(1).stream()
    plans_list = list(plans)
    if plans_list:
        return {'id': plans_list[0].id, **plans_list[0].to_dict()}
    return None


def save_meal_plan(family_id: str, week_start: str, meal_plan: dict, evaluation: dict, trace_id: str) -> str:
    """Save or update a meal plan."""
    print(f"DEBUG save_meal_plan: Starting save for family {family_id}, week {week_start}")
    db = get_firestore()
    print(f"DEBUG save_meal_plan: Got Firestore client")

    # Check if plan exists for this week
    existing = get_current_meal_plan(family_id, week_start)
    print(f"DEBUG save_meal_plan: Existing plan found: {existing is not None}")

    data = {
        'familyId': family_id,
        'weekStartDate': week_start,
        'status': 'draft',
        'days': meal_plan.get('days', []),
        'evaluationScores': evaluation,
        'opikTraceId': trace_id,
        'updatedAt': firestore.SERVER_TIMESTAMP,
    }

    if existing:
        doc_ref = db.collection('mealPlans').document(existing['id'])
        doc_ref.update(data)
        print(f"DEBUG save_meal_plan: Updated existing plan {existing['id']}")
        return existing['id']
    else:
        data['createdAt'] = firestore.SERVER_TIMESTAMP
        doc_ref = db.collection('mealPlans').document()
        doc_ref.set(data)
        print(f"DEBUG save_meal_plan: Created new plan {doc_ref.id}")
        return doc_ref.id


def delete_meal_plan(meal_plan_id: str) -> bool:
    """Delete a meal plan by ID."""
    db = get_firestore()
    db.collection('mealPlans').document(meal_plan_id).delete()
    return True


def update_meal_in_plan(meal_plan_id: str, day_index: int, meal_type: str, new_meal: dict) -> bool:
    """Update a specific meal in a meal plan."""
    db = get_firestore()
    doc_ref = db.collection('mealPlans').document(meal_plan_id)
    doc = doc_ref.get()

    if not doc.exists:
        return False

    plan_data = doc.to_dict()
    days = plan_data.get('days', [])

    if day_index >= len(days):
        return False

    meals = days[day_index].get('meals', [])
    for i, meal in enumerate(meals):
        if meal.get('mealType') == meal_type:
            meals[i] = new_meal
            break
    else:
        meals.append(new_meal)

    days[day_index]['meals'] = meals
    doc_ref.update({
        'days': days,
        'updatedAt': firestore.SERVER_TIMESTAMP
    })
    return True


# Recipe repository functions
def save_recipe(family_id: str, recipe: dict) -> str:
    """Save a new recipe."""
    db = get_firestore()
    doc_ref = db.collection('recipes').document()
    doc_ref.set({
        **recipe,
        'familyId': family_id,
        'createdAt': firestore.SERVER_TIMESTAMP,
    })
    return doc_ref.id


def get_recipe(recipe_id: str) -> Optional[dict]:
    """Get recipe by ID."""
    db = get_firestore()
    doc = db.collection('recipes').document(recipe_id).get()
    if doc.exists:
        return {'id': doc.id, **doc.to_dict()}
    return None


def delete_recipe(recipe_id: str) -> bool:
    """Delete a recipe."""
    db = get_firestore()
    db.collection('recipes').document(recipe_id).delete()
    return True


# Shopping List repository functions
def get_shopping_list(meal_plan_id: str) -> Optional[dict]:
    """Get shopping list for a meal plan."""
    db = get_firestore()
    lists = db.collection('shoppingLists').where(
        filter=FieldFilter('mealPlanId', '==', meal_plan_id)
    ).limit(1).stream()
    lists_list = list(lists)
    if lists_list:
        return {'id': lists_list[0].id, **lists_list[0].to_dict()}
    return None


def save_shopping_list(meal_plan_id: str, family_id: str, week_start: str, items: list) -> str:
    """Save or update a shopping list."""
    db = get_firestore()

    # Delete existing list for this meal plan
    existing = get_shopping_list(meal_plan_id)
    if existing:
        db.collection('shoppingLists').document(existing['id']).delete()

    doc_ref = db.collection('shoppingLists').document()
    doc_ref.set({
        'mealPlanId': meal_plan_id,
        'familyId': family_id,
        'weekStartDate': week_start,
        'items': items,
        'status': 'active',
        'createdAt': firestore.SERVER_TIMESTAMP,
        'updatedAt': firestore.SERVER_TIMESTAMP,
    })
    return doc_ref.id


def update_shopping_item(list_id: str, item_id: str, checked: bool) -> bool:
    """Update shopping item checked status."""
    db = get_firestore()
    doc_ref = db.collection('shoppingLists').document(list_id)
    doc = doc_ref.get()

    if not doc.exists:
        return False

    data = doc.to_dict()
    items = data.get('items', [])
    for item in items:
        if item.get('id') == item_id:
            item['checked'] = checked
            break

    doc_ref.update({
        'items': items,
        'updatedAt': firestore.SERVER_TIMESTAMP
    })
    return True


# Evaluation repository functions
def save_evaluation_result(
    trace_id: str,
    operation_type: str,
    family_id: str,
    scores: dict,
    passed: bool,
    metadata: dict = None
) -> str:
    """Save an evaluation result."""
    db = get_firestore()
    doc_ref = db.collection('evaluationResults').document()
    doc_ref.set({
        'traceId': trace_id,
        'operationType': operation_type,
        'familyId': family_id,
        'scores': scores,
        'passed': passed,
        'metadata': metadata or {},
        'createdAt': firestore.SERVER_TIMESTAMP,
    })
    return doc_ref.id


# Telegram repository functions
def get_telegram_chat(family_id: str) -> Optional[dict]:
    """Get linked Telegram chat for a family."""
    db = get_firestore()
    chats = db.collection('telegramChats').where(
        filter=FieldFilter('familyId', '==', family_id)
    ).limit(1).stream()
    chats_list = list(chats)
    if chats_list:
        return {'id': chats_list[0].id, **chats_list[0].to_dict()}
    return None


def save_telegram_chat(chat_id: int, family_id: str, chat_type: str = 'private') -> str:
    """Link a Telegram chat to a family."""
    db = get_firestore()
    doc_ref = db.collection('telegramChats').document(str(chat_id))
    doc_ref.set({
        'chatId': chat_id,
        'familyId': family_id,
        'chatType': chat_type,
        'linkedAt': firestore.SERVER_TIMESTAMP,
    })
    return str(chat_id)
