const OpenAI = require('openai');

// OpenAI Computer Use model
const COMPUTER_USE_MODEL = 'gpt-4o-2024-08-06'; // Model that supports computer use tools
// const COMPUTER_USE_MODEL = 'computer-use-preview'; // Model that supports computer use tools

const MAX_ITERATIONS = 30; // Maximum iterations for agent loop
const SCREEN_WIDTH = 1440;
const SCREEN_HEIGHT = 900;

/**
 * General computer use function - works with any browser automation task
 * Uses OpenAI's computer use tools to interact with web pages
 * 
 * @param {Object} params - Parameters
 * @param {Page} params.page - Playwright page object
 * @param {string} params.task - Task description for the AI
 * @param {Function} params.onProgress - Progress callback
 * @returns {Promise<Object>} Result with success status and extracted data
 */
async function runComputerUse({ page, task, onProgress = () => {} }) {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not set in environment variables');
  }
  
  const openai = new OpenAI({ apiKey });
  
  // Set viewport size
  await page.setViewportSize({ width: SCREEN_WIDTH, height: SCREEN_HEIGHT });
  
  // Inject click visualization CSS and helper function
  await page.addStyleTag({
    content: `
      .click-indicator {
        position: fixed;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background-color: rgba(255, 0, 0, 0.6);
        border: 2px solid rgba(255, 255, 255, 0.8);
        pointer-events: none;
        z-index: 999999;
        animation: clickPulse 5s ease-out;
        transform: translate(-50%, -50%);
      }
      
      @keyframes clickPulse {
        0% {
          transform: translate(-50%, -50%) scale(0.5);
          opacity: 1;
        }
        10% {
          transform: translate(-50%, -50%) scale(1.2);
          opacity: 0.8;
        }
        20% {
          transform: translate(-50%, -50%) scale(1);
          opacity: 0.7;
        }
        80% {
          transform: translate(-50%, -50%) scale(1);
          opacity: 0.7;
        }
        100% {
          transform: translate(-50%, -50%) scale(1.2);
          opacity: 0;
        }
      }
    `
  });
  
  await page.addScriptTag({
    content: `
      window.showClickIndicator = function(x, y) {
        const indicator = document.createElement('div');
        indicator.className = 'click-indicator';
        indicator.style.left = x + 'px';
        indicator.style.top = y + 'px';
        document.body.appendChild(indicator);
        
        setTimeout(() => {
          indicator.remove();
        }, 5000);
      };
    `
  });
  
  // Function to extract clickable elements and their coordinates
  async function getClickableElements() {
    try {
      // Wait for page to be ready (not navigating)
      await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {});
      
      return await page.evaluate(() => {
      const elements = [];
      const clickableSelectors = [
        'a', 'button', 'input[type="button"]', 'input[type="submit"]', 
        '[role="button"]', '[onclick]', 'select', 'input[type="checkbox"]',
        'input[type="radio"]', '[tabindex]', 'textarea', 'input[type="text"]',
        'input[type="email"]', 'input[type="password"]', 'input[type="search"]',
        'input[type="tel"]', 'input[type="url"]', 'input[type="number"]',
        'input[type="date"]', '[contenteditable="true"]'
      ];
      
      const allElements = document.querySelectorAll(clickableSelectors.join(','));
      
      allElements.forEach((el, index) => {
        // Skip hidden elements
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
          return;
        }
        
        const rect = el.getBoundingClientRect();
        
        // Skip elements outside viewport or with no size
        if (rect.width === 0 || rect.height === 0 || 
            rect.top > window.innerHeight || rect.bottom < 0 ||
            rect.left > window.innerWidth || rect.right < 0) {
          return;
        }
        
        // Get element text content
        let text = '';
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
          text = el.placeholder || el.value || el.name || el.id || '';
        } else if (el.tagName === 'SELECT') {
          text = el.options[el.selectedIndex]?.text || el.name || el.id || '';
        } else {
          text = el.innerText || el.textContent || el.ariaLabel || el.title || '';
        }
        
        // Clean up text
        text = text.trim().substring(0, 100); // Limit to 100 chars
        
        // Get element type/role
        const type = el.tagName.toLowerCase();
        const role = el.getAttribute('role') || type;
        
        // Calculate center coordinates
        const x = Math.round(rect.left + rect.width / 2);
        const y = Math.round(rect.top + rect.height / 2);
        
        if (text || type === 'input' || type === 'button' || type === 'a') {
          elements.push({
            id: index,
            type: type,
            role: role,
            text: text || `[${type}]`,
            x: x,
            y: y,
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          });
        }
      });
      
      return elements;
    });
    } catch (error) {
      // If page is navigating or context destroyed, return empty array
      if (error.message.includes('Execution context was destroyed') || 
          error.message.includes('Target closed') ||
          error.message.includes('Navigation')) {
        console.log('⚠️  Page is navigating, returning empty clickable elements list');
        return [];
      }
      // For other errors, log and return empty array
      console.error('Error getting clickable elements:', error.message);
      return [];
    }
  }
  
  // Take initial screenshot
  const initialScreenshot = await page.screenshot({ type: 'png' });
  const screenshotBase64 = initialScreenshot.toString('base64');
  
  // Get clickable elements for the initial page
  const clickableElements = await getClickableElements();
  console.log(`Found ${clickableElements.length} clickable elements on the page`);
  
  // Format clickable elements for the initial prompt
  const clickableElementsText = clickableElements.length > 0 
    ? clickableElements.map(el => 
        `  - "${el.text}" (${el.type}) at (${el.x}, ${el.y})`
      ).join('\n')
    : '  (No clickable elements detected)';

  // Track action history (plain text, no screenshots)
  const actionHistory = [];

  // Initialize conversation with system message and task
  const messages = [
    {
      role: 'system',
      content: `You are a computer use agent that can interact with web pages through screenshots and actions. You are an expert at navigating through travel websites in the browser.

You exercise your own judgement and explore the webpage to find a way to achieve a task you want. What that means is, for example, you use actions like scroll to see more of the page and find the button you want to click.

Available actions:
- click: Click at specific coordinates
- type: Type text at specific coordinates
- scroll: Scroll the page up or down
- wait: Wait for a specified duration
- navigate: Navigate to a URL
- report_captcha: Report when you detect a CAPTCHA challenge

When you see a screenshot, analyze it and decide what action to take next to complete the task.
Return your response in JSON format with the action details.

Important:
- Coordinates are in pixels relative to the viewport (${SCREEN_WIDTH}x${SCREEN_HEIGHT})
- You will receive an updated list of clickable elements with each screenshot
- Use the clickable elements list to find exact coordinates for buttons, links, and inputs
- Be precise with click coordinates - use the provided coordinates when available
- If the click is going to be very close to the edge of the screen, be careful not to register clicks on possible floating elements (e.g. some websites have help sections with floating buttons on the bottom right of the screen, clicking it will typically open a chat pane).
- **CRITICAL: After each action, carefully examine the resulting screenshot to verify your action worked as intended**
  - If you clicked a button, check if the expected result happened (e.g., form appeared, page changed, dropdown opened)
  - If you typed text, verify it appears in the correct field
  - If something didn't work, try a different approach or adjust your coordinates
- Wait for page loads after navigation or clicks
- Extract data when you've completed the task

**CAPTCHA DETECTION:**
- **ALWAYS check each screenshot for CAPTCHA challenges before taking any other action**
- If you see ANY of the following, immediately call report_captcha:
  - reCAPTCHA checkbox ("I'm not a robot")
  - hCaptcha challenges
  - Cloudflare verification pages ("Checking your browser...")
  - Image selection challenges (e.g., "Select all images with traffic lights")
  - Any other human verification challenge
- Do NOT attempt to solve CAPTCHAs yourself - always report them
- After reporting a CAPTCHA, a human will solve it and you can continue`

    },
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: `${task}

CLICKABLE ELEMENTS ON THE CURRENT PAGE:
${clickableElementsText}`
        },
        {
          type: 'image_url',
          image_url: {
            url: `data:image/png;base64,${screenshotBase64}`
          }
        }
      ]
    }
  ];
  console.log(messages);

  // Agent loop
  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    console.log(`\n=== Computer Use Iteration ${iteration + 1}/${MAX_ITERATIONS} ===`);
    
    onProgress({
      status: 'thinking',
      message: `AI is analyzing the screen (iteration ${iteration + 1}/${MAX_ITERATIONS})...`,
      iteration: iteration + 1
    });
    
    try {
      // Call OpenAI with function calling for computer use tools
      const response = await openai.chat.completions.create({
        model: COMPUTER_USE_MODEL,
        messages: messages,
        tools: [
          {
            type: 'function',
            function: {
              name: 'click',
              description: 'Click at specific coordinates on the screen',
              parameters: {
                type: 'object',
                properties: {
                  reasoning: { type: 'string', description: 'Plain English explanation of what you are doing and why (e.g., "Clicking the Flights tab to access the flight search form")' },
                  x: { type: 'number', description: 'X coordinate in pixels' },
                  y: { type: 'number', description: 'Y coordinate in pixels' }
                },
                required: ['reasoning', 'x', 'y']
              }
            }
          },
          {
            type: 'function',
            function: {
              name: 'type',
              description: 'Type text at specific coordinates',
              parameters: {
                type: 'object',
                properties: {
                  reasoning: { type: 'string', description: 'Plain English explanation of what you are doing and why (e.g., "Typing Vancouver in the departure city field to search for flights from Vancouver")' },
                  x: { type: 'number', description: 'X coordinate in pixels' },
                  y: { type: 'number', description: 'Y coordinate in pixels' },
                  text: { type: 'string', description: 'Text to type' },
                  press_enter: { type: 'boolean', description: 'Press enter after typing' }
                },
                required: ['reasoning', 'x', 'y', 'text']
              }
            }
          },
          {
            type: 'function',
            function: {
              name: 'scroll',
              description: 'Scroll the page',
              parameters: {
                type: 'object',
                properties: {
                  reasoning: { type: 'string', description: 'Plain English explanation of what you are doing and why (e.g., "Scrolling down to see more flight options")' },
                  direction: { type: 'string', enum: ['up', 'down'], description: 'Scroll direction' },
                  amount: { type: 'number', description: 'Scroll amount in pixels' }
                },
                required: ['reasoning', 'direction']
              }
            }
          },
          {
            type: 'function',
            function: {
              name: 'wait',
              description: 'Wait for a specified duration',
              parameters: {
                type: 'object',
                properties: {
                  seconds: { type: 'number', description: 'Number of seconds to wait' }
                },
                required: ['seconds']
              }
            }
          },
          {
            type: 'function',
            function: {
              name: 'navigate',
              description: 'Navigate to a URL',
              parameters: {
                type: 'object',
                properties: {
                  url: { type: 'string', description: 'URL to navigate to' }
                },
                required: ['url']
              }
            }
          },
          {
            type: 'function',
            function: {
              name: 'complete',
              description: 'Mark the task as complete and return extracted data',
              parameters: {
                type: 'object',
                properties: {
                  data: { type: 'object', description: 'Extracted data from the page' },
                  summary: { type: 'string', description: 'Summary of what was accomplished' }
                },
                required: ['data']
              }
            }
          },
          {
            type: 'function',
            function: {
              name: 'report_captcha',
              description: 'Report that a CAPTCHA challenge has been detected on the screen. Call this when you see any CAPTCHA, reCAPTCHA, hCaptcha, or other human verification challenge that requires solving.',
              parameters: {
                type: 'object',
                properties: {
                  captcha_type: { 
                    type: 'string', 
                    enum: ['recaptcha', 'hcaptcha', 'cloudflare', 'other'],
                    description: 'Type of CAPTCHA detected' 
                  },
                  description: { 
                    type: 'string', 
                    description: 'Brief description of what you see (e.g., "I see a reCAPTCHA checkbox asking to verify I am human")' 
                  }
                },
                required: ['captcha_type', 'description']
              }
            }
          }
        ],
        tool_choice: 'auto'
      });
      
      const choice = response.choices[0];
      
      // Check if task is complete (no tool calls)
      if (!choice.message.tool_calls || choice.message.tool_calls.length === 0) {
        console.log('No more actions needed');
        
        // Try to extract data from the message content
        const content = choice.message.content;
        if (content) {
          try {
            const data = JSON.parse(content);
            return {
              success: true,
              data: data,
              iterations: iteration + 1
            };
          } catch (e) {
            // Not JSON, return as text
            return {
              success: true,
              data: { message: content },
              iterations: iteration + 1
            };
          }
        }
        
        return {
          success: false,
          error: 'Task completed but no data extracted',
          iterations: iteration + 1
        };
      }

      // Add assistant message to conversation
      messages.push(choice.message);

      // Filter messages to reduce payload size
      // Keep: system message, last 2 user messages with images, all tool messages, all assistant messages
      const filteredMessages = [];
      let userMessagesWithImagesCount = 0;
      
      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        
        // Always keep system message
        if (msg.role === 'system') {
          filteredMessages.unshift(msg);
          continue;
        }
        
        // Always keep tool messages (tool call results)
        if (msg.role === 'tool') {
          filteredMessages.unshift(msg);
          continue;
        }
        
        // Always keep assistant messages (they contain tool_calls)
        if (msg.role === 'assistant') {
          filteredMessages.unshift(msg);
          continue;
        }
        
        // For user messages, check if they contain images
        if (msg.role === 'user') {
          const hasImage = Array.isArray(msg.content) && 
                          msg.content.some(item => item.type === 'image_url');
          
          if (hasImage) {
            userMessagesWithImagesCount++;
            
            // Keep only last 2 user messages with images
            if (userMessagesWithImagesCount <= 2) {
              filteredMessages.unshift(msg);
            } else {
              // Replace with text-only version (remove images)
              const textContent = msg.content
                .filter(item => item.type === 'text')
                .map(item => item.text)
                .join('\n');
              
              filteredMessages.unshift({
                role: 'user',
                content: textContent
              });
            }
          } else {
            // User message without images - keep it
            filteredMessages.unshift(msg);
          }
        }
      }
      
      // Replace messages array with filtered version
      messages.length = 0;
      messages.push(...filteredMessages);

      console.log(`Filtered messages: ${messages.length} total (kept last 2 screenshots)`);
      
      // Get current clickable elements BEFORE executing actions (for descriptions)
      const currentClickableElements = await getClickableElements();
      
      // Execute tool calls
      const toolResults = [];
      let clickScreenshotBase64 = null; // Store click screenshot if a click happens
      
      for (const toolCall of choice.message.tool_calls) {
        const functionName = toolCall.function.name;
        const args = JSON.parse(toolCall.function.arguments);
        
        console.log(`  -> Executing: ${functionName}`, args);
        
        // Find the element description from clickable elements list
        let elementDescription = null;
        if ((functionName === 'click' || functionName === 'type') && args.x && args.y) {
          const clickedElement = currentClickableElements.find(el => 
            Math.abs(el.x - args.x) < 20 && Math.abs(el.y - args.y) < 20
          );
          if (clickedElement) {
            elementDescription = `"${clickedElement.text}" ${clickedElement.type}`;
          }
        }
        
        let result;
        
        try {
          // Execute the action
          switch (functionName) {
            case 'click':
              // Show visual indicator
              await page.evaluate((coords) => {
                if (window.showClickIndicator) {
                  window.showClickIndicator(coords.x, coords.y);
                }
              }, { x: args.x, y: args.y });
              
              // Capture screenshot WITH the red dot visible
              const clickScreenshot = await page.screenshot({ type: 'png' });
              clickScreenshotBase64 = clickScreenshot.toString('base64'); // Store for later use
              
              await page.mouse.click(args.x, args.y);
              
              result = { 
                success: true, 
                message: `Clicked at (${args.x}, ${args.y}) - screenshot captured with red dot indicator`
              };
              
              // Record action in history with reasoning
              const clickReasoning = args.reasoning || (elementDescription ? `Clicked on ${elementDescription}` : `Clicked at coordinates (${args.x}, ${args.y})`);
              actionHistory.push(clickReasoning);
              break;
              
            case 'type':
              // Show visual indicator for the click before typing
              await page.evaluate((coords) => {
                if (window.showClickIndicator) {
                  window.showClickIndicator(coords.x, coords.y);
                }
              }, { x: args.x, y: args.y });
              
              await page.mouse.click(args.x, args.y);
              await page.keyboard.type(args.text);
              if (args.press_enter) {
                await page.keyboard.press('Enter');
              }
              result = { success: true, message: `Typed "${args.text}" at (${args.x}, ${args.y})` };
              
              // Record action in history with reasoning
              const typeReasoning = args.reasoning || (elementDescription ? `Typed "${args.text}" in ${elementDescription}${args.press_enter ? ' and pressed Enter' : ''}` : `Typed "${args.text}"${args.press_enter ? ' and pressed Enter' : ''}`);
              actionHistory.push(typeReasoning);
              break;
              
            case 'scroll':
              const scrollAmount = args.amount || 500;
              const deltaY = args.direction === 'down' ? scrollAmount : -scrollAmount;
              await page.mouse.wheel(0, deltaY);
              result = { success: true, message: `Scrolled ${args.direction} by ${scrollAmount}px` };
              
              // Record action in history with reasoning
              const scrollReasoning = args.reasoning || `Scrolled ${args.direction} by ${scrollAmount} pixels`;
              actionHistory.push(scrollReasoning);
              break;
              
            case 'wait':
              const waitMs = (args.seconds || 1) * 1000;
              await page.waitForTimeout(waitMs);
              result = { success: true, message: `Waited ${args.seconds} seconds` };
              
              // Record action in history
              actionHistory.push(`Waited ${args.seconds} seconds`);
              break;
              
            case 'navigate':
              await page.goto(args.url, { waitUntil: 'networkidle', timeout: 30000 });
              result = { success: true, message: `Navigated to ${args.url}` };
              
              // Record action in history
              actionHistory.push(`Navigated to ${args.url}`);
              break;
              
            case 'complete':
              console.log('Task marked as complete by AI');
              return {
                success: true,
                data: args.data,
                summary: args.summary,
                iterations: iteration + 1
              };
              
            case 'report_captcha':
              console.log('🤖 AI detected CAPTCHA:', args.captcha_type, '-', args.description);
              
              // Send CAPTCHA detection event to frontend
              onProgress({
                status: 'captcha_detected',
                message: `CAPTCHA detected: ${args.description}`,
                captchaType: args.captcha_type,
                minionId: 1
              });
              
              result = { 
                success: true, 
                message: 'CAPTCHA reported. Waiting for human to solve...',
                pause_execution: true
              };
              
              // Record in history
              actionHistory.push(`Detected ${args.captcha_type} CAPTCHA: ${args.description}`);
              
              // Return special flag to pause execution
              return {
                success: false,
                captcha_detected: true,
                captcha_type: args.captcha_type,
                description: args.description,
                iterations: iteration + 1
              };
              
            default:
              result = { success: false, error: `Unknown function: ${functionName}` };
          }
          
          onProgress({
            status: 'action_executed',
            message: `Executed: ${functionName}`,
            action: functionName,
            args: args
          });
          
        } catch (error) {
          console.error(`Error executing ${functionName}:`, error.message);
          result = { success: false, error: error.message };
        }
        
        // Add tool result to conversation
        toolResults.push({
          tool_call_id: toolCall.id,
          role: 'tool',
          name: functionName,
          content: JSON.stringify(result)
        });
      }
      
      // Add tool results to messages
      messages.push(...toolResults);
      
      // Wait for any navigation to complete after actions
      // This prevents "Execution context was destroyed" errors
      try {
        await page.waitForLoadState('networkidle', { timeout: 30000 });
      } catch (error) {
        // Ignore timeout - page might not be navigating
      }
      
      // Take new screenshot for next iteration
      const newScreenshot = await page.screenshot({ type: 'png' });
      const newScreenshotBase64 = newScreenshot.toString('base64');
      
      // Get updated clickable elements after actions
      const updatedClickableElements = await getClickableElements();
      console.log(`Found ${updatedClickableElements.length} clickable elements on the updated page`);
      
      const updatedClickableElementsText = updatedClickableElements.length > 0 
        ? updatedClickableElements.map(el => 
            `  - "${el.text}" (${el.type}) at (${el.x}, ${el.y})`
          ).join('\n')
        : '  (No clickable elements detected)';
      
      // Format action history
      const actionHistoryText = actionHistory.length > 0
        ? actionHistory.map((action, idx) => `${idx + 1}. ${action}`).join('\n')
        : 'No actions taken yet';
      
      // Build content array for the message
      const messageContent = [
        {
          type: 'text',
          text: `Here is the current state of the screen after the actions:

ACTION HISTORY (what you've done so far):
${actionHistoryText}

UPDATED CLICKABLE ELEMENTS:
${updatedClickableElementsText}`
        }
      ];
      
      // If a click happened, include the screenshot WITH the red dot first
      if (clickScreenshotBase64) {
        messageContent.push({
          type: 'text',
          text: '\n**CLICK LOCATION SCREENSHOT** (showing red dot where the click was executed):'
        });
        messageContent.push({
          type: 'image_url',
          image_url: {
            url: `data:image/png;base64,${clickScreenshotBase64}`
          }
        });
        messageContent.push({
          type: 'text',
          text: '\n**CURRENT STATE SCREENSHOT** (after click action completed):'
        });
      }
      
      // Always include the current state screenshot
      messageContent.push({
        type: 'image_url',
        image_url: {
          url: `data:image/png;base64,${newScreenshotBase64}`
        }
      });
      
      // Add screenshot and updated clickable elements to conversation
      messages.push({
        role: 'user',
        content: messageContent
      });
      
    } catch (error) {
      console.error(`Error in iteration ${iteration + 1}:`, error);
      
      if (error.message.includes('rate limit')) {
        console.log('Rate limit hit, waiting 10 seconds...');
        await page.waitForTimeout(10000);
        continue; // Retry this iteration
      }
      
      throw error;
    }
  }
  
  // Max iterations reached
  console.log('⚠️  Max iterations reached without completion');
  return {
    success: false,
    error: 'Max iterations reached',
    iterations: MAX_ITERATIONS
  };
}

module.exports = {
  runComputerUse
};
