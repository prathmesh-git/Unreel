const axios = require('axios');

const GROQ_API = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.1-8b-instant';
const TAVILY_API = 'https://api.tavily.com/search';

/**
 * Fact-check a single claim using Tavily search + Groq LLaMA analysis
 */
async function factCheckClaim(claim, context = {}) {
  let searchResults = [];
  const analyzedAt = context.analyzedAt || new Date().toISOString();
  const contentDate = context.contentDate || 'Unknown';

  // Step 1: Search for evidence using Tavily (optional)
  try {
    if (process.env.TAVILY_API_KEY) {
      const tavilyRes = await axios.post(
        TAVILY_API,
        {
          api_key: process.env.TAVILY_API_KEY,
          query: `${claim} ${contentDate !== 'Unknown' ? `around ${contentDate}` : ''}`,
          search_depth: 'basic',
          max_results: 5,
          include_domains: ['who.int', 'nih.gov', 'bbc.com', 'reuters.com', 'apnews.com', 'snopes.com', 'factcheck.org', 'nature.com', 'pubmed.ncbi.nlm.nih.gov'],
        },
        { timeout: 15000 }
      );
      searchResults = tavilyRes.data?.results || [];
    }
  } catch {
    searchResults = [];
  }

  // Step 2: Analyze with Groq LLaMA
  const searchContext = searchResults
    .slice(0, 4)
    .map((r, i) => `Source ${i + 1} [${r.url}]: ${r.content?.slice(0, 300)}`)
    .join('\n\n');

  const systemPrompt = `You are a professional fact-checker. You analyze claims and give verdicts.
Respond with ONLY a valid JSON object:
{
  "verdict": "TRUE" | "FALSE" | "MISLEADING" | "UNVERIFIED",
  "explanation": "2-3 sentence explanation",
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "recency": "CURRENT" | "OUTDATED" | "TIMELESS" | "UNCERTAIN",
  "recencyReason": "1 short sentence about whether timing changes the claim"
}`;

  const userPrompt = `CLAIM: "${claim}"
CONTENT DATE (when reel/text was created): ${contentDate}
ANALYSIS DATE (today): ${analyzedAt}

${searchContext ? `SEARCH EVIDENCE:\n${searchContext}\n` : 'No search evidence available. Use your knowledge.'}

Analyze this claim and give a verdict.`;

  try {
    const response = await axios.post(
      GROQ_API,
      {
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 300,
        temperature: 0,
        seed: 42,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    const content = response.data.choices[0]?.message?.content || '{}';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    let result = {
      verdict: 'UNVERIFIED',
      explanation: 'Could not analyze this claim.',
      confidence: 'LOW',
      recency: 'UNCERTAIN',
      recencyReason: 'Timing could not be assessed.',
    };
    if (jsonMatch) result = JSON.parse(jsonMatch[0]);

    const sources = searchResults.slice(0, 3).map(r => ({
      title: r.title || 'Source',
      url: r.url,
      snippet: r.content?.slice(0, 150),
    }));

    return {
      claim,
      verdict: result.verdict || 'UNVERIFIED',
      explanation: result.explanation || 'No explanation available.',
      confidence: result.confidence || 'LOW',
      recency: result.recency || 'UNCERTAIN',
      recencyReason: result.recencyReason || 'Timing could not be assessed.',
      sources,
    };
  } catch {
    return {
      claim,
      verdict: 'UNVERIFIED',
      explanation: 'Could not analyze this claim.',
      confidence: 'LOW',
      recency: 'UNCERTAIN',
      recencyReason: 'Timing could not be assessed.',
      sources: [],
    };
  }
}

/**
 * Fact-check all claims sequentially (to avoid rate limits)
 */
async function factCheckAll(claims, context = {}) {
  if (!Array.isArray(claims) || claims.length === 0) return [];

  const filteredClaims = claims
    .map(c => (typeof c === 'string' ? c.trim() : ''))
    .filter(Boolean)
    .filter(c => !/^no\s+(specific\s+)?factual\s+claims\s+detected\.?$/i.test(c));

  if (filteredClaims.length === 0) return [];

  const results = [];
  for (let i = 0; i < filteredClaims.length; i++) {
    results.push(await factCheckClaim(filteredClaims[i], context));
    if (i < filteredClaims.length - 1) await new Promise(r => setTimeout(r, 300));
  }
  return results;
}

module.exports = { factCheckAll, factCheckClaim };
