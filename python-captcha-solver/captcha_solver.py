"""
Python microservice for solving CAPTCHAs using official Gemini 2.5 Computer Use API
Documentation: https://ai.google.dev/gemini-api/docs/computer-use
"""

import os
import base64
import json
from flask import Flask, request, jsonify
from google import genai
from google.genai import types
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = Flask(__name__)

# Configuration
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY environment variable is required")

# Initialize Gemini client
client = genai.Client(api_key=GEMINI_API_KEY)

# Recommended screen dimensions from documentation
SCREEN_WIDTH = 1440
SCREEN_HEIGHT = 900
MAX_ITERATIONS = 10

def denormalize_x(x: int, screen_width: int) -> int:
    """Convert normalized x coordinate (0-999) to actual pixel coordinate."""
    return int((x / 1000) * screen_width)

def denormalize_y(y: int, screen_height: int) -> int:
    """Convert normalized y coordinate (0-999) to actual pixel coordinate."""
    return int((y / 1000) * screen_height)

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'gemini-captcha-solver',
        'model': 'gemini-2.0-flash-exp',
        'method': 'function_calling_with_computer_use_patterns'
    })

@app.route('/analyze-strategy', methods=['POST'])
def analyze_strategy():
    """
    Phase 1: Analyze CAPTCHA and create a solving strategy
    Model observes the CAPTCHA and plans approach before taking actions
    """
    try:
        data = request.json
        screenshot_b64 = data.get('screenshot')
        current_url = data.get('current_url', '')
        
        if not screenshot_b64:
            return jsonify({'success': False, 'message': 'No screenshot provided'}), 400
        
        # Decode screenshot
        screenshot_bytes = base64.b64decode(screenshot_b64)
        
        # Strategy analysis prompt
        strategy_prompt = """You are analyzing a CAPTCHA challenge. DO NOT take any actions yet.

Your task is to:
1. Identify the type of CAPTCHA (image selection, slider, checkbox, carousel, etc.)
2. Understand what the challenge is asking you to do
3. Look for navigation elements (arrows, next/previous buttons, carousels)
4. Determine if multiple steps are needed (e.g., click through carousel items)
5. Create a step-by-step strategy to solve this CAPTCHA

IMPORTANT:
- If you see carousel/navigation arrows, note that you'll need to explore multiple options
- If it's an image selection CAPTCHA, identify how many images need to be selected
- DO NOT click verify/submit buttons until you're certain you have the correct solution
- Return your analysis and strategy as text

Describe your strategy in detail. What type of CAPTCHA is this? What steps will you take?"""
        
        # Use Gemini to analyze
        model = genai.GenerativeModel(model_name='gemini-2.0-flash-exp')
        
        contents = [
            types.Content(
                role="user",
                parts=[
                    types.Part(text=strategy_prompt),
                    types.Part.from_bytes(
                        data=screenshot_bytes,
                        mime_type='image/png'
                    )
                ]
            )
        ]
        
        response = model.generate_content(contents)
        strategy = response.text
        
        print(f"[Strategy] {strategy}")
        
        return jsonify({
            'success': True,
            'strategy': strategy,
            'message': 'Strategy created'
        })
        
    except Exception as e:
        print(f"Error in strategy analysis: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/solve-captcha', methods=['POST'])
def solve_captcha():
    """
    Solve CAPTCHA using Gemini Computer Use API
    
    Request body:
    {
        "screenshot": "base64_encoded_image",
        "task": "Task description",
        "screen_width": 1440,
        "screen_height": 900,
        "current_url": "https://example.com"
    }
    
    Response:
    {
        "success": true,
        "actions": [
            {
                "type": "click_at",
                "x": 500,
                "y": 400
            }
        ],
        "message": "CAPTCHA solving complete"
    }
    """
    try:
        data = request.json
        
        if not data:
            return jsonify({'error': 'No JSON data provided'}), 400
        
        screenshot_b64 = data.get('screenshot')
        task = data.get('task', 'Solve the CAPTCHA challenge to proceed to the next page.')
        screen_width = data.get('screen_width', SCREEN_WIDTH)
        screen_height = data.get('screen_height', SCREEN_HEIGHT)
        current_url = data.get('current_url', '')
        
        if not screenshot_b64:
            return jsonify({'error': 'screenshot is required'}), 400
        
        # Decode base64 screenshot
        screenshot_bytes = base64.b64decode(screenshot_b64)
        
        # Define Computer Use functions
        functions = [
            {
                "name": "move_mouse",
                "description": "Move the mouse cursor to specific coordinates without clicking. Use this to simulate human-like mouse movements.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "x": {"type": "integer", "description": "X coordinate (0-999)"},
                        "y": {"type": "integer", "description": "Y coordinate (0-999)"}
                    },
                    "required": ["x", "y"]
                }
            },
            {
                "name": "click_at",
                "description": "Click at specific coordinates on the screen",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "x": {"type": "integer", "description": "X coordinate (0-999)"},
                        "y": {"type": "integer", "description": "Y coordinate (0-999)"}
                    },
                    "required": ["x", "y"]
                }
            },
            {
                "name": "type_text_at",
                "description": "Type text at specific coordinates",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "x": {"type": "integer", "description": "X coordinate (0-999)"},
                        "y": {"type": "integer", "description": "Y coordinate (0-999)"},
                        "text": {"type": "string", "description": "Text to type"},
                        "press_enter": {"type": "boolean", "description": "Press enter after typing"}
                    },
                    "required": ["x", "y", "text"]
                }
            },
            {
                "name": "drag_and_drop",
                "description": "Drag an element from starting coordinates and drop it at destination coordinates. Perfect for CAPTCHA sliders and drag-to-verify challenges.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "x": {"type": "integer", "description": "Starting X coordinate (0-999)"},
                        "y": {"type": "integer", "description": "Starting Y coordinate (0-999)"},
                        "destination_x": {"type": "integer", "description": "Destination X coordinate (0-999)"},
                        "destination_y": {"type": "integer", "description": "Destination Y coordinate (0-999)"}
                    },
                    "required": ["x", "y", "destination_x", "destination_y"]
                }
            },
            {
                "name": "scroll_document",
                "description": "Scroll the page",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "direction": {"type": "string", "enum": ["up", "down"]}
                    },
                    "required": ["direction"]
                }
            },
            {
                "name": "wait_5_seconds",
                "description": "Wait for 5 seconds",
                "parameters": {"type": "object", "properties": {}}
            }
        ]
        
        # Configure the model with function calling
        config = types.GenerateContentConfig(
            tools=[types.Tool(function_declarations=functions)]
        )
        
        # Create initial content with task and screenshot
        contents = [
            types.Content(
                role="user",
                parts=[
                    types.Part(text=task),
                    types.Part.from_bytes(
                        data=screenshot_bytes,
                        mime_type='image/png'
                    )
                ]
            )
        ]
        
        # Call Gemini with vision + function calling
        print(f"[Gemini] Analyzing CAPTCHA...")
        response = client.models.generate_content(
            model='gemini-2.0-flash-exp',  # Use flash model with vision
            contents=contents,
            config=config
        )
        
        # Extract actions from response
        actions = []
        candidate = response.candidates[0]
        
        for part in candidate.content.parts:
            if part.function_call:
                function_call = part.function_call
                action_name = function_call.name
                args = dict(function_call.args) if hasattr(function_call, 'args') else {}
                
                # Handle drag_and_drop - ensure destination_y exists BEFORE denormalizing
                if action_name == 'drag_and_drop' and 'destination_x' in args and 'destination_y' not in args:
                    # Horizontal slider: destination_y same as starting y
                    if 'y' in args:
                        args['destination_y'] = args['y']
                        print(f"[Gemini] Note: destination_y missing, using horizontal slider (normalized y={args['y']})")
                
                # Denormalize coordinates if present
                if 'x' in args and 'y' in args:
                    args['x'] = denormalize_x(args['x'], screen_width)
                    args['y'] = denormalize_y(args['y'], screen_height)
                    
                    # Also denormalize destination coordinates for drag_and_drop
                    if 'destination_x' in args and 'destination_y' in args:
                        args['destination_x'] = denormalize_x(args['destination_x'], screen_width)
                        args['destination_y'] = denormalize_y(args['destination_y'], screen_height)
                        print(f"[Gemini] Action: {action_name} from ({args['x']}, {args['y']}) to ({args['destination_x']}, {args['destination_y']})")
                    else:
                        print(f"[Gemini] Action: {action_name} at ({args['x']}, {args['y']})")
                else:
                    print(f"[Gemini] Action: {action_name}")
                
                actions.append({
                    'type': action_name,
                    **args
                })
        
        # Check if there are any text responses
        text_response = None
        for part in candidate.content.parts:
            if part.text:
                text_response = part.text
                print(f"[Gemini] Response: {text_response}")
                break
        
        if not actions:
            # No actions returned - CAPTCHA might be solved or model couldn't determine action
            return jsonify({
                'success': True,
                'actions': [],
                'message': text_response or 'No actions needed',
                'complete': True
            })
        
        return jsonify({
            'success': True,
            'actions': actions,
            'message': text_response or f'{len(actions)} actions to execute',
            'complete': False
        })
        
    except Exception as e:
        print(f"[ERROR] {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/analyze-state', methods=['POST'])
def analyze_state():
    """
    Analyze current page state after action execution
    
    Request body:
    {
        "screenshot": "base64_encoded_image",
        "previous_action": "click_at",
        "current_url": "https://example.com"
    }
    
    Response:
    {
        "complete": true/false,
        "next_actions": [...],
        "message": "Status message"
    }
    """
    try:
        data = request.json
        
        screenshot_b64 = data.get('screenshot')
        previous_action = data.get('previous_action', 'unknown')
        current_url = data.get('current_url', '')
        
        if not screenshot_b64:
            return jsonify({'error': 'screenshot is required'}), 400
        
        screenshot_bytes = base64.b64decode(screenshot_b64)
        
        # Define Computer Use functions
        functions = [
            {
                "name": "move_mouse",
                "description": "Move the mouse cursor to specific coordinates without clicking. Use this to simulate human-like mouse movements.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "x": {"type": "integer", "description": "X coordinate (0-999)"},
                        "y": {"type": "integer", "description": "Y coordinate (0-999)"}
                    },
                    "required": ["x", "y"]
                }
            },
            {
                "name": "click_at",
                "description": "Click at specific coordinates",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "x": {"type": "integer", "description": "X coordinate (0-999)"},
                        "y": {"type": "integer", "description": "Y coordinate (0-999)"}
                    },
                    "required": ["x", "y"]
                }
            },
            {
                "name": "type_text_at",
                "description": "Type text at specific coordinates",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "x": {"type": "integer", "description": "X coordinate (0-999)"},
                        "y": {"type": "integer", "description": "Y coordinate (0-999)"},
                        "text": {"type": "string", "description": "Text to type"},
                        "press_enter": {"type": "boolean", "description": "Press enter after typing"}
                    },
                    "required": ["x", "y", "text"]
                }
            },
            {
                "name": "drag_and_drop",
                "description": "Drag an element from starting coordinates and drop it at destination coordinates",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "x": {"type": "integer", "description": "Starting X coordinate (0-999)"},
                        "y": {"type": "integer", "description": "Starting Y coordinate (0-999)"},
                        "destination_x": {"type": "integer", "description": "Destination X coordinate (0-999)"},
                        "destination_y": {"type": "integer", "description": "Destination Y coordinate (0-999)"}
                    },
                    "required": ["x", "y", "destination_x", "destination_y"]
                }
            }
        ]
        
        # Configure the model
        config = types.GenerateContentConfig(
            tools=[types.Tool(function_declarations=functions)]
        )
        
        # Ask model to assess current state and decide next action
        task = f"""After executing '{previous_action}', observe and assess the current screen.

HUMAN-LIKE BEHAVIOR - CRITICAL:
Before performing ANY click, drag, or type action, you MUST first make 2-3 random mouse movements to different areas of the screen to simulate natural human behavior. This helps avoid bot detection.

ASSESSMENT PHASE - Answer these questions:
1. What changed after the last action? (Was something selected? Did content change? Did a carousel move?)
2. If this is a carousel CAPTCHA: Did you explore all options using left/right arrows? Or do you need to click navigation to see more?
3. If this is an image selection CAPTCHA: Are all required images selected? Do you see checkmarks on the correct ones?
4. If this is a slider CAPTCHA: Did the slider reach the correct position? Is there a success indicator?
5. Do you have COMPLETE CONFIDENCE that you have the correct solution?

DECISION PHASE - Decide what to do next:
- ALWAYS start with 2-3 random move_mouse actions before your main action
- If you need to explore more (carousel arrows, next buttons): Move mouse randomly first, then click navigation to see more options
- If you need to select/deselect more items: Move mouse randomly first, then perform that action
- If you need to verify your work: Take another look at what you've selected
- If you are 100% CERTAIN you have the correct solution AND you see success indicators (checkmarks, green highlights): Move mouse randomly first, ONLY THEN click submit/verify
- If you're NOT certain: Continue exploring and verifying

CRITICAL RULES:
- ALWAYS perform 2-3 move_mouse actions before any click/drag/type action
- DO NOT click submit/verify unless you are ABSOLUTELY CERTAIN
- If there are carousel/navigation buttons, you MUST explore all options before submitting
- Return ONE action at a time
- Never rush to submit - thorough exploration is better than speed

What is your assessment? What single action should you take next?"""
        
        contents = [
            types.Content(
                role="user",
                parts=[
                    types.Part(text=task),
                    types.Part.from_bytes(
                        data=screenshot_bytes,
                        mime_type='image/png'
                    )
                ]
            )
        ]
        
        response = client.models.generate_content(
            model='gemini-2.0-flash-exp',
            contents=contents,
            config=config
        )
        
        # Extract actions
        actions = []
        candidate = response.candidates[0]
        
        for part in candidate.content.parts:
            if part.function_call:
                function_call = part.function_call
                action_name = function_call.name
                args = dict(function_call.args) if hasattr(function_call, 'args') else {}
                
                # Handle drag_and_drop - ensure destination_y exists BEFORE denormalizing
                if action_name == 'drag_and_drop' and 'destination_x' in args and 'destination_y' not in args:
                    if 'y' in args:
                        args['destination_y'] = args['y']
                
                # Denormalize coordinates
                if 'x' in args and 'y' in args:
                    args['x'] = denormalize_x(args['x'], SCREEN_WIDTH)
                    args['y'] = denormalize_y(args['y'], SCREEN_HEIGHT)
                    
                    # Also denormalize destination coordinates for drag_and_drop
                    if 'destination_x' in args and 'destination_y' in args:
                        args['destination_x'] = denormalize_x(args['destination_x'], SCREEN_WIDTH)
                        args['destination_y'] = denormalize_y(args['destination_y'], SCREEN_HEIGHT)
                
                actions.append({
                    'type': action_name,
                    **args
                })
        
        # Get text response
        text_response = None
        for part in candidate.content.parts:
            if part.text:
                text_response = part.text
                break
        
        # Determine if complete
        complete = len(actions) == 0
        
        return jsonify({
            'complete': complete,
            'next_actions': actions,
            'message': text_response or ('Complete' if complete else f'{len(actions)} more actions needed')
        })
        
    except Exception as e:
        print(f"[ERROR] {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    print(f"🚀 Starting Gemini CAPTCHA Solver on port {port}")
    print(f"📊 Using model: gemini-2.0-flash-exp (with Computer Use patterns)")
    print(f"🔑 API Key: {GEMINI_API_KEY[:10]}...")
    print(f"ℹ️  Note: Using function calling (Computer Use API not yet available in SDK)")
    app.run(host='0.0.0.0', port=port, debug=True)
