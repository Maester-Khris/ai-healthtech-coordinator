import json
import os
import functions_framework
from google.cloud import firestore
# from google.cloud.aiplatform_v1.services.prediction_service import PredictionServiceClient # No longer needed
# from vertexai.generative_models import GenerativeModel, Part # Still needed for symptom extraction
import vertexai # Still needed for vertexai.init
import random
import decimal # For precise decimal formatting

# PROJECT = os.environ["GCP_PROJECT"]
PROJECT = os.environ.get("GOOGLE_CLOUD_PROJECT", "crypto-sphere-464015-e4")
if not PROJECT:
    raise ValueError("GOOGLE_CLOUD_PROJECT environment variable not found.")

REGION = "us-central1"
vertexai.init(project=PROJECT, location=REGION) # Still needed for Gemini symptom extraction

# Latest at time of writing
# We keep GenerativeModel for symptom extraction, so this is still needed
from vertexai.generative_models import GenerativeModel, Part
GEMINI = GenerativeModel("gemini-2.5-flash")

# Remove or comment out SEVERITY_ENDPOINT and related client initialization
# SEVERITY_ENDPOINT = "projects/506101299280/locations/us-central1/endpoints/8775805933163905024"
# severity_prediction_client = PredictionServiceClient() # No longer needed

db = firestore.Client()

@functions_framework.http
def triage(request):

    if request.method != 'POST':
        return ('Method Not Allowed', 405)

    request_json = request.get_json(silent=True) # Get the full JSON body once
    print(f"user request {request_json}")

    if not request_json:
        return ('Invalid JSON in request body.', 400, {'Content-Type': 'application/json'})

    user_msg = None
    is_dialogflow_request = False

    # Try to extract user_msg from Dialogflow CX format
    if 'sessionInfo' in request_json and \
       'parameters' in request_json['sessionInfo'] and \
       'user_message' in request_json['sessionInfo']['parameters']:
        user_msg = request_json['sessionInfo']['parameters']['user_message']
        is_dialogflow_request = True
    # Fallback for direct testing or non-Dialogflow CX calls
    elif 'message' in request_json:
        user_msg = request_json['message']

    print(f"extracted user message {user_msg}")

    if not user_msg:
        error_message = 'Missing "user_message" (for Dialogflow CX) or "message" (for direct test) in request body.'
        if is_dialogflow_request:
             dialogflow_error_response = {
                "fulfillmentResponse": {
                    "messages": [
                        {"text": {"text": [error_message]}}
                    ]
                },
                "sessionInfo": {
                    "parameters": {"triage_severity": "error", "error_details": error_message}
                }
            }
             return json.dumps(dialogflow_error_response), 400, {'Content-Type': 'application/json'}
        else:
            return (error_message, 400, {'Content-Type': 'application/json'})

    try:
        # 1️⃣ extract symptoms with Gemini function-calling
        prompt = Part.from_text(
            f"""Extract the key medical symptoms from this free-text (no interpretation):
            \"\"\"{user_msg}\"\"\".
            Return a JSON list of max 5 symptoms."""
        )
        symptoms_response = GEMINI.generate_content(prompt,
                                    generation_config={"response_mime_type": "application/json"}
                                 )
        symptoms = json.loads(symptoms_response.text)
        print(f"symptoms are {symptoms}")

        # Ensure symptoms is a list, even if Gemini returns a single string or non-list
        if not isinstance(symptoms, list):
            symptoms = [str(symptoms)]

        # Handle empty symptom list if Gemini couldn't extract anything meaningful
        if not symptoms:
            severity = "no_symptoms_found"
            confidence = 0.0
            dialogflow_message = "I couldn't extract any specific symptoms from your message. Could you please describe them more clearly?"
        else:
            # 2️⃣ Severity prediction - STATIC CODE REPLACEMENT
            print(f"Switching to static severity prediction.")

            # Define possible severities
            possible_severities = ["routine", "moderate", "urgent", "emergent"]

            # Randomly select a severity
            severity = random.choice(possible_severities)

            # Randomly generate a confidence level (float with 3 decimal places)
            # Use Decimal for precise floating point arithmetic
            confidence_raw = random.uniform(0, 1)
            confidence = float(decimal.Decimal(confidence_raw).quantize(decimal.Decimal('0.001'), rounding=decimal.ROUND_HALF_UP))

            print(f"Randomly detected severity is {severity} with confidence level: {confidence}")

            # 3️⃣ Decide next step and prepare initial dialogflow_message
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
                severity = "unknown_severity"


        # 3️⃣ Save to Firestore
        doc_ref_id = None
        try:
            update_time, doc_ref = db.collection("patients").add({
                "msg": user_msg,
                "symptoms": symptoms,
                "severity": severity,
                "confidence": confidence,
                "status": "queued",
                "timestamp": firestore.SERVER_TIMESTAMP
            })
            doc_ref_id = doc_ref.id
        except Exception as firestore_e:
            print(f"Error saving to Firestore: {firestore_e}")
            dialogflow_message += "\n(Note: Could not save details to database.)"


        # 4️⃣ Construct Dialogflow CX WebhookResponse
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
                    "triage_severity": severity,
                    "triage_confidence": float(confidence), # Ensure it's a float for Dialogflow
                    "triage_doc_id": doc_ref_id,
                    "extracted_symptoms": ", ".join(symptoms)
                }
            }
        }

        # For direct testing, return a more concise response
        if not is_dialogflow_request:
            return json.dumps({
                "id": doc_ref_id,
                "severity": severity,
                "confidence": confidence,
                "message": dialogflow_message,
                "extracted_symptoms": symptoms
            }), 200, {'Content-Type': 'application/json'}
        else:
            # For Dialogflow CX, return the full webhook response
            return json.dumps(response_for_dialogflow), 200, {'Content-Type': 'application/json'}

    except Exception as e:
        print(f"An unexpected error occurred in triage function: {e}")
        import traceback # Ensure traceback is imported if not already
        traceback.print_exc()
        error_message = f"I'm sorry, an unexpected error occurred while processing your request: {e}. Please try again later."
        error_response = {
            "fulfillmentResponse": {
                "messages": [
                    {
                        "text": {
                            "text": [error_message]
                        }
                    }
                ]
            },
            "sessionInfo": {
                "parameters": {
                    "triage_severity": "error",
                    "error_details": str(e)
                }
            }
        }
        return json.dumps(error_response), 500, {'Content-Type': 'application/json'}