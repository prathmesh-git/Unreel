const axios = require('axios');

// Groq is free: https://console.groq.com
const GROQ_API = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.1-8b-instant'; // fast, free, great for structured output

/**
 * Extract factual claims from a transcript using Groq LLaMA
 * @param {string} transcript
 * @returns {Promise<string[]>}
 */
async function extractClaims(transcript) {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not set in your .env file. Get a free key at https://console.groq.com');
  }

  if (!transcript || transcript.trim().length < 10) {
    return [];
  }

  const prompt = `You are a fact-checking assistant. Analyze this video transcript and extract all factual, verifiable claims.

TRANSCRIPT:
"${transcript.slice(0, 3000)}"

Extract each factual claim as a short, clear sentence. Focus on:
- Health/medical claims
- Scientific claims
- Statistical claims
- Historical claims
- News/current events claims
- Product/service claims

Return ONLY a JSON array of claim strings. Maximum 5 claims. If no clear claims exist, return an empty array [].

Example: ["Claim 1 here", "Claim 2 here"]`;

  try {
    const response = await axios.post(
      GROQ_API,
      {
        model: GROQ_MODEL,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
        temperature: 0.2,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    const content = response.data.choices[0]?.message?.content || '[]';
    const claims = normalizeClaims(parseClaimsFromModelContent(content));
    if (claims.length > 0) return claims.slice(0, 5);

    const fallbackClaims = await extractClaimsFallback(transcript);
    return normalizeClaims(fallbackClaims).slice(0, 5);
  } catch (error) {
    const errMsg = error.response?.data?.error?.message || error.message;
    throw new Error(`Claim extraction failed: ${errMsg}`);
  }
}

async function extractClaimsFallback(transcript) {
  const prompt = `Extract up to 3 checkable claims or strong assertions from this transcript.

Rules:
- Prefer statements that can be verified against sources.
- Include geopolitical, health, scientific, statistical, historical, or current-events assertions.
- Ignore greetings, opinions without assertions, and vague emotional language.
- Output plain text only, one claim per line, no JSON and no numbering.
- If no claims exist, output exactly: NO_CLAIMS

TRANSCRIPT:
"${transcript.slice(0, 3000)}"`;

  const response = await axios.post(
    GROQ_API,
    {
      model: GROQ_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 300,
      temperature: 0.1,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    }
  );

  const content = (response.data.choices[0]?.message?.content || '').trim();
  if (!content || /^no_claims$/i.test(content)) return [];

  return content
    .split(/\r?\n/)
    .map(line => line.replace(/^[-*\d.)\s]+/, '').trim())
    .filter(Boolean)
    .slice(0, 3);
}

function parseClaimsFromModelContent(content) {
  if (!content || typeof content !== 'string') return [];

  const stripped = stripCodeFences(content).trim();

  // 1) Fast path: whole payload is a JSON array.
  try {
    const direct = JSON.parse(stripped);
    if (Array.isArray(direct)) return direct;
  } catch {}

  // 2) Scan for the first syntactically valid JSON array segment.
  const segments = extractJsonArraySegments(stripped);
  for (const segment of segments) {
    try {
      const parsed = JSON.parse(segment);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }

  return [];
}

function normalizeClaims(claims) {
  if (!Array.isArray(claims)) return [];

  const unique = [];
  for (const claim of claims) {
    const cleaned = typeof claim === 'string' ? claim.trim() : '';
    if (!cleaned) continue;
    if (/^no\s+(specific\s+)?factual\s+claims\s+detected\.?$/i.test(cleaned)) continue;
    if (!unique.includes(cleaned)) unique.push(cleaned);
  }
  return unique;
}

function stripCodeFences(text) {
  return text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '');
}

function extractJsonArraySegments(text) {
  const segments = [];
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (ch === '\\' && inString) {
      escaped = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (ch === '[') {
      if (depth === 0) start = i;
      depth += 1;
      continue;
    }

    if (ch === ']' && depth > 0) {
      depth -= 1;
      if (depth === 0 && start !== -1) {
        segments.push(text.slice(start, i + 1));
        start = -1;
      }
    }
  }

  return segments;
}

module.exports = { extractClaims };
