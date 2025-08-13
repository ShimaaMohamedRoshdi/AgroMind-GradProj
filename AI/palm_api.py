from flask import Flask, request, jsonify
import google.generativeai as palm
from flask_cors import CORS
import os  # Import the os module
from dotenv import load_dotenv  # Import load_dotenv      
from datetime import datetime
import uuid

load_dotenv()  # Load environment variables from .env file

app = Flask(__name__)
CORS(app)

# Set your Gemini 1.5 (PaLM) API key from environment variable
api_key = os.environ.get("PALM_API_KEY")
if not api_key:
    raise ValueError("PALM_API_KEY environment variable not set.")
palm.configure(api_key=api_key)

# ENHANCED: Conversation memory storage
conversation_sessions = {}


def get_or_create_session(session_id):
    """Get existing session or create new one"""
    if session_id not in conversation_sessions:
        conversation_sessions[session_id] = {
            'messages': [],
            'created_at': datetime.now(),
            'last_activity': datetime.now()
        }
    else:
        conversation_sessions[session_id]['last_activity'] = datetime.now()
    return conversation_sessions[session_id]


def build_conversation_context(session):
    """Build conversation context from message history"""
    context = "You are AgroMind, an expert agricultural AI assistant specializing in crop disease detection and agricultural advice. You help farmers with CONCISE, FOCUSED advice. Keep responses brief and practical - aim for 2-3 sentences unless specifically asked for more detail.\n\n"

    if session['messages']:
        context += "Previous conversation:\n"
        for msg in session['messages'][-10:]:  # Keep last 10 messages for context
            context += f"User: {msg['user']}\n"
            context += f"Assistant: {msg['assistant']}\n\n"

    context += "Current conversation:\n"
    return context


@app.route('/palm-chat', methods=['POST'])
def palm_chat():
    data = request.json
    prompt = data.get('prompt', '')
    session_id = data.get('session_id', 'default')
    # NEW: Disease detection context
    disease_context = data.get('disease_context', '')

    # Get or create conversation session
    session = get_or_create_session(session_id)

    # Build conversation context with history
    conversation_context = build_conversation_context(session)

    # Add disease context if provided
    if disease_context:
        conversation_context += f"IMPORTANT CONTEXT: The user just uploaded an image for disease detection. Here are the results:\n{disease_context}\n\n"

    # Add current user prompt
    full_prompt = conversation_context + f"User: {prompt}\nAssistant: "

    try:
        model = palm.GenerativeModel('gemini-1.5-flash-latest')
        response = model.generate_content(full_prompt)
        assistant_response = response.text

        # Store conversation in session memory
        session['messages'].append({
            'user': prompt,
            'assistant': assistant_response,
            'timestamp': datetime.now(),
            'disease_context': disease_context if disease_context else None
        })

        return jsonify({
            'response': assistant_response,
            'session_id': session_id
        })

    except Exception as e:
        return jsonify({'error': f'AI service error: {str(e)}'}), 500


@app.route('/new-session', methods=['POST'])
def new_session():
    """Create a new conversation session"""
    session_id = str(uuid.uuid4())
    get_or_create_session(session_id)
    return jsonify({'session_id': session_id})


@app.route('/clear-session', methods=['POST'])
def clear_session():
    """Clear conversation history for a session"""
    data = request.json
    session_id = data.get('session_id', 'default')

    if session_id in conversation_sessions:
        conversation_sessions[session_id]['messages'] = []
        return jsonify({'message': 'Session cleared successfully'})
    else:
        return jsonify({'message': 'Session not found'}), 404


@app.route('/session-info', methods=['POST'])
def session_info():
    """Get session information"""
    data = request.json
    session_id = data.get('session_id', 'default')

    if session_id in conversation_sessions:
        session = conversation_sessions[session_id]
        return jsonify({
            'session_id': session_id,
            'message_count': len(session['messages']),
            'created_at': session['created_at'].isoformat(),
            'last_activity': session['last_activity'].isoformat()
        })
    else:
        return jsonify({'message': 'Session not found'}), 404


if __name__ == '__main__':
    app.run(port=5005)
