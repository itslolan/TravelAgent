const axios = require('axios');
const { Hyperbrowser } = require('@hyperbrowser/sdk');
const fs = require('fs').promises;
const path = require('path');

const HYPERBROWSER_API_URL = 'https://api.hyperbrowser.ai/api/session';
const PROFILE_MAPPING_PATH = path.join(__dirname, '../data/profileMapping.json');

// Initialize HyperBrowser client
let hyperBrowserClient = null;
function getHyperBrowserClient() {
  if (!hyperBrowserClient) {
    const apiKey = process.env.HYPERBROWSER_API_KEY;
    if (!apiKey) {
      throw new Error('HYPERBROWSER_API_KEY is not set in environment variables');
    }
    hyperBrowserClient = new Hyperbrowser({ apiKey });
  }
  return hyperBrowserClient;
}

/**
 * Normalize website URL to a consistent key for profile mapping
 * Extracts domain from URL (e.g., "https://www.google.com/travel/flights" -> "google.com")
 */
function normalizeWebsiteKey(url) {
  try {
    const urlObj = new URL(url);
    // Remove 'www.' prefix if present
    return urlObj.hostname.replace(/^www\./, '');
  } catch (error) {
    console.error('❌ Invalid URL for normalization:', url);
    return url; // Fallback to original if parsing fails
  }
}

/**
 * Load profile mappings from JSON file
 */
async function loadProfileMappings() {
  try {
    const data = await fs.readFile(PROFILE_MAPPING_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    // If file doesn't exist or is invalid, return empty structure
    console.log('📋 No existing profile mappings found, starting fresh');
    return {
      profiles: {},
      metadata: {
        lastUpdated: null,
        version: '1.0'
      }
    };
  }
}

/**
 * Save profile mappings to JSON file
 */
async function saveProfileMappings(mappings) {
  try {
    mappings.metadata.lastUpdated = new Date().toISOString();
    await fs.writeFile(PROFILE_MAPPING_PATH, JSON.stringify(mappings, null, 2), 'utf-8');
    console.log('💾 Profile mappings saved');
  } catch (error) {
    console.error('❌ Failed to save profile mappings:', error.message);
  }
}

/**
 * Get existing profile for a website, if it exists
 */
async function getProfileForWebsite(websiteUrl) {
  const mappings = await loadProfileMappings();
  const key = normalizeWebsiteKey(websiteUrl);

  if (mappings.profiles[key]) {
    console.log(`♻️  Found existing profile for ${key}:`, mappings.profiles[key].profileName);
    return mappings.profiles[key];
  }

  console.log(`🆕 No existing profile found for ${key}`);
  return null;
}

/**
 * Create a new profile for a website
 */
async function createProfileForWebsite(websiteUrl) {
  const client = getHyperBrowserClient();
  const key = normalizeWebsiteKey(websiteUrl);
  const profileName = `profile-${key}-${Date.now()}`;

  console.log(`🔨 Creating new profile for ${key}: ${profileName}`);

  try {
    // Create profile using HyperBrowser SDK
    const profile = await client.profiles.create({
      name: profileName
    });

    console.log('✅ Profile created:', profile.id);

    // Save to mapping
    const mappings = await loadProfileMappings();
    mappings.profiles[key] = {
      websiteUrl,
      profileId: profile.id,
      profileName: profileName,
      createdAt: new Date().toISOString()
    };
    await saveProfileMappings(mappings);

    return mappings.profiles[key];
  } catch (error) {
    console.error('❌ Failed to create profile:', error.message);
    throw error;
  }
}

/**
 * Create a HyperBrowser session
 * @param {Object} options - Session configuration options
 * @param {string} options.websiteUrl - Optional website URL to enable profile-based caching
 * @returns {Promise<Object>} Session details including wsEndpoint and liveUrl
 */
async function createHyperBrowserSession(options = {}) {
  const apiKey = process.env.HYPERBROWSER_API_KEY;
  const proxyProvider = options.proxyProvider || 'brightdata';
  const websiteUrl = options.websiteUrl;

  if (!apiKey) {
    throw new Error('HYPERBROWSER_API_KEY is not set in environment variables');
  }

  console.log('🌐 Creating HyperBrowser session with enhanced features...');

  try {
    // Check if we should use profile-based sessions
    let profileData = null;
    if (websiteUrl) {
      // Try to get existing profile or create a new one
      profileData = await getProfileForWebsite(websiteUrl);
      if (!profileData) {
        profileData = await createProfileForWebsite(websiteUrl);
      }
    }
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

    // Configure external proxy based on user selection
    let proxySource = 'HyperBrowser Built-in';

    if (proxyProvider !== 'builtin') {
      if (proxyProvider === 'brightdata') {
        // Use Bright Data proxy
        if (process.env.BRIGHTDATA_HOST && process.env.BRIGHTDATA_PORT &&
            process.env.BRIGHTDATA_USERNAME && process.env.BRIGHTDATA_PASSWORD) {
          const proxyUrl = `http://${process.env.BRIGHTDATA_HOST}:${process.env.BRIGHTDATA_PORT}`;
          console.log('🔒 Using Bright Data proxy:', proxyUrl);
          sessionConfig.useProxy = true;
          sessionConfig.proxyServer = proxyUrl;
          sessionConfig.proxyServerUsername = process.env.BRIGHTDATA_USERNAME;
          sessionConfig.proxyServerPassword = process.env.BRIGHTDATA_PASSWORD;
          proxySource = `Bright Data (${process.env.BRIGHTDATA_HOST}:${process.env.BRIGHTDATA_PORT})`;
        } else {
          console.warn('⚠️  Bright Data selected but credentials not found in .env');
          console.log('🌐 Falling back to HyperBrowser built-in proxies');
        }
      } else if (proxyProvider === 'roundproxies') {
        // Use Round Proxies
        if (process.env.PROXY_SERVER && process.env.PROXY_USERNAME && process.env.PROXY_PASSWORD) {
          console.log('🔒 Using Round Proxies:', process.env.PROXY_SERVER);
          sessionConfig.useProxy = true;
          sessionConfig.proxyServer = process.env.PROXY_SERVER;
          sessionConfig.proxyServerUsername = process.env.PROXY_USERNAME;
          sessionConfig.proxyServerPassword = process.env.PROXY_PASSWORD;
          proxySource = `Round Proxies (${process.env.PROXY_SERVER})`;
        } else {
          console.warn('⚠️  Round Proxies selected but credentials not found in .env');
          console.log('🌐 Falling back to HyperBrowser built-in proxies');
        }
      }
    } else {
      console.log('🌐 Using HyperBrowser built-in proxies (user selected)');
    }

    console.log('📋 Session config:', {
      useStealth: sessionConfig.useStealth,
      useProxy: sessionConfig.useProxy,
      proxyCountry: sessionConfig.proxyCountry,
      region: sessionConfig.region,
      adblock: sessionConfig.adblock,
      profile: profileData ? profileData.profileName : 'none'
    });

    let sessionData;

    // Create session - use SDK if profile exists, otherwise use direct API
    if (profileData) {
      console.log(`📦 Using profile-based session: ${profileData.profileName}`);

      const client = getHyperBrowserClient();

      // Build profile configuration for SDK
      const sdkSessionConfig = {
        ...sessionConfig,
        profile: {
          id: profileData.profileId,
          persistChanges: true // Save browser state to profile
        }
      };

      sessionData = await client.sessions.create(sdkSessionConfig);
      console.log('✅ HyperBrowser session created with profile:', sessionData.id);
    } else {
      console.log('📝 Creating session without profile (direct API)');

      // Create session via direct API call (backward compatibility)
      const response = await axios.post(HYPERBROWSER_API_URL, sessionConfig, {
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json'
        }
      });

      sessionData = response.data;
      console.log('✅ HyperBrowser session created:', sessionData.id);
    }

    console.log('🔗 WebSocket endpoint:', sessionData.wsEndpoint);
    console.log('👁️  Live view URL:', sessionData.liveUrl);
    console.log(`   Proxy: ${proxySource}`);

    return {
      sessionId: sessionData.id,
      connectUrl: sessionData.wsEndpoint,
      debuggerUrl: sessionData.liveUrl,
      liveViewUrl: sessionData.liveUrl,
      sessionData,
      profileUsed: profileData ? profileData.profileName : null
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

    // Use SDK for consistency
    const client = getHyperBrowserClient();
    await client.sessions.stop(sessionId);

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
