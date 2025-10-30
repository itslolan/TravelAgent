const axios = require('axios');

const HYPERBROWSER_API_URL = 'https://api.hyperbrowser.ai/api/session';

/**
 * Create a HyperBrowser session
 * @param {Object} options - Session configuration options
 * @returns {Promise<Object>} Session details including wsEndpoint and liveUrl
 */
async function createHyperBrowserSession(options = {}) {
  const apiKey = process.env.HYPERBROWSER_API_KEY;
  
  if (!apiKey) {
    throw new Error('HYPERBROWSER_API_KEY is not set in environment variables');
  }

  console.log('🌐 Creating HyperBrowser session with enhanced features...');

  try {
    // Build session configuration
    const sessionConfig = {
      useStealth: options.useStealth !== false, // Default true
      useProxy: options.useProxy || false,
      proxyCountry: options.proxyCountry || options.countryCode || 'US',
      region: options.region || 'us-central',
      solveCaptchas: options.solveCaptchas || false,
      adblock: options.adblock !== false, // Default true
      trackers: options.trackers !== false, // Default true (block trackers)
      annoyances: options.annoyances !== false, // Default true (block annoyances)
      enableWebRecording: options.enableWebRecording || false,
      timeoutMinutes: options.timeoutMinutes || 30,
      ignoreCertificateErrors: true, // Ignore SSL/TLS certificate errors
      screen: {
        width: 1440,
        height: 900
      }
    };

    // Add external proxy with priority: Bright Data > Round Proxies
    let proxySource = 'HyperBrowser Built-in';

    if (process.env.BRIGHTDATA_HOST && process.env.BRIGHTDATA_PORT &&
        process.env.BRIGHTDATA_USERNAME && process.env.BRIGHTDATA_PASSWORD) {
      // Use Bright Data proxy (highest priority)
      const proxyUrl = `http://${process.env.BRIGHTDATA_HOST}:${process.env.BRIGHTDATA_PORT}`;
      console.log('🔒 Using Bright Data proxy:', proxyUrl);
      sessionConfig.useProxy = true;
      sessionConfig.proxyServer = proxyUrl;
      sessionConfig.proxyServerUsername = process.env.BRIGHTDATA_USERNAME;
      sessionConfig.proxyServerPassword = process.env.BRIGHTDATA_PASSWORD;
      proxySource = `Bright Data (${process.env.BRIGHTDATA_HOST}:${process.env.BRIGHTDATA_PORT})`;
    } else if (process.env.PROXY_SERVER && process.env.PROXY_USERNAME && process.env.PROXY_PASSWORD) {
      // Use Round Proxies (fallback)
      console.log('🔒 Using Round Proxies:', process.env.PROXY_SERVER);
      sessionConfig.useProxy = true;
      sessionConfig.proxyServer = process.env.PROXY_SERVER;
      sessionConfig.proxyServerUsername = process.env.PROXY_USERNAME;
      sessionConfig.proxyServerPassword = process.env.PROXY_PASSWORD;
      proxySource = `Round Proxies (${process.env.PROXY_SERVER})`;
    }

    console.log('📋 Session config:', {
      useStealth: sessionConfig.useStealth,
      useProxy: sessionConfig.useProxy,
      proxyCountry: sessionConfig.proxyCountry,
      region: sessionConfig.region,
      adblock: sessionConfig.adblock
    });

    // Create session via API
    const response = await axios.post(HYPERBROWSER_API_URL, sessionConfig, {
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json'
      }
    });

    const sessionData = response.data;
    
    console.log('✅ HyperBrowser session created:', sessionData.id);
    console.log('🔗 WebSocket endpoint:', sessionData.wsEndpoint);
    console.log('👁️  Live view URL:', sessionData.liveUrl);
    console.log(`   Proxy: ${proxySource}`);

    return {
      sessionId: sessionData.id,
      connectUrl: sessionData.wsEndpoint,
      debuggerUrl: sessionData.liveUrl,
      liveViewUrl: sessionData.liveUrl,
      sessionData
    };

  } catch (error) {
    console.error('❌ Failed to create HyperBrowser session:', error.message);
    if (error.response?.data) {
      console.error('   Response:', JSON.stringify(error.response.data, null, 2));
    }
    throw error;
  }
}

/**
 * Stop a HyperBrowser session
 * @param {string} sessionId - The session ID to stop
 */
async function stopHyperBrowserSession(sessionId) {
  const apiKey = process.env.HYPERBROWSER_API_KEY;
  
  if (!apiKey) {
    console.warn('⚠️  HYPERBROWSER_API_KEY not set, cannot stop session');
    return;
  }

  try {
    console.log(`🛑 Stopping HyperBrowser session: ${sessionId}`);
    
    await axios.delete(`${HYPERBROWSER_API_URL}/${sessionId}`, {
      headers: {
        'x-api-key': apiKey
      }
    });
    
    console.log('✅ HyperBrowser session stopped');
  } catch (error) {
    console.error('❌ Failed to stop HyperBrowser session:', error.message);
    // Don't throw - session might have already ended
  }
}

/**
 * Get HyperBrowser session details
 * @param {string} sessionId - The session ID
 * @returns {Promise<Object>} Session details
 */
async function getHyperBrowserSession(sessionId) {
  const apiKey = process.env.HYPERBROWSER_API_KEY;
  
  if (!apiKey) {
    throw new Error('HYPERBROWSER_API_KEY is not set in environment variables');
  }

  try {
    const response = await axios.get(`${HYPERBROWSER_API_URL}/${sessionId}`, {
      headers: {
        'x-api-key': apiKey
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('❌ Failed to get HyperBrowser session:', error.message);
    throw error;
  }
}

module.exports = {
  createHyperBrowserSession,
  stopHyperBrowserSession,
  getHyperBrowserSession
};
