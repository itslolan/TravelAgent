const axios = require('axios');

/**
 * Validate proxy health before creating sessions
 * Based on: https://roundproxies.com/blog/browserbase-proxies/
 */
async function validateProxyHealth(testUrl = 'http://httpbin.org/ip') {
  try {
    const response = await axios.get(testUrl, {
      timeout: 5000,
      validateStatus: (status) => status === 200
    });
    
    console.log('✅ Proxy health check passed:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Proxy health check failed:', error.message);
    return false;
  }
}

/**
 * Retry function with exponential backoff
 * Implements pattern from article for transient failures
 */
async function retryWithBackoff(fn, options = {}) {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    retryableErrors = ['proxy', 'timeout', 'network', 'ECONNREFUSED', 'ETIMEDOUT']
  } = options;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const errorMsg = error.message.toLowerCase();
      const isRetryable = retryableErrors.some(keyword => errorMsg.includes(keyword));
      
      if (!isRetryable || attempt === maxRetries - 1) {
        // Don't retry or max retries reached
        throw error;
      }

      const delay = baseDelay * (2 ** attempt); // 1s, 2s, 4s
      console.log(`⚠️  Attempt ${attempt + 1} failed: ${error.message}`);
      console.log(`   Retrying in ${delay}ms... (${attempt + 1}/${maxRetries})`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * Circuit breaker for proxy failures
 * Prevents overwhelming a failing proxy
 */
class CircuitBreaker {
  constructor(options = {}) {
    this.failThreshold = options.failThreshold || 5;
    this.resetAfter = options.resetAfter || 60000; // 60 seconds
    this.failures = 0;
    this.openUntil = 0;
    this.state = 'closed'; // closed, open, half-open
  }

  /**
   * Check if circuit allows requests
   */
  allow() {
    const now = Date.now();
    
    if (this.state === 'open') {
      if (now >= this.openUntil) {
        this.state = 'half-open';
        console.log('🔄 Circuit breaker entering half-open state');
        return true;
      }
      return false;
    }
    
    return true;
  }

  /**
   * Record success or failure
   */
  record(success) {
    if (success) {
      if (this.state === 'half-open') {
        console.log('✅ Circuit breaker closing (recovered)');
        this.state = 'closed';
      }
      this.failures = Math.max(0, this.failures - 1);
    } else {
      this.failures++;
      
      if (this.failures >= this.failThreshold) {
        this.state = 'open';
        this.openUntil = Date.now() + this.resetAfter;
        console.log(`⚠️  Circuit breaker OPEN (${this.failures} failures). Will retry in ${this.resetAfter/1000}s`);
        this.failures = 0; // Reset counter
      }
    }
  }

  getState() {
    return {
      state: this.state,
      failures: this.failures,
      openUntil: this.openUntil
    };
  }
}

// Global circuit breaker for BrowserBase sessions
const browserbaseCircuitBreaker = new CircuitBreaker({
  failThreshold: 5,
  resetAfter: 60000
});

module.exports = {
  validateProxyHealth,
  retryWithBackoff,
  CircuitBreaker,
  browserbaseCircuitBreaker
};
