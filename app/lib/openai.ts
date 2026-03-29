/**
 * app/lib/openai.ts — SERVER-SIDE ONLY
 *
 * `import 'server-only'` ensures this module (and the OPENAI_API_KEY it reads)
 * can never be bundled into the browser, even by accident.
 *
 * OWASP A02:2021 Cryptographic Failures — API keys must never leave the server.
 */
import 'server-only';

import OpenAI from 'openai';
import type { AnalysisResult } from './types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `You are an expert cosmetic chemist and dermatology ingredient safety analyst.
Analyze beauty/skincare product ingredients and return a structured JSON analysis.

For each ingredient, provide:
- Plain-English explanation (1-2 sentences, accessible to non-experts)
- Category classification
- Safety rating with reasoning
- Confidence level (0-1)

Safety levels:
- "safe": Well-studied, generally non-irritating
- "caution": May cause issues for sensitive skin or at high concentrations
- "controversial": Mixed research, debated in the skincare community
- "allergen": Known allergen or frequent sensitizer
- "under_research": Limited data, newer ingredient

Transparency score (0-100) based on:
- ingredientRisk: Lower risk = higher score
- clarity: Vague ingredients like "fragrance" lower clarity
- researchBacking: How well-studied is the formula
- complexity: Simpler formulas score higher

Keep explanations friendly, non-alarmist, and balanced. Avoid definitive medical claims.`;

/**
 * Ask OpenAI to look up the real-world ingredient list for a named product.
 * Returns a comma-separated ingredient string, or throws if the product is unknown.
 */
export async function lookupIngredientsByProduct(productName: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'You are a cosmetic product database. Return ONLY a JSON object with one key "ingredients" containing the comma-separated INCI ingredient list for the product. If the product is unknown or fictional, set "ingredients" to null.',
      },
      {
        role: 'user',
        content: `What are the ingredients in "${productName}"?`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('No response from OpenAI');

  const parsed = JSON.parse(content) as { ingredients: string | null };
  if (!parsed.ingredients) {
    throw new Error(`Could not find ingredient list for "${productName}". Try a well-known product name.`);
  }
  return parsed.ingredients;
}

export async function analyzeIngredients(
  ingredientList: string[],
  productName?: string
): Promise<AnalysisResult> {
  const ingredientText = ingredientList.join(', ');
  const productContext = productName ? `Product: "${productName}"\n` : '';

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `${productContext}Ingredients: ${ingredientText}

Return ONLY valid JSON in exactly this shape:
{
  "ingredients": [
    {
      "name": "original name from list",
      "normalizedName": "INCI/common name",
      "category": "solvent|emollient|preservative|fragrance|surfactant|humectant|emulsifier|antioxidant|active|colorant|thickener|other",
      "safety": "safe|caution|controversial|allergen|under_research",
      "explanation": "plain English explanation",
      "confidence": 0.95,
      "reasoning": "why this safety rating"
    }
  ],
  "transparencyScore": {
    "overall": 75,
    "breakdown": {
      "ingredientRisk": 80,
      "clarity": 70,
      "researchBacking": 75,
      "complexity": 72
    },
    "summary": "brief summary of the score"
  },
  "alternatives": [
    {
      "original": "ingredient name",
      "suggested": "safer alternative",
      "reason": "why it's better"
    }
  ],
  "overallSummary": "2-3 sentence overview of the product's ingredient profile"
}`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('No response from OpenAI');

  const parsed = JSON.parse(content) as AnalysisResult;
  if (productName) parsed.productName = productName;
  return parsed;
}
