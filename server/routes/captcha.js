const express = require('express');
const router = express.Router();
const { isHumanSolvingEnabled } = require('../config/captchaConfig');

// Store active CAPTCHA sessions
const captchaSessions = new Map();

/**
 * Notify that a CAPTCHA has been solved by human user
 * POST /api/captcha-solved
 */
router.post('/captcha-solved', async (req, res) => {
  try {
    const { minionId, sessionId, solved } = req.body;

    if (!minionId || !sessionId) {
      return res.status(400).json({
        error: 'Missing required fields: minionId and sessionId'
      });
    }

    console.log(`👤 CAPTCHA solved notification for minion ${minionId}, session ${sessionId}`);

    // Store the solved status
    captchaSessions.set(minionId, {
      sessionId,
      solved: solved === true,
      timestamp: new Date().toISOString(),
      method: 'human'
    });

    // In a real implementation, you would notify the minion process
    // For now, we'll just acknowledge the request
    res.json({
      success: true,
      message: 'CAPTCHA solution recorded',
      minionId,
      sessionId,
      solved
    });

  } catch (error) {
    console.error('❌ Error handling CAPTCHA solved notification:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

/**
 * Check if a CAPTCHA has been solved for a minion
 * GET /api/captcha-status/:minionId
 */
router.get('/captcha-status/:minionId', (req, res) => {
  try {
    const { minionId } = req.params;
    const session = captchaSessions.get(minionId);

    if (!session) {
      return res.json({
        solved: false,
        waiting: true,
        message: 'No CAPTCHA session found'
      });
    }

    res.json({
      solved: session.solved,
      waiting: !session.solved,
      timestamp: session.timestamp,
      method: session.method,
      sessionId: session.sessionId
    });

  } catch (error) {
    console.error('❌ Error checking CAPTCHA status:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

/**
 * Clear CAPTCHA session (called when minion completes or fails)
 * DELETE /api/captcha-session/:minionId
 */
router.delete('/captcha-session/:minionId', (req, res) => {
  try {
    const { minionId } = req.params;
    const deleted = captchaSessions.delete(minionId);

    res.json({
      success: true,
      deleted,
      message: deleted ? 'CAPTCHA session cleared' : 'No session found'
    });

  } catch (error) {
    console.error('❌ Error clearing CAPTCHA session:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

/**
 * Get current CAPTCHA solving mode
 * GET /api/captcha-mode
 */
router.get('/captcha-mode', (req, res) => {
  try {
    const { getCaptchaMode, getCurrentModeConfig } = require('../config/captchaConfig');
    
    res.json({
      mode: getCaptchaMode(),
      isHumanSolving: isHumanSolvingEnabled(),
      config: getCurrentModeConfig()
    });

  } catch (error) {
    console.error('❌ Error getting CAPTCHA mode:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

module.exports = router;
