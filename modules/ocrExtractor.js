const axios = require('axios');

const GROQ_API = 'https://api.groq.com/openai/v1/chat/completions';
const VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct'; // Groq vision, free

/**
 * Extract on-screen text from video keyframes using Groq vision
 * @param {string[]} base64Frames - Array of base64-encoded JPEG frames
 * @returns {Promise<string>} - All detected on-screen text combined
 */
async function extractOnScreenText(base64Frames) {
  if (!process.env.GROQ_API_KEY || base64Frames.length === 0) return '';

  try {
    // Send up to 4 frames to the vision model
    const framesToAnalyze = base64Frames.slice(0, 4);

    const imageContent = framesToAnalyze.map(b64 => ({
      type: 'image_url',
      image_url: { url: `data:image/jpeg;base64,${b64}` },
    }));

    const response = await axios.post(
      GROQ_API,
      {
        model: VISION_MODEL,
        messages: [
          {
            role: 'user',
            content: [
              ...imageContent,
              {
                type: 'text',
                text: `These are frames from a social media reel/short video. 
Please extract ALL text visible in these frames, including:
- Captions and subtitles
- Text overlays and banners
- Statistics or numbers shown on screen
- Headlines or titles
- Any other on-screen text

Return ONLY the extracted text, one item per line. If no text is visible, return "No on-screen text detected."`,
              },
            ],
          },
        ],
        max_tokens: 500,
        temperature: 0.1,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 45000,
      }
    );

    const text = response.data.choices[0]?.message?.content || '';
    console.log(`[Unreel] OCR extracted ${text.length} chars of on-screen text`);
    return text.trim();
  } catch (error) {
    const errMsg = error.response?.data?.error?.message || error.message;
    console.warn(`[Unreel] OCR failed (non-fatal): ${errMsg}`);
    return ''; // OCR failure is non-fatal — audio transcript still works
  }
}

module.exports = { extractOnScreenText };
