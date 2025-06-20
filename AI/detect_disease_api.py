import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image
import torch
from transformers import AutoImageProcessor, AutoModelForImageClassification
import requests
import json

app = Flask(__name__)
CORS(app)

# Enhanced model with 38 classes supporting more Egyptian crops
MODEL_NAME = "linkanjarad/mobilenet_v2_1.0_224-plant-disease-identification"
try:
    processor = AutoImageProcessor.from_pretrained(MODEL_NAME)
    model = AutoModelForImageClassification.from_pretrained(
        MODEL_NAME, ignore_mismatched_sizes=True)
    print(f"Successfully loaded enhanced model: {MODEL_NAME}")
    print("Model supports 38 plant disease classes including Egyptian crops")
    print("Model config id2label:", model.config.id2label)
except Exception as e:
    print(f"Error loading model {MODEL_NAME}: {e}")
    processor = None
    model = None

# ENHANCED_PLANT_MAPPING for 38-class PlantVillage model supporting Egyptian crops
KNOWN_PLANT_MAPPING = {
    # Existing crops (enhanced)
    "corn": "Corn (Maize)",
    "maize": "Corn (Maize)",
    "potato": "Potato",
    "rice": "Rice",  # Note: Rice not in this model, will be handled separately
    "wheat": "Wheat",  # Note: Wheat not in this model, will be handled separately

    # Major Egyptian crops - NEW
    "tomato": "Tomato",
    "tomatoes": "Tomato",
    "طماطم": "Tomato",  # Arabic for tomato

    "orange": "Orange",
    "oranges": "Orange",
    "citrus": "Orange",
    "برتقال": "Orange",  # Arabic for orange

    "pepper": "Bell Pepper",
    "bell pepper": "Bell Pepper",
    "peppers": "Bell Pepper",
    "فلفل": "Bell Pepper",  # Arabic for pepper

    "grape": "Grape",
    "grapes": "Grape",
    "عنب": "Grape",  # Arabic for grape

    "peach": "Peach",
    "peaches": "Peach",
    "خوخ": "Peach",  # Arabic for peach

    "apple": "Apple",
    "apples": "Apple",
    "تفاح": "Apple",  # Arabic for apple

    # Additional crops in the model
    "cherry": "Cherry",
    "cherries": "Cherry",
    "blueberry": "Blueberry",
    "blueberries": "Blueberry",
    "raspberry": "Raspberry",
    "raspberries": "Raspberry",
    "strawberry": "Strawberry",
    "strawberries": "Strawberry",
    "soybean": "Soybean",
    "soybeans": "Soybean",
    "squash": "Squash"
}

MODEL_PLANT_PREFIXES = sorted(
    list(set(KNOWN_PLANT_MAPPING.values())), key=len, reverse=True)

# COMPREHENSIVE ADVICE DICTIONARY for 38-class PlantVillage model
advice_dict = {
    # APPLE DISEASES
    'Apple Scab': "Apply fungicides (captan, myclobutanil) during wet periods. Remove fallen leaves, prune for air circulation. Use resistant varieties like Liberty or Enterprise.",
    'Apple with Black Rot': "Remove infected fruit and cankers. Apply fungicides (thiophanate-methyl, captan) during bloom. Improve air circulation through pruning.",
    'Cedar Apple Rust': "Remove nearby cedar trees if possible. Apply fungicides (myclobutanil, propiconazole) before spore release. Use resistant apple varieties.",
    'Healthy Apple': "Your apple trees appear healthy! Continue regular monitoring, proper pruning, and balanced fertilization.",

    # BLUEBERRY
    'Healthy Blueberry Plant': "Your blueberry plants look healthy! Maintain acidic soil (pH 4.5-5.5), ensure good drainage, and regular watering.",

    # CHERRY DISEASES
    'Cherry with Powdery Mildew': "Apply sulfur-based fungicides or potassium bicarbonate. Improve air circulation, avoid overhead watering. Prune infected shoots.",
    'Healthy Cherry Plant': "Your cherry trees are healthy! Continue proper pruning, fertilization, and monitor for pests during growing season.",

    # CORN DISEASES
    'Corn (Maize) with Cercospora and Gray Leaf Spot': "Use resistant hybrids. Apply fungicides (strobilurins, triazoles) if severe. Practice crop rotation and residue management.",
    'Corn (Maize) with Common Rust': "Plant resistant varieties. Apply fungicides (propiconazole, azoxystrobin) if conditions favor disease. Ensure good air circulation.",
    'Corn (Maize) with Northern Leaf Blight': "Use resistant hybrids. Apply fungicides (strobilurins) preventively. Practice crop rotation and bury crop residue.",
    'Healthy Corn (Maize) Plant': "Your corn plants are healthy! Continue monitoring, especially during humid conditions, and maintain proper nutrition.",

    # GRAPE DISEASES
    'Grape with Black Rot': "Apply fungicides (mancozeb, captan) from bud break to harvest. Remove mummified berries and infected canes. Ensure good air circulation.",
    'Grape with Esca (Black Measles)': "No cure available. Remove infected wood, avoid large pruning wounds. Apply wound protectants. Consider trunk renewal for severely affected vines.",
    'Grape with Isariopsis Leaf Spot': "Apply copper-based fungicides. Improve air circulation through canopy management. Remove infected leaves and debris.",
    'Healthy Grape Plant': "Your grapevines look excellent! Continue proper pruning, canopy management, and monitor for diseases during humid periods.",

    # ORANGE/CITRUS DISEASES
    'Orange with Citrus Greening': "CRITICAL: This is a devastating disease spread by Asian citrus psyllid. Remove infected trees immediately. Control psyllid vectors with systemic insecticides. Plant certified disease-free trees.",

    # PEACH DISEASES
    'Peach with Bacterial Spot': "Apply copper-based bactericides during dormant season. Use resistant varieties. Improve air circulation, avoid overhead irrigation. Remove infected fruit and leaves.",
    'Healthy Peach Plant': "Your peach trees are healthy! Continue regular pruning, proper fertilization, and monitor for bacterial spot during wet weather.",

    # PEPPER DISEASES
    'Bell Pepper with Bacterial Spot': "Use copper-based bactericides. Plant resistant varieties. Avoid overhead watering, improve air circulation. Remove infected plant debris. Rotate crops.",
    'Healthy Bell Pepper Plant': "Your pepper plants look great! Continue proper spacing, avoid overhead watering, and monitor for bacterial diseases during humid weather.",

    # POTATO DISEASES
    'Potato with Early Blight': "Apply fungicides (chlorothalonil, mancozeb) preventively. Remove infected foliage. Practice crop rotation. Ensure proper plant spacing for air circulation.",
    'Potato with Late Blight': "URGENT: Apply fungicides (metalaxyl, copper) immediately. Remove infected plants. Avoid overhead watering. This disease spreads rapidly in cool, wet conditions.",
    'Healthy Potato Plant': "Your potato plants are healthy! Monitor closely during cool, wet weather for late blight. Maintain proper nutrition and spacing.",

    # RASPBERRY
    'Healthy Raspberry Plant': "Your raspberry canes look healthy! Continue proper pruning, remove old canes after fruiting, and ensure good air circulation.",

    # SOYBEAN
    'Healthy Soybean Plant': "Your soybean plants appear healthy! Continue monitoring for pests and diseases, maintain proper nutrition and weed control.",

    # SQUASH DISEASES
    'Squash with Powdery Mildew': "Apply fungicides (sulfur, potassium bicarbonate, neem oil). Improve air circulation. Plant resistant varieties. Avoid overhead watering.",

    # STRAWBERRY DISEASES
    'Strawberry with Leaf Scorch': "Remove infected leaves. Improve air circulation. Apply fungicides if severe. Ensure proper plant spacing. Avoid overhead watering during fruit development.",
    'Healthy Strawberry Plant': "Your strawberry plants look healthy! Continue proper spacing, remove old leaves, and monitor for leaf diseases during humid conditions.",

    # TOMATO DISEASES - Major Egyptian crop with comprehensive coverage
    'Tomato with Bacterial Spot': "Use copper-based bactericides. Plant resistant varieties. Avoid overhead watering. Remove infected plant debris. Practice crop rotation with non-solanaceous crops.",
    'Tomato with Early Blight': "Apply fungicides (chlorothalonil, mancozeb) preventively. Remove lower leaves touching soil. Improve air circulation. Mulch to prevent soil splash.",
    'Tomato with Late Blight': "URGENT: Apply fungicides (copper, chlorothalonil) immediately. Remove infected plants. This disease can destroy entire crops quickly in cool, wet conditions.",
    'Tomato with Leaf Mold': "Improve greenhouse ventilation. Reduce humidity. Apply fungicides (chlorothalonil). Remove infected leaves. Plant resistant varieties in greenhouse production.",
    'Tomato with Septoria Leaf Spot': "Apply fungicides (chlorothalonil, copper) preventively. Remove infected lower leaves. Mulch to prevent soil splash. Improve air circulation.",
    'Tomato with Spider Mites or Two-spotted Spider Mite': "Increase humidity around plants. Use predatory mites or insecticidal soap. Remove heavily infested leaves. Avoid over-fertilizing with nitrogen.",
    'Tomato with Target Spot': "Apply fungicides (chlorothalonil, copper) preventively. Remove infected plant debris. Practice crop rotation. Improve air circulation and reduce leaf wetness.",
    'Tomato Yellow Leaf Curl Virus': "VIRAL DISEASE: Remove infected plants immediately. Control whitefly vectors with insecticides or yellow sticky traps. Use virus-resistant varieties. Remove weeds that harbor virus.",
    'Tomato Mosaic Virus': "VIRAL DISEASE: Remove infected plants. Disinfect tools between plants. Control aphid vectors. Plant virus-resistant varieties. Avoid handling plants when wet.",
    'Healthy Tomato Plant': "Your tomato plants look excellent! Continue proper spacing, support systems, and monitor for diseases especially during humid weather. Regular pruning helps air circulation.",

    # EXTENDED DISEASES - Additional diseases for existing crops (simulated for demonstration)
    # These would be added when a larger model becomes available

    # Additional Tomato Diseases (Extended)
    'Tomato with Fusarium Wilt': "FUNGAL DISEASE: Remove infected plants immediately. Use resistant varieties (VF, VFN). Improve soil drainage. Practice crop rotation for 3-4 years. Apply fungicides (thiophanate-methyl) to soil.",
    'Tomato with Verticillium Wilt': "FUNGAL DISEASE: Use resistant varieties (V). Remove infected plants. Improve soil drainage and avoid overhead watering. Practice long crop rotation. Solarize soil in hot climates.",
    'Tomato with Anthracnose': "Apply fungicides (copper, chlorothalonil) preventively. Remove infected fruit immediately. Improve air circulation. Avoid overhead watering. Harvest fruit before full ripeness in wet conditions.",
    'Tomato with Blossom End Rot': "PHYSIOLOGICAL DISORDER: Maintain consistent soil moisture. Add calcium to soil if deficient. Mulch around plants. Avoid root damage during cultivation. Ensure proper pH (6.0-6.8).",
    'Tomato with Powdery Mildew': "Apply sulfur-based fungicides or potassium bicarbonate. Improve air circulation. Avoid overhead watering. Remove infected leaves. Plant resistant varieties in humid areas.",

    # Additional Corn Diseases (Extended)
    'Corn with Southern Corn Leaf Blight': "Use resistant hybrids. Apply fungicides (strobilurins, triazoles) if severe. Practice crop rotation. Remove crop residue. Plant at proper density for air circulation.",
    'Corn with Tar Spot': "NEW EMERGING DISEASE: Use resistant hybrids when available. Apply fungicides (strobilurins + triazoles) preventively. Scout fields regularly. Remove volunteer corn plants.",
    'Corn with Anthracnose Leaf Blight': "Use resistant varieties. Apply fungicides (strobilurins) if conditions favor disease. Practice crop rotation. Manage crop residue. Ensure proper plant nutrition.",
    'Corn with Eyespot': "Apply fungicides (strobilurins) if severe. Use resistant hybrids. Practice crop rotation. Remove crop debris. Avoid excessive nitrogen fertilization.",

    # Additional Potato Diseases (Extended)
    'Potato with Blackleg': "BACTERIAL DISEASE: Use certified seed potatoes. Avoid planting in wet, cold soil. Improve drainage. Remove infected plants immediately. Practice crop rotation.",
    'Potato with Scab': "Maintain soil pH below 5.2. Avoid fresh manure. Use resistant varieties. Ensure adequate soil moisture during tuber formation. Practice crop rotation with non-host crops.",
    'Potato with Rhizoctonia': "Use certified seed. Avoid planting in cold, wet soil. Apply fungicides (azoxystrobin) at planting. Hill properly to prevent tuber exposure. Practice crop rotation.",

    # Additional Apple Diseases (Extended)
    'Apple with Fire Blight': "BACTERIAL DISEASE: Prune infected branches 12 inches below symptoms. Disinfect tools between cuts. Apply copper or streptomycin during bloom. Remove water sprouts and suckers.",
    'Apple with Bitter Rot': "Apply fungicides (captan, thiophanate-methyl) during fruit development. Remove mummified fruit. Prune for air circulation. Avoid fruit injuries.",
    'Apple with Sooty Blotch': "Improve air circulation through pruning. Apply fungicides (captan) during wet periods. Remove infected fruit. Control weeds around trees.",

    # Additional Grape Diseases (Extended)
    'Grape with Downy Mildew': "Apply copper-based fungicides preventively. Improve air circulation through canopy management. Avoid overhead irrigation. Remove infected leaves promptly.",
    'Grape with Anthracnose': "Apply fungicides (copper, captan) from bud break. Remove infected canes during dormant pruning. Improve air circulation. Avoid overhead watering.",
    'Grape with Phomopsis Cane Spot': "Apply fungicides (copper, captan) during early season. Remove infected canes during pruning. Improve air circulation. Position shoots properly.",

    # Additional Citrus Diseases (Extended)
    'Orange with Citrus Canker': "BACTERIAL DISEASE: Remove infected trees if severe. Apply copper bactericides preventively. Avoid overhead irrigation. Control citrus leafminer. Use windbreaks.",
    'Orange with Melanose': "Apply copper fungicides during wet periods. Remove dead wood. Improve air circulation through pruning. Avoid overhead watering during fruit development.",
    'Orange with Scab': "Apply copper fungicides during early fruit development. Improve air circulation. Remove infected fruit. Prune for better light penetration.",

    # Additional Pepper Diseases (Extended)
    'Bell Pepper with Anthracnose': "Apply fungicides (copper, chlorothalonil) preventively. Remove infected fruit immediately. Improve air circulation. Practice crop rotation. Avoid overhead watering.",
    'Bell Pepper with Phytophthora Blight': "CRITICAL: Improve drainage immediately. Use raised beds. Apply fungicides (metalaxyl, copper) preventively. Remove infected plants. Practice crop rotation.",
    'Bell Pepper with Cercospora Leaf Spot': "Apply fungicides (chlorothalonil, copper) preventively. Remove infected leaves. Improve air circulation. Avoid overhead watering. Practice crop rotation."
}


def send_to_palm_ai(disease_context, user_prompt="", session_id="default"):
    """Send disease detection results to Palm AI for concise, focused response"""
    try:
        palm_url = "http://localhost:5005/palm-chat"

        # Create a very specific concise prompt
        if not user_prompt:
            user_prompt = "Give me ONLY the essential treatment in 1-2 sentences. No explanations, no background, just the immediate action needed."

        payload = {
            'prompt': user_prompt,
            'session_id': session_id,
            'disease_context': disease_context
        }

        response = requests.post(palm_url, json=payload, timeout=30)
        if response.status_code == 200:
            ai_response = response.json().get('response', 'AI response not available')

            # Aggressive truncation to ensure concise advice
            sentences = ai_response.split('.')
            if len(sentences) > 3:
                # Keep only first 2-3 sentences
                ai_response = '. '.join(sentences[:3]) + '.'

            # Final character limit
            if len(ai_response) > 250:
                ai_response = ai_response[:250] + "..."

            return ai_response
        else:
            # Fallback to basic advice without AI enhancement
            return disease_context
    except Exception as e:
        # Fallback to basic advice without AI enhancement
        return disease_context


@app.route('/detect-disease', methods=['POST'])
def detect_disease():
    if not model or not processor:
        return jsonify({'error': 'Model not loaded. Please check server logs.'}), 500

    if 'image' not in request.files:
        return jsonify({'error': 'Image is required.'}), 400

    file = request.files['image']
    user_prompt = request.form.get('prompt', '')  # Optional user prompt
    # Session ID for conversation memory
    session_id = request.form.get('session_id', 'default')

    try:
        img = Image.open(file.stream).convert('RGB')
    except Exception as e:
        return jsonify({'error': f"Invalid image file: {e}"}), 400

    inputs = processor(images=img, return_tensors="pt")
    with torch.no_grad():
        outputs = model(**inputs)
        logits = outputs.logits
        pred_idx = logits.argmax(-1).item()
        model_full_label = model.config.id2label[pred_idx]
        confidence = torch.softmax(logits, dim=-1)[0, pred_idx].item()

    # Parse the model prediction to extract plant and disease information
    detected_model_plant_actual = None
    detected_model_disease_part = None

    # Check if the prediction matches any of our supported plants
    for prefix in MODEL_PLANT_PREFIXES:
        if prefix in model_full_label:
            detected_model_plant_actual = prefix
            # Extract disease part - everything after the plant name
            if model_full_label.startswith("Healthy"):
                detected_model_disease_part = "healthy"
            else:
                # For diseased plants, the format is usually "Plant with Disease" or "Disease"
                if " with " in model_full_label:
                    detected_model_disease_part = model_full_label.split(" with ", 1)[
                        1]
                elif model_full_label.startswith(prefix):
                    # Handle cases like "Apple Scab" where plant is at the beginning
                    detected_model_disease_part = model_full_label[len(
                        prefix):].strip()
                else:
                    detected_model_disease_part = model_full_label
            break

    if not detected_model_plant_actual:
        return jsonify({
            'confirmation': False,
            'message': f"Could not identify plant type from image. Model prediction: '{model_full_label}'. Please ensure the image shows a clear view of plant leaves.",
            'confidence': confidence
        })

    # Provide concise, enhanced advice
    if "healthy" in model_full_label.lower():
        # Enhanced but concise healthy message
        enhanced_message = f"✅ Your {detected_model_plant_actual} plant looks healthy! Continue proper care and monitor regularly for early disease detection."

        return jsonify({
            'confirmation': True,
            'healthy': True,
            'plant': detected_model_plant_actual,
            'message': enhanced_message,
            'confidence': confidence,
            'session_id': session_id
        })
    else:
        # Get advice for the specific disease
        advice = advice_dict.get(
            model_full_label, "Specific treatment advice not found. Please consult a local agricultural expert.")

        # Extract disease name for display
        disease_name_to_display = detected_model_disease_part if detected_model_disease_part else model_full_label

        # Create enhanced but concise disease message
        enhanced_message = f"🔍 {detected_model_plant_actual} with {disease_name_to_display} detected ({confidence:.1%} confidence).\n\n💊 Treatment: {advice[:150]}{'...' if len(advice) > 150 else ''}"

        return jsonify({
            'confirmation': True,
            'healthy': False,
            'plant': detected_model_plant_actual,
            'disease': disease_name_to_display,
            'confidence': confidence,
            'advice': advice,
            'message': enhanced_message,  # Use enhanced message instead of ai_response
            'session_id': session_id
        })


if __name__ == '__main__':
    if model and processor:
        app.run(port=5006)
    else:
        print("API could not start because the model failed to load.")
