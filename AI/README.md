# AgroMind AI System

This directory contains the AI system for AgroMind, including disease detection and chatbot functionality.

## Components

### 1. Disease Detection API (`detect_disease_api.py`)
- **Port**: 5006
- **Purpose**: Plant disease detection using machine learning models
- **Features**:
  - Supports 38+ plant disease classes
  - Enhanced for Egyptian crops (tomato, orange, pepper, grape, etc.)
  - Arabic language support
  - Integration with chatbot for enhanced responses

### 2. Palm AI Chatbot API (`palm_api.py`)
- **Port**: 5005
- **Purpose**: Conversational AI using Google's Gemini 1.5 Flash
- **Features**:
  - Session-based conversation memory
  - Agricultural expertise
  - Integration with disease detection results
  - Concise, practical advice

### 3. Model Training Script (`train_my_model.py`)
- **Purpose**: Fine-tune Vision Transformer models on PlantVillage dataset
- **Features**:
  - Uses Google's ViT base model
  - Automated dataset loading and preprocessing
  - Configurable training parameters

## Setup Instructions

### Prerequisites
- Python 3.8+
- Node.js 16+
- Google AI API key (for Gemini)

### 1. Install Python Dependencies
```bash
cd AI
pip install -r requirements.txt
```

### 2. Environment Configuration
Create a `.env` file in the project root with:
```
PALM_API_KEY=your_google_ai_api_key_here
```

### 3. Start AI Services
```bash
# Terminal 1: Start Disease Detection API
cd AI
python detect_disease_api.py

# Terminal 2: Start Chatbot API
cd AI
python palm_api.py
```

### 4. Frontend Integration
The ChatBot component is already integrated in `src/components/ChatBot.jsx` and will automatically connect to the AI services.

## Usage

### Disease Detection
1. Upload an image of a plant leaf through the chatbot
2. The system will automatically detect the plant type and any diseases
3. Receive treatment recommendations and advice

### Chatbot
1. Click the chat icon in the bottom-right corner
2. Ask agricultural questions or upload plant images
3. Get expert advice and treatment recommendations

## API Endpoints

### Disease Detection API (Port 5006)
- `POST /detect-disease`: Upload image for disease detection
  - Form data: `image` (file), `session_id` (optional), `prompt` (optional)

### Chatbot API (Port 5005)
- `POST /palm-chat`: Send message to chatbot
- `POST /new-session`: Create new conversation session
- `POST /clear-session`: Clear conversation history
- `POST /session-info`: Get session information

## Supported Plants
- Tomato (طماطم)
- Orange/Citrus (برتقال)
- Bell Pepper (فلفل)
- Grape (عنب)
- Apple (تفاح)
- Peach (خوخ)
- Corn/Maize
- Potato
- And many more...

## Model Information
- **Base Model**: MobileNetV2 fine-tuned for plant disease identification
- **Classes**: 38+ disease and healthy plant categories
- **Accuracy**: Optimized for Egyptian agricultural conditions
- **Languages**: English and Arabic support

## Troubleshooting

### Common Issues
1. **Model loading errors**: Ensure stable internet connection for initial model download
2. **API connection errors**: Check that both AI services are running on correct ports
3. **Image upload issues**: Ensure images are in supported formats (JPG, PNG)

### Performance Tips
- Use clear, well-lit images of plant leaves
- Ensure good internet connection for AI responses
- Keep conversation sessions reasonable in length for better performance
