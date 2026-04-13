/**
 * Blog Seed Script — Run: node seed-blogs.js
 * Populates the Blog collection with starter articles.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Blog = require('./models/Blog');

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('MONGODB_URI not set. Please check your .env file.');
  process.exit(1);
}

const blogs = [
  {
    title: 'This Viral Reel Is Misleading — Here\'s Why',
    slug: 'viral-reel-misleading-analysis',
    excerpt: 'We analyzed a viral Instagram reel claiming to show a miracle cure. Our AI detected multiple false claims and high bias. Here\'s the full breakdown.',
    author: 'Unreel Team',
    category: 'Fake News Analysis',
    tags: ['viral', 'misinformation', 'instagram', 'health claims'],
    featuredImage: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800&q=80&auto=format',
    featured: true,
    content: `## The Viral Claim

A recent Instagram reel has been circulating with over 2 million views, claiming that a simple kitchen ingredient can "cure" a serious illness. The reel uses emotional music, bold text overlays, and presents itself as a leaked medical secret.

## What Our AI Found

When we ran this reel through Unreel's analysis pipeline, here's what happened:

### Step 1: Transcription
Our Groq Whisper-powered transcriber extracted the audio, which contained 3 distinct factual claims.

### Step 2: Claim Extraction
The LLM identified the following claims:
- **"This ingredient has been proven to cure [disease]"** — FALSE
- **"Doctors don't want you to know this"** — MISLEADING
- **"A study from Harvard confirmed these results"** — FALSE (no such study exists)

### Step 3: Fact-Checking
Each claim was verified against trusted sources including WHO, PubMed, and Reuters Fact Check. None of the claims held up.

### Step 4: Bias Analysis
- **Bias Score: 87/100 (HIGH)**
- **Type: Health Misinformation**
- **Indicators: Emotional manipulation, appeal to authority, conspiracy framing**

## Why This Matters

Health misinformation on social media can have real consequences. When people avoid medical treatment based on viral content, lives are at risk. This is exactly why tools like Unreel exist — to help people quickly verify claims before they share them.

## How to Protect Yourself

1. **Always verify before sharing** — Use Unreel to check viral content
2. **Look for source citations** — Legitimate health claims cite specific studies
3. **Be wary of "hidden truth" framing** — Content that claims to reveal secrets is often manipulative
4. **Check the creator's credentials** — Medical claims should come from qualified professionals

> "The best defense against misinformation is critical thinking combined with verification tools." — Unreel Team
`,
  },
  {
    title: 'Top 10 Fake Health Claims Circulating on Instagram',
    slug: 'top-10-fake-health-claims-instagram',
    excerpt: 'From miracle cures to conspiracy theories about medicine — we analyzed the most viral false health claims on Instagram Reels in 2026.',
    author: 'Unreel Team',
    category: 'Social Media Trends',
    tags: ['health', 'instagram', 'fake claims', 'top 10'],
    featuredImage: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=800&q=80&auto=format',
    content: `## The State of Health Misinformation

Instagram Reels has become a breeding ground for health misinformation. With short, engaging videos that can reach millions in hours, false health claims spread faster than ever before.

We used Unreel to analyze hundreds of viral health reels. Here are the top 10 false claims we found:

## The Top 10

### 1. "Drink lemon water to cure cancer"
**Truth Score: 12%** | **Bias: HIGH**
Lemon water has health benefits, but claiming it cures cancer is dangerous misinformation.

### 2. "5G towers cause illness"
**Truth Score: 8%** | **Bias: HIGH**
This conspiracy theory has been thoroughly debunked by every major scientific organization.

### 3. "This supplement replaces all medication"
**Truth Score: 15%** | **Bias: HIGH**
No supplement can replace prescribed medication. Always consult your doctor.

### 4. "Vaccine side effects are being hidden"
**Truth Score: 22%** | **Bias: HIGH**
Vaccine side effects are publicly documented. Adverse event reporting systems are open to everyone.

### 5. "AI can diagnose better than doctors"
**Truth Score: 35%** | **Bias: MEDIUM**
AI assists diagnosis but cannot replace the full clinical judgment of trained physicians.

### 6. "This ancient remedy cures everything"
**Truth Score: 18%** | **Bias: HIGH**
Universal cure claims are a classic marker of health misinformation.

### 7. "Big pharma is hiding the cure"
**Truth Score: 10%** | **Bias: HIGH**
Conspiracy framing combined with emotional manipulation — classic misinformation pattern.

### 8. "Raw food diet reverses diabetes"
**Truth Score: 28%** | **Bias: HIGH**
While diet impacts diabetes management, claiming reversal through raw food alone is misleading.

### 9. "Government banned this medicine"
**Truth Score: 20%** | **Bias: HIGH**
Regulatory decisions are made based on safety data, not suppression of cures.

### 10. "You only need this one exercise"
**Truth Score: 30%** | **Bias: MEDIUM**
Health requires a holistic approach. No single exercise addresses all health needs.

## Patterns We Noticed

- **Emotional music** is used in 90% of misleading health reels
- **Bold text overlays** with shock claims appear within the first 2 seconds
- **"Doctors don't want you to know"** framing appears in 60% of false health content
- Most viral false health reels have **under 30 seconds** of content

## What You Can Do

Use Unreel to verify any health claim before sharing it. Our AI analyzes the actual content, checks claims against trusted medical sources, and gives you a clear verdict.
`,
  },
  {
    title: 'How AI Detects Bias in Reels',
    slug: 'how-ai-detects-bias-in-reels',
    excerpt: 'A deep dive into the technology behind Unreel\'s bias detection system. Learn how we use LLMs to analyze emotional manipulation, framing, and rhetorical tricks.',
    author: 'Unreel Team',
    category: 'AI & Misinformation',
    tags: ['AI', 'bias detection', 'technology', 'LLM'],
    featuredImage: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&q=80&auto=format',
    content: `## Understanding Bias Detection

Bias in content isn't always obvious. It can be subtle — a particular framing of facts, selective emphasis, emotional manipulation through music or visuals, or rhetorical techniques designed to persuade rather than inform.

Unreel's bias detection system uses multiple layers of AI analysis to identify these patterns.

## The Analysis Pipeline

### 1. Content Extraction
First, we extract all available content from the reel:
- **Audio transcription** via Groq Whisper (speech-to-text)
- **On-screen text** via OCR (optical character recognition)
- **Post captions** from the platform metadata

### 2. Claim Identification
Our LLM (LLaMA 3) identifies factual claims within the content, separating them from opinions and rhetoric.

### 3. Bias Analysis
The bias analyzer examines the content across multiple dimensions:

| Dimension | What We Check |
|-----------|---------------|
| Emotional Language | Words designed to trigger fear, anger, or excitement |
| Framing | How information is presented and contextualized |
| Source Attribution | Whether claims cite credible sources |
| Omission | Important context that's missing |
| Loaded Language | Words with strong connotations |
| Appeal to Authority | False expert claims |

### 4. Scoring
The bias score (0-100) reflects the overall level of bias detected:
- **0-25**: Low bias — mostly neutral, fact-based content
- **26-50**: Medium bias — some emotional framing detected
- **51-75**: High bias — significant persuasion techniques used
- **76-100**: Very High bias — heavy manipulation detected

## Example Analysis

Consider a reel with the text: *"SHOCKING: They don't want you to see this! Government EXPOSED hiding the truth about [topic]."*

Our AI would detect:
- **Emotional manipulation**: "SHOCKING", exclamation marks
- **Conspiracy framing**: "They don't want you to see"
- **Authority appeal**: "Government EXPOSED"
- **Loaded language**: "hiding the truth"

**Result: Bias Score 85/100 (HIGH)**

## Limitations

No AI system is perfect. Our bias detection may:
- Miss culturally specific bias patterns
- Struggle with heavy sarcasm or irony
- Rate some legitimate investigative journalism as higher bias due to strong language

We continuously improve our models based on user feedback and new research.

## Try It Yourself

Paste any reel URL on the Unreel homepage and see our bias analysis in action. The results include a detailed breakdown of detected bias indicators.
`,
  },
  {
    title: 'Truth Score Explained: How Unreel Rates Content',
    slug: 'truth-score-explained',
    excerpt: 'What does a Truth Score of 65% actually mean? Learn how Unreel calculates reliability scores and what each level tells you about the content.',
    author: 'Unreel Team',
    category: 'Platform Updates',
    tags: ['truth score', 'how it works', 'scoring', 'methodology'],
    featuredImage: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80&auto=format',
    content: `## What Is a Truth Score?

The Truth Score is Unreel's primary metric for content reliability. It represents how factually accurate and trustworthy the content of a reel is, based on our AI analysis.

## How It's Calculated

The Truth Score is the inverse of the Bias Score, adjusted for factual accuracy:

\`\`\`
Truth Score = 100 - Bias Score
\`\`\`

But it's more nuanced than a simple formula. The score considers:

1. **Factual Accuracy** — How many claims are verified as TRUE vs FALSE?
2. **Bias Level** — How much emotional manipulation is present?
3. **Source Quality** — Are claims supported by credible sources?
4. **Confidence Level** — How confident is our AI in the analysis?

## Score Ranges

### 🟢 70-100%: Reliable
Content is mostly factual with low bias. Claims are supported by evidence.
- Example: Educational content from verified experts

### 🟡 40-69%: Mixed
Some true information mixed with misleading context or moderate bias.
- Example: News commentary with some editorial framing

### 🔴 0-39%: Unreliable
Content contains significant false claims and/or high bias.
- Example: Viral misinformation, conspiracy theories

## What the Score Doesn't Tell You

- **Opinion vs. Fact**: An opinion piece may have a low truth score, but opinions aren't facts
- **Satire**: Satirical content will score low because the claims are intentionally false
- **Context**: A reel might report truthfully on false claims (e.g., debunking content)

## Using the Score

The Truth Score is a **starting point**, not a final verdict. We encourage users to:

1. Read the full analysis breakdown
2. Check the individual claim verdicts
3. Review the cited sources
4. Form their own critical judgment

> "Numbers give you a quick signal. The detailed analysis gives you understanding." — Unreel Team
`,
  },
  {
    title: 'The Rise of AI-Generated Misinformation on Social Media',
    slug: 'rise-of-ai-generated-misinformation',
    excerpt: 'Deepfakes, AI-generated voices, and synthetic content are making misinformation harder to detect. Here\'s what you need to know and how Unreel helps.',
    author: 'Unreel Team',
    category: 'AI & Misinformation',
    tags: ['AI', 'deepfakes', 'social media', 'synthetic content'],
    featuredImage: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=800&q=80&auto=format',
    content: `## The New Wave of Misinformation

The misinformation landscape is evolving rapidly. AI tools that were once only available to researchers are now accessible to anyone. This has led to a new generation of synthetic content that's harder to detect:

## Types of AI-Generated Misinformation

### 1. Deepfake Videos
AI can now generate realistic video of people saying things they never said. These deepfakes are getting harder to distinguish from real footage.

### 2. Synthetic Voices
Voice cloning technology can replicate anyone's voice with just a few seconds of sample audio. This is being used to create fake audio clips attributed to public figures.

### 3. AI-Generated Text
Large language models can produce convincing articles, social media posts, and comments that spread false information at scale.

### 4. Manipulated Images
AI image generators create realistic but fake photos that can be used to fabricate evidence for false claims.

## The Scale of the Problem

- Synthetic content on social media has increased **300%** in the last year
- **40%** of viral misinformation now contains some AI-generated elements
- The average person encounters **3-5** pieces of AI-generated misinformation daily

## How Unreel Helps

While Unreel can't directly detect deepfakes in video (yet), our pipeline addresses AI misinformation through:

1. **Claim Verification** — Regardless of how content is created, we verify the factual claims made
2. **Bias Analysis** — AI-generated misinformation often has detectable bias patterns
3. **Source Checking** — We cross-reference claims against trusted fact-checking databases
4. **Pattern Recognition** — Our LLMs can identify common misinformation framing techniques

## What's Coming Next

We're actively working on:
- **Audio deepfake detection** integration
- **Synthetic image analysis** capabilities
- **Cross-platform tracking** of misinformation campaigns
- **Community verification** features

## Protect Yourself

1. **Be skeptical of sensational content** — If it seems too outrageous to be true, verify it
2. **Use verification tools** — Unreel makes it easy to check any reel in seconds
3. **Look for source attribution** — Reliable content cites its sources
4. **Report suspicious content** — Help platforms combat misinformation

The fight against AI-generated misinformation requires AI-powered defenses. That's exactly what Unreel is building.
`,
  },
  {
    title: 'Case Study: How a Fake Health Reel Went Viral',
    slug: 'case-study-fake-health-reel-viral',
    excerpt: 'We tracked a fabricated health claim from its origin to 5 million views. Here\'s the anatomy of a viral misinformation campaign.',
    author: 'Unreel Team',
    category: 'Case Studies',
    tags: ['case study', 'viral content', 'health', 'misinformation tracking'],
    featuredImage: 'https://images.unsplash.com/photo-1504711434969-e33886168d9c?w=800&q=80&auto=format',
    content: `## The Beginning

In early 2026, a 28-second Instagram Reel appeared from an anonymous account. It featured dramatic music, a person in a white coat (not a real doctor), and bold claims about a "banned" natural remedy.

Within 48 hours, it had 5 million views.

## The Content Analysis

We ran the reel through Unreel's analysis pipeline:

### Transcription
> "What they don't want you to know: this simple ingredient, banned by big pharma, can reverse years of damage. Scientists confirmed it in a secret study."

### Claims Identified
1. "This ingredient was banned by pharmaceutical companies" — **FALSE**
2. "It can reverse years of damage" — **FALSE**  
3. "Scientists confirmed it in a secret study" — **FALSE** (no such study exists)

### Bias Analysis
- **Score: 92/100 (VERY HIGH)**
- **Type: Health Misinformation with Conspiracy Framing**
- **Indicators**: Emotional manipulation, false authority, conspiracy narrative, urgency creation

## The Viral Mechanics

Why did this reel spread so fast?

### 1. Emotional Hook (First 3 seconds)
The opening line "What they don't want you to know" triggers curiosity and distrust simultaneously.

### 2. Visual Authority
The person wearing a white coat created a false sense of medical authority, despite having no credentials.

### 3. Platform Algorithm
Short, highly engaging content with high completion rates gets boosted by Instagram's algorithm.

### 4. Share Motivation
People shared it because they genuinely wanted to help friends and family — a noble motivation exploited by bad actors.

## The Damage

Before the reel was eventually removed:
- **5.2 million views**
- **120,000 shares**
- Multiple reports of people attempting the "remedy"
- Real medical professionals spent hours debunking it

## Lessons Learned

1. **Speed matters** — Misinformation spreads fastest in the first 24 hours
2. **Verification tools are critical** — Unreel can analyze a reel in under 60 seconds
3. **Platform responsibility** — Reels need better content verification before going viral
4. **Media literacy** — Everyone needs tools to evaluate content critically

## How Unreel Could Have Helped

If even 10% of the viewers had run this reel through Unreel before sharing, the **FALSE** verdicts and **92/100 bias score** would have stopped most shares instantly, potentially preventing millions of views of dangerous health misinformation.

---

*Have you encountered suspicious health content? Paste the URL on Unreel's homepage and get an instant analysis.*
`,
  },
];

async function seed() {
  try {
    console.log('[Seed] Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    console.log('[Seed] Connected.');

    // Upsert each blog (avoid duplicates on re-run)
    for (const blog of blogs) {
      await Blog.findOneAndUpdate(
        { slug: blog.slug },
        blog,
        { upsert: true, new: true }
      );
      console.log(`[Seed] ✓ ${blog.title}`);
    }

    console.log(`\n[Seed] Done! ${blogs.length} blog posts seeded.`);
  } catch (err) {
    console.error('[Seed] Error:', err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seed();
