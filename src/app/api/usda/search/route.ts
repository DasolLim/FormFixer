import { NextRequest, NextResponse } from 'next/server';

const USDA_BASE = 'https://api.nal.usda.gov/fdc/v1/foods/search';

export async function GET(request: NextRequest) {
  const apiKey = process.env.USDA_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Missing USDA_API_KEY in environment.' }, { status: 500 });
  }

  const query = request.nextUrl.searchParams.get('q')?.trim();
  if (!query) {
    return NextResponse.json({ foods: [] });
  }

  const url = `${USDA_BASE}?api_key=${apiKey}&query=${encodeURIComponent(query)}&pageSize=10`;

  try {
    const response = await fetch(url, { cache: 'no-store' });
    const json = await response.json();
    const foods = (json.foods ?? []).map((item: any) => ({
      fdcId: item.fdcId,
      description: item.description,
      brandOwner: item.brandOwner
    }));

    return NextResponse.json({ foods });
  } catch {
    return NextResponse.json({ error: 'USDA search request failed.' }, { status: 502 });
  }
}
