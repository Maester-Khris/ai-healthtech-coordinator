import functions_framework
import json
import google.cloud.firestore as firestore
import google.cloud.aiplatform as aiplatform
from vertexai.preview.generative_models import GenerativeModel, Part

# Initialize Firestore DB (outside the function for reuse)
db = firestore.Client()

# Initialize GenerativeModel for symptom extraction (outside for reuse)
# Assuming 'GEMINI' is already initialized globally or accessible here.
# If not, you'd initialize it like:
# vertexai.init(project="your-gcp-project-id", location="your-region")
# GEMINI = GenerativeModel("gemini-1.5-pro-preview-0514") # Or your specific Gemini model

# Initialize Vertex AI PredictionServiceClient for severity model (outside for reuse)
# Replace with your actual project ID and region where your severity model endpoint is deployed
# SEVERITY_ENDPOINT = "projects/YOUR_PROJECT_ID/locations/YOUR_REGION/endpoints/YOUR_SEVERITY_ENDPOINT_ID"
# Example placeholder, replace with your actual endpoint
SEVERITY_ENDPOINT_PATH = "projects/your-gcp-project-id/locations/your-region/endpoints/your-severity-endpoint-id"
severity_prediction_client = aiplatform.PredictionServiceClient()


@functions_framework.http
def triage(request):
    """
    HTTP Cloud Function to triage symptoms and return Dialogflow CX compatible response.
    Expects a POST request with a JSON body containing 'sessionInfo.parameters.user_message'.
    """
    if request.method != 'POST':
        return ('Method Not Allowed', 405)

    try:
        request_json = request.get_json(silent=True)
        if not request_json:
            return ('Invalid JSON in request body.', 400)

        # Dialogflow CX sends its parameters nested under sessionInfo.parameters
        user_msg = request_json.get('sessionInfo', {}).get('parameters', {}).get('user_message')

        if not user_msg:
            # Handle cases where 'user_message' might be in a different path or missing
            # If you are passing the raw user input directly to the webhook,
            # it might be under 'text' or 'transcript' in the request_json,
            # depending on your Dialogflow CX setup.
            # For this example, we assume it's mapped to a session parameter named 'user_message'.
            return ('Missing "user_message" parameter in Dialogflow CX request.', 400)

        # 1️⃣ Extract symptoms with Gemini function-calling
        # Ensure GEMINI is initialized and accessible.
        # This part assumes you have 'GEMINI' as a global or externally defined GenerativeModel instance.
        # If not, you'd need to uncomment and configure the GEMINI initialization above.
        prompt = Part.from_text(
            f"""Extract the key medical symptoms from this free-text (no interpretation):
            \"\"\"{user_msg}\"\"\".
            Return a JSON list of max 5 symptoms."""
        )
        symptoms_response = GEMINI.generate_content(prompt,
                                generation_config={"response_mime_type":"application/json"}
                             )
        symptoms = json.loads(symptoms_response.text)

        # Ensure symptoms is a list, even if Gemini returns a single string or non-list
        if not isinstance(symptoms, list):
            symptoms = [str(symptoms)] # Convert to list of string if not already

        # 2️⃣ Severity prediction model
        # Ensure SEVERITY_ENDPOINT_PATH is correctly configured
        prediction = severity_prediction_client.predict(
            endpoint=SEVERITY_ENDPOINT_PATH,
            instances=[{"symptoms": ", ".join(symptoms)}],
        )
        severity = prediction.predictions[0]["severity"]
        confidence = prediction.predictions[0]["confidence"]

        # 3️⃣ Save to Firestore (optional, but good practice for logging)
        doc_ref_id = None
        try:
            doc_ref = db.collection("patients").add({
                "msg": user_msg,
                "symptoms": symptoms,
                "severity": severity,
                "confidence": confidence,
                "status": "queued", # Initial status
                "timestamp": firestore.SERVER_TIMESTAMP
            })
            doc_ref_id = doc_ref[1].id # Access the ID from the result tuple
        except Exception as firestore_e:
            print(f"Error saving to Firestore: {firestore_e}")
            # Decide if you want to fail the webhook or continue without Firestore entry
            # For now, we'll just log and continue, as the primary goal is Dialogflow response.

        # 4️⃣ Construct Dialogflow CX WebhookResponse
        # Default message based on severity
        dialogflow_message = ""
        if severity == "routine":
            dialogflow_message = "Based on your symptoms, your condition appears routine. You may consider over-the-counter remedies or schedule a regular appointment if symptoms persist."
        elif severity == "moderate":
            dialogflow_message = "Your symptoms indicate a moderate concern. It's advisable to consult a healthcare professional within the next 24-48 hours. Would you like assistance finding a clinic?"
        elif severity == "urgent":
            dialogflow_message = "Your symptoms suggest an urgent need for care. Please seek medical attention within the next few hours. We can help you find an urgent care clinic or emergency room."
        elif severity == "emergent":
            dialogflow_message = "Your symptoms are emergent. Please call emergency services immediately or go to the nearest emergency room."
        else:
            dialogflow_message = "I couldn't determine the severity of your symptoms. Please clarify or provide more details."

        # Add a confidence message for transparency (optional)
        # You might only include this for specific debug scenarios or high confidence.
        # dialogflow_message += f" (Confidence: {confidence:.2f})"

        response_for_dialogflow = {
            "fulfillmentResponse": {
                "messages": [
                    {
                        "text": {
                            "text": [dialogflow_message]
                        }
                    }
                ]
            },
            "sessionInfo": {
                "parameters": {
                    "triage_severity": severity, # Use a clear parameter name for CX conditions
                    "triage_confidence": float(confidence), # Ensure it's a float
                    "triage_doc_id": doc_ref_id, # Pass the Firestore document ID back
                    "extracted_symptoms": ", ".join(symptoms) # Pass extracted symptoms back for potential display/logging
                }
            }
            # targetPage or targetFlow can be added here if you want to force a transition
            # but it's usually better to handle transitions with conditions in CX Routes
        }

        return jsonify(response_for_dialogflow), 200

    except Exception as e:
        print(f"An error occurred in triage function: {e}")
        # Return a generic error message to Dialogflow CX
        error_response = {
            "fulfillmentResponse": {
                "messages": [
                    {
                        "text": {
                            "text": ["I'm sorry, I encountered an error while trying to process your request. Please try again later."]
                        }
                    }
                ]
            },
            "sessionInfo": {
                "parameters": {
                    "triage_severity": "error", # Indicate an error state
                    "error_details": str(e) # For debugging in Dialogflow CX logs
                }
            }
        }
        return jsonify(error_response), 500