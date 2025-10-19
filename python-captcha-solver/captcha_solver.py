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
        
        # Ask model to check if CAPTCHA is solved
        task = f"""After executing '{previous_action}', analyze the current screen carefully.

CRITICAL INSTRUCTIONS:
1. Look at what changed after the action
2. Check if there's a checkmark, success indicator, or confirmation
3. If this is an image selection CAPTCHA and you clicked an image, verify if it was selected (highlighted/checkmark)
4. If this is a slider CAPTCHA and you dragged it, verify it reached the end
5. If you see "Verify" or "Submit" buttons, DO NOT click them yet unless ALL required steps are complete
6. Only return a submit/verify action if you see clear success indicators (checkmarks, "Success", green indicators)
7. If more selections are needed, provide the next selection action
8. Return ONE action at a time

Is the CAPTCHA completely solved? If yes, confirm completion. If no, provide the NEXT SINGLE action needed."""
        
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
