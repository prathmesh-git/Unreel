const express = require('express');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const { requireAuth, generateToken } = require('../middleware/authMiddleware');
const { sendWelcomeEmail, serializeMailError } = require('../modules/mailer');

const router = express.Router();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID;
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

function toSafeUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    preferences: {
      emailAnalysisResults: user?.preferences?.emailAnalysisResults !== false,
    },
  };
}

// ─── GET /api/auth/google-config ────────────────────────────────────────────
router.get('/google-config', (_req, res) => {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
    'Surrogate-Control': 'no-store',
  });
  res.json({
    enabled: Boolean(GOOGLE_CLIENT_ID),
    clientId: GOOGLE_CLIENT_ID || '',
  });
});

// ─── POST /api/auth/register ──────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Please provide a valid email address.' });
  }

  try {
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
    });

    sendWelcomeEmail({ name: user.name, email: user.email }).catch((mailErr) => {
      console.warn('[Unreel] Welcome email skipped/failed:', serializeMailError(mailErr));
    });

    const token = generateToken(user);
    res.status(201).json({
      success: true,
      token,
      isNewUser: true,
      user: toSafeUser(user),
    });
  } catch (err) {
    console.error('[Unreel] Register error:', err.message);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (!user.password) {
      return res.status(401).json({
        error: 'This account uses Google sign-in. Please log in with Google.',
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = generateToken(user);
    res.json({
      success: true,
      token,
      isNewUser: false,
      user: toSafeUser(user),
    });
  } catch (err) {
    console.error('[Unreel] Login error:', err.message);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// ─── POST /api/auth/google ───────────────────────────────────────────────────
router.post('/google', async (req, res) => {
  const { credential } = req.body;

  if (!credential) {
    return res.status(400).json({ error: 'Google credential is required.' });
  }
  if (!googleClient) {
    return res.status(503).json({ error: 'Google sign-in is not configured on this server.' });
  }

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture } = payload;

    if (!email) {
      return res.status(400).json({ error: 'Google account email is required.' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Find existing user by googleId or email
    let user = await User.findOne({ $or: [{ googleId }, { email: normalizedEmail }] });
    let isNewUser = false;

    if (user) {
      // Link Google account if not already linked
      let userUpdated = false;

      if (!user.googleId) {
        user.googleId = googleId;
        userUpdated = true;
      }

      // Keep avatar in sync so profile photos reliably appear after login.
      if (picture && user.avatar !== picture) {
        user.avatar = picture;
        userUpdated = true;
      }

      if (userUpdated) {
        await user.save();
      }
    } else {
      // Create new user
      user = await User.create({
        name: name || normalizedEmail.split('@')[0],
        email: normalizedEmail,
        googleId,
        avatar: picture || null,
      });

      isNewUser = true;

      sendWelcomeEmail({ name: user.name, email: user.email }).catch((mailErr) => {
        console.warn('[Unreel] Welcome email skipped/failed:', serializeMailError(mailErr));
      });
    }

    const token = generateToken(user);
    res.json({
      success: true,
      token,
      isNewUser,
      user: toSafeUser(user),
    });
  } catch (err) {
    console.error('[Unreel] Google auth error:', err.message);
    res.status(401).json({ error: 'Google authentication failed. Please try again.' });
  }
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    res.json({
      success: true,
      user: toSafeUser(user),
    });
  } catch (err) {
    console.error('[Unreel] Get user error:', err.message);
    res.status(500).json({ error: 'Could not fetch user profile.' });
  }
});

// ─── PATCH /api/auth/preferences ─────────────────────────────────────────────
router.patch('/preferences', requireAuth, async (req, res) => {
  const { emailAnalysisResults } = req.body;

  if (typeof emailAnalysisResults !== 'boolean') {
    return res.status(400).json({ error: 'emailAnalysisResults must be a boolean value.' });
  }

  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (!user.preferences) user.preferences = {};
    user.preferences.emailAnalysisResults = emailAnalysisResults;
    await user.save();

    res.json({
      success: true,
      user: toSafeUser(user),
    });
  } catch (err) {
    console.error('[Unreel] Update preferences error:', err.message);
    res.status(500).json({ error: 'Could not update preferences.' });
  }
});

module.exports = router;
