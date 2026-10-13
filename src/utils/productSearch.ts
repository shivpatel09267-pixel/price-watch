// Client-side cleanup of Open Food Facts search results.
//
// The search service matches a query against every language's product
// name, categories and other fields, so "milk" also returns a Thai carton
// under its Thai name, Italian "Latte scremato", and a provolone whose
// categories happen to mention milk. Narrowing the query itself isn't an
// option (see productService.ts — structured queries return nothing), so
// results are filtered and re-ranked here instead.
//
// Kept free of React Native imports so it can be exercised on its own.

export interface SearchCandidate {
  // English display name, already chosen by englishName().
  name: string;
  brand: string | null;
  category: string | null;
  countries: string[];
}

export interface CategoryLabel {
  id: string;
  label: string;
}

// Any letter outside the Latin script (Cyrillic, Thai, CJK, Arabic, …).
const NON_LATIN_LETTER = /[^\u0000-ɏḀ-ỿ -⁯₠-⃏℀-⅏]/;

function isLatinScript(text: string): boolean {
  return !NON_LATIN_LETTER.test(text);
}

// The name to show for a product, or null if it has no English one.
// `product_name_en` wins when present; the generic `product_name` is only
// trusted when the product's main language is English. Both are also
// checked for script, because some entries tagged English aren't.
export function englishName(raw: {
  product_name?: string;
  product_name_en?: string;
  lang?: string;
}): string | null {
  const en = raw.product_name_en?.trim();
  if (en && isLatinScript(en)) return en;
  const generic = raw.product_name?.trim();
  if (generic && raw.lang === 'en' && isLatinScript(generic)) return generic;
  return null;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function queryWords(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9%]+/)
    .filter((word) => word.length >= 2);
}

// Whole-word match that tolerates singular/plural either way, so "egg"
// finds "Eggs" and "apples" finds "Apple" — but "milk" never matches
// inside "buttermilk" or "milky".
function wordPattern(word: string): RegExp {
  const stems = new Set([word]);
  if (word.length > 3 && word.endsWith('es')) stems.add(word.slice(0, -2));
  if (word.length > 2 && word.endsWith('s')) stems.add(word.slice(0, -1));
  const alternatives = [...stems].map(escapeRegExp).join('|');
  return new RegExp(`(^|[^a-z0-9])(${alternatives})(s|es)?($|[^a-z0-9])`, 'i');
}

// The app category a query is clearly about, if any: the longest category
// label whose words all appear in the query. "publix milk" → milk,
// "peanut butter" → peanut butter (not butter).
export function categoryForQuery(
  query: string,
  categories: CategoryLabel[]
): string | null {
  const words = queryWords(query).map((word) => word.replace(/s$/, ''));
  let best: { id: string; length: number } | null = null;
  for (const { id, label } of categories) {
    const labelWords = queryWords(label).map((word) => word.replace(/s$/, ''));
    if (labelWords.length === 0) continue;
    if (!labelWords.every((word) => words.includes(word))) continue;
    if (!best || labelWords.length > best.length) best = { id, length: labelWords.length };
  }
  return best?.id ?? null;
}

// Keeps only results that are actually what was searched for, best first.
//
// - Every query word must appear as a whole word in the name or brand —
//   no more matches that only hit a category tag or another language.
// - When the query is clearly one of the app's categories, products the
//   database files under a *different* category are dropped ("milk" no
//   longer returns cheese), and same-category products rank first.
// - US products rank ahead of others, since those are the ones people
//   here can actually buy. Otherwise the service's own order is kept.
export function filterAndRank<T extends SearchCandidate>(
  query: string,
  candidates: T[],
  categories: CategoryLabel[]
): T[] {
  const patterns = queryWords(query).map(wordPattern);
  if (patterns.length === 0) return [];
  const wanted = categoryForQuery(query, categories);
  const normalisedQuery = query.trim().toLowerCase();

  return candidates
    .filter((candidate) => {
      const haystack = `${candidate.name} ${candidate.brand ?? ''}`;
      if (!patterns.every((pattern) => pattern.test(haystack))) return false;
      if (wanted && candidate.category && candidate.category !== wanted) return false;
      return true;
    })
    .map((candidate, index) => {
      let score = 0;
      if (wanted && candidate.category === wanted) score += 4;
      if (candidate.countries.includes('en:united-states')) score += 2;
      if (candidate.name.toLowerCase() === normalisedQuery) score += 1;
      return { candidate, index, score };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ candidate }) => candidate);
}
