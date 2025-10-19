const { checkPageReadiness } = require('./geminiComputerUse');
const { solveCaptchaWithPythonService } = require('./geminiPythonService');

/**
 * Global Search Monitor
 * Checks all active searches in parallel every 30 seconds
 */
class SearchMonitor {
  constructor() {
    this.searches = new Map(); // searchId -> searchState
    this.monitorInterval = null;
    this.isMonitoring = false;
    this.CHECK_INTERVAL = 30000; // 30 seconds
  }

  /**
   * Register a new search to monitor
   */
  registerSearch(searchId, page, onProgress) {
    console.log(`📝 Registering search ${searchId} for monitoring`);
    
    this.searches.set(searchId, {
      searchId,
      page,
      onProgress,
      status: 'monitoring',
      checkCount: 0,
      maxChecks: 60, // 30 minutes max (60 checks × 30s)
      lastCheck: null,
      pageState: null,
      isReady: false,
      isSolvingCaptcha: false,
      startTime: Date.now()
    });

    // Start monitoring if not already running
    if (!this.isMonitoring) {
      this.startMonitoring();
    }
  }

  /**
   * Unregister a search (when complete or failed)
   */
  unregisterSearch(searchId) {
    console.log(`📝 Unregistering search ${searchId}`);
    this.searches.delete(searchId);

    // Stop monitoring if no searches left
    if (this.searches.size === 0 && this.isMonitoring) {
      this.stopMonitoring();
    }
  }

  /**
   * Get search state
   */
  getSearchState(searchId) {
    return this.searches.get(searchId);
  }

  /**
   * Start the global monitor
   */
  startMonitoring() {
    if (this.isMonitoring) return;

    console.log('🚀 Starting global search monitor (checks every 30s)');
    this.isMonitoring = true;

    // Check immediately
    this.checkAllSearches();

    // Then check every 30 seconds
    this.monitorInterval = setInterval(() => {
      this.checkAllSearches();
    }, this.CHECK_INTERVAL);
  }

  /**
   * Stop the global monitor
   */
  stopMonitoring() {
    if (!this.isMonitoring) return;

    console.log('🛑 Stopping global search monitor');
    this.isMonitoring = false;

    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
  }

  /**
   * Check all searches in parallel (non-blocking)
   */
  async checkAllSearches() {
    const searchIds = Array.from(this.searches.keys());
    
    if (searchIds.length === 0) {
      return;
    }

    console.log(`\n🔍 Checking ${searchIds.length} active search(es) in parallel...`);

    // Check all searches concurrently
    const checkPromises = searchIds.map(searchId => 
      this.checkSearch(searchId).catch(error => {
        console.error(`❌ Error checking search ${searchId}:`, error.message);
      })
    );

    await Promise.all(checkPromises);
    
    console.log(`✅ Parallel check complete for ${searchIds.length} search(es)\n`);
  }

  /**
   * Check a single search (async, non-blocking)
   */
  async checkSearch(searchId) {
    const search = this.searches.get(searchId);
    
    if (!search || search.status === 'complete' || search.status === 'failed') {
      return;
    }

    search.checkCount++;
    search.lastCheck = Date.now();

    console.log(`🔍 [${searchId}] Check #${search.checkCount}/${search.maxChecks}`);

    if (search.onProgress) {
      search.onProgress({
        status: 'loading',
        message: `AI checking page state (${search.checkCount}/${search.maxChecks})...`
      });
    }

    // Check if max checks reached
    if (search.checkCount >= search.maxChecks) {
      console.log(`⏱️ [${searchId}] Max checks reached, marking as ready`);
      search.status = 'complete';
      search.isReady = true;
      return;
    }

    try {
      // Check if page is still valid (not closed)
      if (search.page.isClosed && search.page.isClosed()) {
        console.log(`⚠️ [${searchId}] Page is closed, marking as failed`);
        search.status = 'failed';
        return;
      }

      // Check page readiness with Gemini
      const readinessCheck = await checkPageReadiness(search.page);
      
      search.pageState = readinessCheck.pageState;
      search.isReady = readinessCheck.isReady;

      console.log(`📊 [${searchId}] State: ${readinessCheck.pageState}, Ready: ${readinessCheck.isReady}, Confidence: ${(readinessCheck.confidence * 100).toFixed(0)}%`);
      console.log(`💭 [${searchId}] ${readinessCheck.reasoning}`);

      // Handle ready state
      if (readinessCheck.isReady && readinessCheck.pageState === 'results_ready') {
        console.log(`✅ [${searchId}] Results are ready!`);
        search.status = 'complete';
        if (search.onProgress) {
          search.onProgress({ status: 'ready', message: 'Flight results ready!' });
        }
        return;
      }

      // Handle CAPTCHA (non-blocking)
      if (readinessCheck.pageState === 'captcha' && !search.isSolvingCaptcha) {
        const useGeminiForCaptcha = process.env.USE_GEMINI_FOR_CAPTCHA === 'true';
        
        if (useGeminiForCaptcha) {
          console.log(`⚠️ [${searchId}] CAPTCHA detected! Starting async solver...`);
          search.isSolvingCaptcha = true;
          
          if (search.onProgress) {
            search.onProgress({
              status: 'solving_captcha',
              message: 'CAPTCHA detected, solving with Gemini...'
            });
          }

          // Solve CAPTCHA asynchronously (non-blocking)
          this.solveCaptchaAsync(searchId, search.page, search.onProgress);
        } else {
          console.log(`⚠️ [${searchId}] CAPTCHA detected, waiting for BrowserBase...`);
          if (search.onProgress) {
            search.onProgress({
              status: 'waiting_captcha',
              message: 'CAPTCHA detected, waiting for auto-solve...'
            });
          }
        }
      }

      // Handle no results
      if (readinessCheck.pageState === 'no_results') {
        console.log(`📭 [${searchId}] No results available`);
        search.status = 'complete';
        search.isReady = true;
        if (search.onProgress) {
          search.onProgress({ status: 'ready', message: 'No flights found' });
        }
        return;
      }

      // Handle error state
      if (readinessCheck.pageState === 'error') {
        console.log(`❌ [${searchId}] Error state detected, marking as ready`);
        search.status = 'complete';
        search.isReady = true;
        return;
      }

    } catch (error) {
      console.error(`❌ [${searchId}] Check error:`, error.message);
      console.error(`   Stack: ${error.stack}`);
      
      // Mark as failed if too many consecutive errors
      if (!search.errorCount) search.errorCount = 0;
      search.errorCount++;
      
      if (search.errorCount >= 5) {
        console.log(`⚠️ [${searchId}] Too many errors (${search.errorCount}), marking as complete to unblock`);
        search.status = 'complete';
        search.isReady = true;
      }
    }
  }

  /**
   * Solve CAPTCHA asynchronously (non-blocking)
   */
  async solveCaptchaAsync(searchId, page, onProgress) {
    const search = this.searches.get(searchId);
    if (!search) return;

    try {
      console.log(`🤖 [${searchId}] Solving CAPTCHA (async, non-blocking)...`);
      
      const solved = await solveCaptchaWithPythonService(page, onProgress);
      
      if (solved) {
        console.log(`✅ [${searchId}] CAPTCHA solved!`);
        // Wait a bit for page to load
        await page.waitForTimeout(3000);
      } else {
        console.log(`⚠️ [${searchId}] CAPTCHA solving failed`);
      }
      
    } catch (error) {
      console.error(`❌ [${searchId}] CAPTCHA solving error:`, error.message);
    } finally {
      // Reset flag so we can try again on next check if needed
      if (search) {
        search.isSolvingCaptcha = false;
      }
    }
  }

  /**
   * Wait for a search to complete
   */
  async waitForSearch(searchId, timeoutMs = 1800000) { // 30 min default
    const search = this.searches.get(searchId);
    if (!search) {
      throw new Error(`Search ${searchId} not found`);
    }

    const startTime = Date.now();
    
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        const currentSearch = this.searches.get(searchId);
        
        // Check if search is complete
        if (!currentSearch) {
          clearInterval(checkInterval);
          resolve({ status: 'complete', isReady: false });
          return;
        }

        if (currentSearch.status === 'complete') {
          clearInterval(checkInterval);
          resolve({
            status: 'complete',
            isReady: currentSearch.isReady,
            pageState: currentSearch.pageState
          });
          return;
        }

        // Check timeout
        if (Date.now() - startTime > timeoutMs) {
          clearInterval(checkInterval);
          console.log(`⏱️ [${searchId}] Timeout reached, returning current state`);
          resolve({
            status: 'timeout',
            isReady: currentSearch.isReady,
            pageState: currentSearch.pageState
          });
        }
      }, 1000); // Check every second
    });
  }
}

// Export singleton instance
const searchMonitor = new SearchMonitor();

module.exports = {
  searchMonitor
};
