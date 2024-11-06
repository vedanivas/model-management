from flask import Flask, request, jsonify
import importlib.util
import os
from flask_cors import CORS

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": ["http://localhost:5173", "http://localhost:5050"]}})
model_cache = {}

# Load models dynamically and store processor, model, classifier for reuse
@app.route('/loadModel', methods=['GET'])
def load_model(model_name="", call=False):
    model_name = request.args.get('model_name')
    if model_name in model_cache:
        if (call):
            return model_cache[model_name]
        return jsonify({"status": "success", "message": "Model loaded successfully"})

    model_path = f"models/{model_name}"
    
    # Import infer.py for the selected model
    infer_spec = importlib.util.spec_from_file_location("infer", os.path.join(model_path, "infer.py"))
    infer_module = importlib.util.module_from_spec(infer_spec)
    infer_spec.loader.exec_module(infer_module)

    # Use model-specific load_model function
    try:
        files = infer_module.load_model(model_path)

        # Cache the loaded components and prediction function
        model_cache[model_name] = {
            "files": files,
            "predict": infer_module.predict  # Reference to predict function
        }
    except Exception as e:
        return jsonify({"status": "failed", "error": f"Failed to load model '{model_name}': {str(e)}"}), 500

    if (call):
        return load_model(model_name, call)
    
    print(f"\nModel '{model_name}' loaded successfully\n")
    return jsonify({"status": "success", "message": "Model loaded successfully"})

@app.route('/predict', methods=['POST'])
def predict():
    model_name = request.args.get('model_name')
    audio_path = request.get_json()['audio_path']

    if not model_name:
        return jsonify({"error": "Model name is required"}), 400

    try:
        model_components = load_model(model_name, call=True)
        files, predict = model_components["files"], model_components["predict"]
    except Exception as e:
        return jsonify({"error": f"Failed to load model '{model_name}': {str(e)}"}), 500

    try:
        # Call the predict function from the model's infer.py
        print("\nCalling predict function.....\n")
        prediction = predict(audio_path, files)
        return jsonify(prediction)
    except Exception as e:
        return jsonify({"error": f"Prediction failed: {str(e)}"}), 500

@app.route('/', methods=['GET'])
def index():
    return "Model server is running!"

if __name__ == '__main__':
    app.run(port=5001)
