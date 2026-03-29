export type SafetyLevel = 'safe' | 'caution' | 'controversial' | 'allergen' | 'under_research';

export type IngredientCategory =
  | 'solvent'
  | 'emollient'
  | 'preservative'
  | 'fragrance'
  | 'surfactant'
  | 'humectant'
  | 'emulsifier'
  | 'antioxidant'
  | 'active'
  | 'colorant'
  | 'thickener'
  | 'other';

export interface PubChemData {
  cid: number;
  iupacName: string | null;
  molecularFormula: string | null;
  molecularWeight: number | null;
  inchiKey: string | null;
}

export interface IngredientAnalysis {
  name: string;
  normalizedName: string;
  category: IngredientCategory;
  safety: SafetyLevel;
  explanation: string;
  confidence: number;
  reasoning: string;
  /** Populated after analysis by a parallel PubChem lookup. Absent if the
   *  compound wasn't found or the request timed out. */
  pubchemData?: PubChemData;
}

export interface TransparencyBreakdown {
  ingredientRisk: number;
  clarity: number;
  researchBacking: number;
  complexity: number;
}

export interface TransparencyScore {
  overall: number;
  breakdown: TransparencyBreakdown;
  summary: string;
}

export interface Alternative {
  original: string;
  suggested: string;
  reason: string;
}

export interface AnalysisResult {
  productName?: string;
  ingredients: IngredientAnalysis[];
  transparencyScore: TransparencyScore;
  alternatives: Alternative[];
  overallSummary: string;
}

export interface AnalyzeRequest {
  productName?: string;
  ingredientList: string;
}
