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

    const nutrients: any[] = json.foodNutrients ?? [];

    // USDA returns two different shapes depending on food type:
    // Foundation/SR Legacy: { nutrient: { name }, amount }
    // Branded:              { nutrientName, value }
    const getName = (n: any): string => n.nutrient?.name ?? n.nutrientName ?? '';
    const getAmount = (n: any): number => n.amount ?? n.value ?? 0;
    const getUnit = (n: any): string => (n.nutrient?.unitName ?? n.unitName ?? '').toLowerCase();

    const findNutrient = (name: string) => {
      const matches = nutrients.filter(n => getName(n) === name);
      if (matches.length === 0) return 0;
      // Prefer kcal over kJ when multiple Energy entries exist
      const kcal = matches.find(n => getUnit(n).includes('kcal'));
      return getAmount(kcal ?? matches[0]);
    };

    const calories = findNutrient('Energy');
    const protein  = findNutrient('Protein');
    const carbs    = findNutrient('Carbohydrate, by difference');
    const fats     = findNutrient('Total lipid (fat)');

    const rawUnit = (json.servingSizeUnit ?? 'g') as string;
    const servingUnit = rawUnit.toLowerCase() === 'grm' ? 'g' : rawUnit.toLowerCase();

    return NextResponse.json({
      description: json.description,
      servingSize: json.servingSize ?? 100,
      servingUnit,
      macrosPer100g: {
        calories: Number(calories),
        protein:  Number(protein),
        carbs:    Number(carbs),
        fats:     Number(fats),
      },
    });
  } catch {
    return NextResponse.json({ error: 'USDA detail request failed.' }, { status: 502 });
  }
}
