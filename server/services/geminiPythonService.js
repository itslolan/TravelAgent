const axios = require('axios');

// Python microservice URL
// Supports both full URL (PYTHON_CAPTCHA_SOLVER_URL) and hostname (PYTHON_CAPTCHA_SOLVER_HOST from Render)
const getPythonServiceUrl = () => {
  if (process.env.PYTHON_CAPTCHA_SOLVER_URL) {
    return process.env.PYTHON_CAPTCHA_SOLVER_URL;
  }
  if (process.env.PYTHON_CAPTCHA_SOLVER_HOST) {
    let host = process.env.PYTHON_CAPTCHA_SOLVER_HOST;
    // If host doesn't include a domain, append .onrender.com (Render's default)
    if (!host.includes('.')) {
      host = `${host}.onrender.com`;
    }
    // Render provides hostname without protocol, add https://
    return `https://${host}`;
  }
  return 'http://localhost:5000';
};

const PYTHON_SERVICE_URL = getPythonServiceUrl();
const MAX_ITERATIONS = 15; // Increased to allow for carousel exploration
const ITERATION_TIMEOUT = 25000; // 25 seconds per iteration (more time for assessment)

/**
 * Check if Python CAPTCHA solver service is available
 */
async function isPythonServiceAvailable() {
  try {
    const response = await axios.get(`${PYTHON_SERVICE_URL}/health`, { timeout: 2000 });
    return response.status === 200 && response.data.status === 'healthy';
  } catch (error) {
    return false;
  }
}

/**
 * Execute an action from Gemini Computer Use API
 */
async function executeAction(page, action) {
  const { type, ...args } = action;
  
  console.log(`  -> Executing: ${type}`, args);
  
  try {
    switch (type) {
      case 'open_web_browser':
        // Already open
        break;
        
      case 'wait_5_seconds':
        await page.waitForTimeout(5000);
        break;
        
      case 'go_back':
        await page.goBack({ waitUntil: 'networkidle', timeout: 5000 }).catch(() => {});
        break;
        
      case 'go_forward':
        await page.goForward({ waitUntil: 'networkidle', timeout: 5000 }).catch(() => {});
        break;
        
      case 'navigate':
        await page.goto(args.url, { waitUntil: 'networkidle', timeout: 30000 });
        break;
        
      case 'search':
        if (args.url) {
          await page.goto(args.url, { waitUntil: 'networkidle', timeout: 30000 });
        }
        break;
        
      case 'click_at':
        await page.mouse.click(args.x, args.y);
        break;
        
      case 'hover_at':
        await page.mouse.move(args.x, args.y);
        break;

      case 'move_mouse':
        await page.mouse.move(args.x, args.y);
        break;

      case 'type_text_at':
        // Click at position first
        await page.mouse.click(args.x, args.y);
        await page.waitForTimeout(500);
        
        // Clear if needed
        if (args.clear_before_typing) {
          await page.keyboard.press('Meta+A'); // Command+A on Mac
          await page.keyboard.press('Backspace');
        }
        
        // Type the text
        await page.keyboard.type(args.text, { delay: 20 });
        
        // Press enter if needed
        if (args.press_enter) {
          await page.keyboard.press('Enter');
        }
        break;
        
      case 'key_combination':
        const keys = args.keys.split('+');
        // Press down all keys
        for (const key of keys) {
          await page.keyboard.down(key);
        }
        // Release all keys in reverse order
        for (const key of keys.reverse()) {
          await page.keyboard.up(key);
        }
        break;
        
      case 'scroll_document':
        const scrollAmount = args.direction === 'down' ? 500 : -500;
        await page.evaluate((amount) => {
          window.scrollBy(0, amount);
        }, scrollAmount);
        break;
        
      case 'scroll_at':
        await page.mouse.move(args.x, args.y);
        const wheelDelta = args.direction === 'down' ? args.magnitude : -args.magnitude;
        await page.mouse.wheel(0, wheelDelta);
        break;
        
      case 'drag_and_drop':
        await page.mouse.move(args.x, args.y);
        await page.mouse.down();
        await page.mouse.move(args.destination_x, args.destination_y, { steps: 10 });
        await page.mouse.up();
        break;
        
      default:
        console.warn(`    Warning: Unimplemented action ${type}`);
        return { success: false, error: `Unimplemented action: ${type}` };
    }
    
    // Wait for potential navigations/renders
    await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(500);
    
    return { success: true };
  } catch (error) {
    console.error(`    Error executing ${type}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Solve CAPTCHA using Python Gemini Computer Use microservice
 */
async function solveCaptchaWithPythonService(page, onProgress) {
  console.log('\n🤖 Attempting to solve CAPTCHA with Gemini 2.5 Computer Use (via Python)...');
  
  // Check if page is valid
  try {
    if (page.isClosed && page.isClosed()) {
      console.error('❌ Page is closed, cannot solve CAPTCHA');
      return false;
    }
  } catch (error) {
    console.error('❌ Page validation failed:', error.message);
    return false;
  }
  
  // Check if Python service is available
  const isAvailable = await isPythonServiceAvailable();
  if (!isAvailable) {
    console.error('❌ Python CAPTCHA solver service is not available at', PYTHON_SERVICE_URL);
    console.error('   Start the Python service: cd python-captcha-solver && python captcha_solver.py');
    return false;
  }
  
  console.log('✅ Python service is available');
  
  if (onProgress) {
    onProgress({
      status: 'solving_captcha',
      message: 'Using Gemini 2.5 Computer Use to solve CAPTCHA...'
    });
  }
  
  try {
    const task = `You are looking at a CAPTCHA or security verification page. Your task is to solve the CAPTCHA challenge.

HUMAN-LIKE BEHAVIOR - CRITICAL:
Before performing ANY click, drag, or type action, you MUST first make 2-3 random mouse movements to different areas of the screen to simulate natural human behavior. This helps avoid bot detection.

Example sequence:
1. move_mouse to a random area (e.g., x: 350, y: 200)
2. move_mouse to another random area (e.g., x: 600, y: 450)
3. move_mouse to near your target element
4. THEN perform your actual action (click_at, drag_and_drop, type_text_at, etc.)

IMPORTANT INSTRUCTIONS:
1. ALWAYS start with 2-3 random move_mouse actions before your main action
2. Take ONE ACTION at a time (move_mouse, click, drag, type, etc.)
3. After EACH action, STOP and wait to see the updated screen
4. NEVER click submit/verify buttons immediately - first complete all required steps
5. For image selection CAPTCHAs: Move mouse randomly, then click each required image ONE AT A TIME, then wait
6. For slider CAPTCHAs: Move mouse randomly first, then drag the slider, then wait to verify it worked
7. For checkbox CAPTCHAs: Move mouse randomly first, then click the checkbox, then wait to see if more steps are needed
8. Only click submit/verify/continue buttons AFTER you have completed all other steps
9. If you see a checkmark or success indicator, THEN you can submit

Return ONE action at a time. Do not try to do multiple actions in one response.`;
    
    // Capture initial screenshot (JPEG for smaller size - better for SSE streaming)
    const screenshot = await page.screenshot({ type: 'jpeg', quality: 80 });
    let screenshotBase64 = screenshot.toString('base64');
    const currentUrl = page.url();
    console.log(`📸 Initial screenshot captured (${Math.round(screenshotBase64.length / 1024)}KB)`);
    
    // Get viewport size (with fallback to defaults)
    const viewport = page.viewportSize();
    const screenWidth = viewport?.width || 1440;
    const screenHeight = viewport?.height || 900;
    
    // PHASE 1: Strategy Planning
    console.log('\n🎯 Phase 1: Analyzing CAPTCHA and creating strategy...');
    if (onProgress) {
      onProgress({
        status: 'analyzing_strategy',
        message: 'AI analyzing CAPTCHA type and creating solving strategy...'
      });
    }
    
    let strategy = '';
    try {
      const strategyResponse = await axios.post(`${PYTHON_SERVICE_URL}/analyze-strategy`, {
        screenshot: screenshotBase64,
        current_url: currentUrl
      }, {
        timeout: 30000
      });
      
      if (strategyResponse.data.success) {
        strategy = strategyResponse.data.strategy;
        console.log('📋 Strategy created:');
        console.log(strategy);
        console.log('');
        
        if (onProgress) {
          const screenshotSize = screenshotBase64 ? Math.round(screenshotBase64.length / 1024) : 0;
          console.log(`📤 Sending strategy action with screenshot (${screenshotSize}KB)`);
          onProgress({
            status: 'strategy_ready',
            message: 'Strategy created: ' + strategy.substring(0, 100) + '...',
            action: {
              type: 'strategy',
              description: 'AI analyzed CAPTCHA and created solving strategy',
              reasoning: strategy,
              screenshot: screenshotBase64
            }
          });
        }
      }
    } catch (error) {
      console.warn('⚠️  Strategy planning failed, proceeding anyway:', error.message);
    }
    
    // PHASE 2: Execute Strategy (Action-Observe-Assess Loop)
    console.log('🎬 Phase 2: Executing strategy...');
    
    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      console.log(`\n=== Gemini Iteration ${iteration + 1}/${MAX_ITERATIONS} ===`);
      
      if (onProgress) {
        onProgress({
          status: 'gemini_thinking',
          message: `Gemini analyzing CAPTCHA (${iteration + 1}/${MAX_ITERATIONS})...`,
          iteration: iteration + 1,
          action: {
            type: 'analyzing',
            description: `Iteration ${iteration + 1}: Analyzing screenshot to determine next action`,
            reasoning: 'AI is examining the current state of the page',
            screenshot: screenshotBase64
          }
        });
      }
      
      // Get actions from Python service
      const response = await axios.post(`${PYTHON_SERVICE_URL}/solve-captcha`, {
        screenshot: screenshotBase64,
        task: task,
        screen_width: screenWidth,
        screen_height: screenHeight,
        current_url: currentUrl
      }, {
        timeout: 30000 // 30 second timeout
      });
      
      const { success, actions, message, complete } = response.data;
      
      if (!success) {
        console.error('❌ Python service returned error');
        return false;
      }
      
      console.log(`📨 Received: ${message}`);
      
      if (complete || actions.length === 0) {
        console.log('✅ CAPTCHA appears to be solved!');
        if (onProgress) {
          onProgress({
            status: 'gemini_complete',
            message: 'CAPTCHA solved',
            iteration: iteration + 1,
            action: {
              type: 'complete',
              description: 'CAPTCHA successfully solved!',
              reasoning: 'AI confirmed CAPTCHA is solved and page has progressed'
            }
          });
        }
        return true;
      }
      
      // Execute ONLY THE FIRST action (one at a time for verification)
      const firstAction = actions[0];
      
      if (actions.length > 1) {
        console.log(`⚠️  Model returned ${actions.length} actions, but executing only the first one for verification`);
      }
      
      if (onProgress) {
        // Build detailed action description
        let actionDescription = `Action: ${firstAction.type}`;
        const actionDetails = {
          type: firstAction.type,
          description: actionDescription,
          coordinates: null,
          reasoning: message || 'AI determined this action'
        };

        if (firstAction.x !== undefined && firstAction.y !== undefined) {
          actionDetails.coordinates = {
            x: firstAction.x,
            y: firstAction.y
          };
          actionDescription += ` at (${firstAction.x}, ${firstAction.y})`;
        }

        if (firstAction.text) {
          actionDescription += ` - Text: "${firstAction.text}"`;
        }

        if (firstAction.destination_x !== undefined) {
          actionDescription += ` → Drag to (${firstAction.destination_x}, ${firstAction.destination_y})`;
        }

        actionDetails.description = actionDescription;
        actionDetails.screenshot = screenshotBase64; // Screenshot BEFORE action

        const screenshotSize = screenshotBase64 ? Math.round(screenshotBase64.length / 1024) : 0;
        console.log(`📤 Sending ${firstAction.type} action with screenshot (${screenshotSize}KB)`);

        onProgress({
          status: 'gemini_action',
          message: actionDescription,
          action: actionDetails,
          iteration: iteration + 1
        });
      }

      console.log(`  -> Executing single action: ${firstAction.type}`);
      const actionResult = await executeAction(page, firstAction);
      
      if (!actionResult.success) {
        console.error(`⚠️  Action failed: ${actionResult.error}`);
        // Continue anyway, let Gemini see the result
      }
      
      // Wait for page to respond after the action
      await page.waitForTimeout(1000).catch(() => {
        console.warn('  -> Timeout wait failed, continuing...');
      });
      
      // Capture new screenshot for next iteration (JPEG for smaller size)
      const newScreenshot = await page.screenshot({ type: 'jpeg', quality: 80 }).catch(() => {
        console.error('  -> Screenshot failed, CAPTCHA solving cannot continue');
        return null;
      });

      if (!newScreenshot) {
        return false;
      }

      screenshotBase64 = newScreenshot.toString('base64');
      console.log(`📸 New screenshot captured (${Math.round(screenshotBase64.length / 1024)}KB)`);
      
      // PHASE 3: Observe and Assess
      console.log(`  -> 👀 Observing: What changed after ${firstAction.type}?`);
      
      let currentPageUrl = '';
      try {
        currentPageUrl = page.url();
      } catch (urlError) {
        console.warn('  -> Could not get page URL, using empty string');
      }
      
      if (onProgress) {
        onProgress({
          status: 'assessing',
          message: `AI assessing result of ${firstAction.type}...`,
          iteration: iteration + 1,
          action: {
            type: 'assess',
            description: `Observing changes after ${firstAction.type}`,
            reasoning: 'AI analyzing page response and deciding next step',
            screenshot: screenshotBase64 // Screenshot AFTER action
          }
        });
      }
      
      const stateResponse = await axios.post(`${PYTHON_SERVICE_URL}/analyze-state`, {
        screenshot: screenshotBase64,
        previous_action: firstAction.type,
        current_url: currentPageUrl
      }, {
        timeout: ITERATION_TIMEOUT
      });
      
      if (stateResponse.data.complete) {
        console.log('✅ AI confirms: CAPTCHA solution is correct and ready to submit!');
        return true;
      }
      
      console.log(`  -> 🤔 Assessment: ${stateResponse.data.message}`);
      console.log(`  -> 🔄 Decision: Continue exploring...`);
    }
    
    console.log('⚠️  Reached max iterations without solving CAPTCHA');
    return false;
    
  } catch (error) {
    console.error('❌ Error calling Python service:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    return false;
  }
}

module.exports = {
  solveCaptchaWithPythonService,
  isPythonServiceAvailable
};
