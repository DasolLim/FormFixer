export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export type MacroInput = {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
};

export type MealItemRow = {
  id: string;
  meal_type: MealType;
  food_name: string;
  serving_amount: number;
  serving_unit: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fats_g: number;
  created_at: string;
};

export type UsdaSearchItem = {
  fdcId: number;
  description: string;
  brandOwner?: string;
};
