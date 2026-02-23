import { NextRequest, NextResponse } from 'next/server';

export async function GET(_request: NextRequest, { params }: { params: { fdcId: string } }) {
  const apiKey = process.env.USDA_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Missing USDA_API_KEY in environment.' }, { status: 500 });
  }

  const url = `https://api.nal.usda.gov/fdc/v1/food/${params.fdcId}?api_key=${apiKey}`;

  try {
    const response = await fetch(url, { cache: 'no-store' });
    const json = await response.json();

    const nutrients = json.foodNutrients ?? [];
    const findNutrient = (name: string) => nutrients.find((n: any) => n.nutrient?.name === name)?.amount ?? 0;

    const calories = findNutrient('Energy');
    const protein = findNutrient('Protein');
    const carbs = findNutrient('Carbohydrate, by difference');
    const fats = findNutrient('Total lipid (fat)');

    return NextResponse.json({
      description: json.description,
      servingSize: json.servingSize ?? 100,
      servingUnit: json.servingSizeUnit ?? 'g',
      macrosPer100g: {
        calories: Number(calories),
        protein: Number(protein),
        carbs: Number(carbs),
        fats: Number(fats)
      }
    });
  } catch {
    return NextResponse.json({ error: 'USDA detail request failed.' }, { status: 502 });
  }
}
