const axios = require('axios');

const GROQ_API = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.1-8b-instant';

/**
 * Analyze transcript and claims for bias using Groq LLaMA
 */
async function analyzeBias(transcript, claims) {
  const cleanedTranscript = typeof transcript === 'string' ? transcript.trim() : '';
  const cleanClaims = Array.isArray(claims)
    ? claims.map(c => (typeof c === 'string' ? c.trim() : '')).filter(Boolean)
    : [];

  if (!cleanedTranscript && cleanClaims.length === 0) {
    return neutralBias('Not enough textual content was detected to assess bias reliably.');
  }

  if (!process.env.GROQ_API_KEY) {
    return neutralBias('Bias model is unavailable because GROQ_API_KEY is not set.');
  }

  const claimsText = cleanClaims.join('\n- ');
  const prompt = `You are an expert media bias analyst. Analyze this video content for bias.

TRANSCRIPT (first 2000 chars):
"${cleanedTranscript.slice(0, 2000)}"

CLAIMS MADE:
- ${claimsText}

Analyze for: emotional/sensationalist language, one-sided facts, missing context, health misinformation, political bias, fear-mongering.

Respond with ONLY a valid JSON object:
{
  "score": <0-100, where 0=neutral, 100=extremely biased>,
  "level": "LOW" | "MEDIUM" | "HIGH" | "VERY HIGH",
  "type": "Health Misinformation" | "Political Bias" | "Sensationalism" | "Emotional Manipulation" | "Financial Misinformation" | "Science Denial" | "None Detected" | "Mixed",
  "indicators": ["indicator 1", "indicator 2"],
  "explanation": "2-3 sentence explanation"
}`;

  try {
    const response = await axios.post(
      GROQ_API,
      {
        model: GROQ_MODEL,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 400,
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

    const content = response.data.choices[0]?.message?.content || '{}';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      return {
        score: Math.min(100, Math.max(0, result.score || 50)),
        level: result.level || 'MEDIUM',
        type: result.type || 'Unknown',
        indicators: result.indicators || [],
        explanation: result.explanation || 'Bias analysis completed.',
      };
    }
    return neutralBias();
  } catch {
    return neutralBias();
  }
}

function neutralBias(explanation = 'Bias analysis could not be completed.') {
  return {
    score: 0,
    level: 'LOW',
    type: 'None Detected',
    indicators: [],
    explanation,
  };
}

module.exports = { analyzeBias };
