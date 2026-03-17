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
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const claims = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(claims)) return [];

      return claims
        .map(c => (typeof c === 'string' ? c.trim() : ''))
        .filter(Boolean)
        .filter(c => !/^no\s+(specific\s+)?factual\s+claims\s+detected\.?$/i.test(c))
        .slice(0, 5);
    }
    return [];
  } catch (error) {
    const errMsg = error.response?.data?.error?.message || error.message;
    throw new Error(`Claim extraction failed: ${errMsg}`);
  }
}

module.exports = { extractClaims };
