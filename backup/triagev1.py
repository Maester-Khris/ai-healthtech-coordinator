import vertexai
import json
import os
import functions_framework
from google.cloud import firestore
from google.cloud.aiplatform_v1.services.prediction_service import PredictionServiceClient
from vertexai.generative_models import GenerativeModel, Part

# PROJECT = os.environ["GCP_PROJECT"]
# Use .get() for safer access,
#
PROJECT = os.environ.get("GOOGLE_CLOUD_PROJECT", "crypto-sphere-464015-e4")
if not PROJECT:
    raise ValueError("GOOGLE_CLOUD_PROJECT environment variable not found.")

REGION = "us-central1"
vertexai.init(project=PROJECT, location=REGION)

# Latest at time of writing :contentReference[oaicite:0]{index=0}
GEMINI = GenerativeModel("gemini-2.5-flash")
SEVERITY_ENDPOINT = f"projects/{PROJECT}/locations/{REGION}/publishers/google/models/8775805933163905024"
f"https://us-central1-aiplatform.googleapis.com/v1/projects/{PROJECT}/locations/us-central1/endpoints/8775805933163905024:predict"
# f"https://{REGION}-aiplatform.googleapis.com/v1/projects/{PROJECT}/locations/{REGION}/endpoints"
# f"http://8775805933163905024.aiplatform.googleapis.com/v1/models/DEPLOYED_MODEL_ID:predict"
db = firestore.Client()
#severity_prediction_client = aiplatform.PredictionServiceClient()
severity_prediction_client = PredictionServiceClient()

@functions_framework.http
def triage(request):

    if request.method != 'POST':
        return ('Method Not Allowed', 405)

    request_json = request.get_json(silent=True) # Get the full JSON body once
    print(f"user request {request_json}")
    if not request_json:
        return ('Invalid JSON in request body.', 400, {'Content-Type': 'application/json'}) # Return JSON even for error

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
        # If no user_msg found in either format
        error_message = 'Missing "user_message" (for Dialogflow CX) or "message" (for direct test) in request body.'
        # For direct tests, return a simple error. For CX, it would be handled by the "error" severity.
        if is_dialogflow_request:
             # If it was a CX request but missing parameter, send back a CX error format
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
            symptoms = [str(symptoms)] # Convert to list of string if not already

        # Handle empty symptom list if Gemini couldn't extract anything meaningful
        if not symptoms:
            # You might define a "no_symptoms" severity or route for this
            severity = "no_symptoms_found"
            confidence = 0.0
            dialogflow_message = "I couldn't extract any specific symptoms from your message. Could you please describe them more clearly?"
        else:
            # 2️⃣ Severity prediction model
            prediction = severity_prediction_client.predict(
                endpoint=SEVERITY_ENDPOINT, # Use the correctly formatted endpoint path
                instances=[{"symptoms": ", ".join(symptoms)}],
            )
            print(f"prediction {prediction}")
            severity = prediction.predictions[0]["severity"]
            confidence = prediction.predictions[0]["confidence"]
            print(f"detected severity is {severity} with confidence level: {confidence}")


            # 3️⃣ Decide next step and prepare initial dialogflow_message
            dialogflow_message = "" # Initialize here for scope
            if severity == "routine":
                dialogflow_message = "Based on your symptoms, your condition appears routine. You may consider over-the-counter remedies or schedule a regular appointment if symptoms persist."
            elif severity == "moderate":
                dialogflow_message = "Your symptoms indicate a moderate concern. It's advisable to consult a healthcare professional within the next 24-48 hours. Would you like assistance finding a clinic?"
            elif severity == "urgent":
                dialogflow_message = "Your symptoms suggest an urgent need for care. Please seek medical attention within the next few hours. We can help you find an urgent care clinic or emergency room."
            elif severity == "emergent":
                dialogflow_message = "Your symptoms are emergent. Please call emergency services immediately or go to the nearest emergency room."
            else:
                # Fallback for unknown severity from your model
                dialogflow_message = "I couldn't determine the severity of your symptoms. Please clarify or provide more details."
                severity = "unknown_severity" # Set a specific status for CX


        # 3️⃣ Save to Firestore
        doc_ref_id = None
        try:
            # Using add() returns a tuple (update_time, document_reference)
            update_time, doc_ref = db.collection("patients").add({
                "msg": user_msg,
                "symptoms": symptoms,
                "severity": severity,
                "confidence": confidence,
                "status": "queued", # Initial status
                "timestamp": firestore.SERVER_TIMESTAMP
            })
            doc_ref_id = doc_ref.id # Correctly get the ID from the DocumentReference
        except Exception as firestore_e:
            print(f"Error saving to Firestore: {firestore_e}")
            dialogflow_message += "\n(Note: Could not save details to database.)" # Inform user if critical


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
                    "triage_confidence": float(confidence),
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
        # Return a generic error message to Dialogflow CX
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
                    "triage_severity": "error", # Indicate an error state for CX conditions
                    "error_details": str(e) # For debugging in Dialogflow CX logs
                }
            }
        }
        return json.dumps(error_response), 500, {'Content-Type': 'application/json'}


# ============================================================================================================================================

# import vertexai
# import json
# import os
# import functions_framework
# from google.cloud import firestore, aiplatform
# from vertexai.generative_models import GenerativeModel, Part

# # PROJECT = os.environ["GCP_PROJECT"]
# # Use .get() for safer access,
# PROJECT = os.environ.get("GOOGLE_CLOUD_PROJECT", "crypto-sphere-464015-e4")
# if not PROJECT:
#     raise ValueError("GOOGLE_CLOUD_PROJECT environment variable not found.")

# REGION = "us-central1"
# vertexai.init(project=PROJECT, location=REGION)

# # Latest at time of writing :contentReference[oaicite:0]{index=0}
# GEMINI = GenerativeModel("gemini-2.5-flash")
# SEVERITY_ENDPOINT = f"projects/{PROJECT}/locations/{REGION}/publishers/google/models/8775805933163905024"

# db = firestore.Client()


# @functions_framework.http
# def triage(request):
#     user_msg = request.get_json(silent=True)["message"]

#     # 1️⃣ extract symptoms with Gemini function-calling
#     prompt = Part.from_text(
#         f"""Extract the key medical symptoms from this free-text (no interpretation):
#         \"\"\"{user_msg}\"\"\".
#         Return a JSON list of max 5 symptoms."""
#     )
#     symptoms = json.loads(GEMINI.generate_content(prompt,
#                                                   generation_config={
#                                                       "response_mime_type": "application/json"}
#     ).text)

#     # New update
#     # Dialogflow CX sends its parameters nested under sessionInfo.parameters
#     user_msg = request_json.get('sessionInfo', {}).get(
#         'parameters', {}).get('user_message')
#     if not user_msg:
#         return ('Missing "user_message" parameter in Dialogflow CX request.', 400)

#     # 2️⃣ severity model
#     prediction = aiplatform.PredictionServiceClient().predict(
#         endpoint=SEVERITY_ENDPOINT,
#         instances=[{"symptoms": ", ".join(symptoms)}],
#     )
#     severity = prediction.predictions[0]["severity"]
#     confidence = prediction.predictions[0]["confidence"]

#     # 3️⃣ decide next step
#     doc_ref = db.collection("patients").add({
#         "msg": user_msg,
#         "symptoms": symptoms,
#         "severity": severity,
#         "confidence": confidence,
#         "status": "queued"
#     })[1]

#     # 4️⃣ Construct Dialogflow CX WebhookResponse
#     # Default message based on severity
#     dialogflow_message = ""
#     if severity == "routine":
#         dialogflow_message = "Based on your symptoms, your condition appears routine. You may consider over-the-counter remedies or schedule a regular appointment if symptoms persist."
#     elif severity == "moderate":
#         dialogflow_message = "Your symptoms indicate a moderate concern. It's advisable to consult a healthcare professional within the next 24-48 hours. Would you like assistance finding a clinic?"
#     elif severity == "urgent":
#         dialogflow_message = "Your symptoms suggest an urgent need for care. Please seek medical attention within the next few hours. We can help you find an urgent care clinic or emergency room."
#     elif severity == "emergent":
#         dialogflow_message = "Your symptoms are emergent. Please call emergency services immediately or go to the nearest emergency room."
#     else:
#         dialogflow_message = "I couldn't determine the severity of your symptoms. Please clarify or provide more details."

#     response_for_dialogflow = {
#         "fulfillmentResponse": {
#             "messages": [
#                     {
#                         "text": {
#                             "text": [dialogflow_message]
#                         }
#                     }
#                 ]
#         },
#         "sessionInfo": {
#             "parameters": {
#                     "triage_severity": severity,  # Use a clear parameter name for CX conditions
#                     # Ensure it's a float
#                     "triage_confidence": float(confidence),
#                     "triage_doc_id": doc_ref_id,  # Pass the Firestore document ID back
#                     # Pass extracted symptoms back for potential display/logging
#                     "extracted_symptoms": ", ".join(symptoms)
#                 }
#         }
#         # targetPage or targetFlow can be added here if you want to force a transition
#         # but it's usually better to handle transitions with conditions in CX Routes
#     }

#     return json.dumps(response_for_dialogflow), 200, {'Content-Type': 'application/json'}


# ============================================================================================================================================

# import vertexai, json, os, functions_framework
# from google.cloud import firestore, aiplatform
# from vertexai.generative_models import GenerativeModel, Part

# #PROJECT = os.environ["GCP_PROJECT"]
# PROJECT = os.environ.get("GOOGLE_CLOUD_PROJECT","crypto-sphere-464015-e4") # Use .get() for safer access,
# if not PROJECT:
#     raise ValueError("GOOGLE_CLOUD_PROJECT environment variable not found.")

# REGION  = "us-central1"
# vertexai.init(project=PROJECT, location=REGION)

# GEMINI  = GenerativeModel("gemini-1.5-pro-preview-0409")   # Latest at time of writing :contentReference[oaicite:0]{index=0}
# SEVERITY_ENDPOINT = f"projects/{PROJECT}/locations/{REGION}/publishers/google/models/8775805933163905024"

# db = firestore.Client()

# @functions_framework.http
# def triage(request):
#     user_msg = request.get_json(silent=True)["message"]

#     # 1️⃣ extract symptoms with Gemini function-calling
#     prompt = Part.from_text(
#         f"""Extract the key medical symptoms from this free-text (no interpretation):
#         \"\"\"{user_msg}\"\"\".
#         Return a JSON list of max 5 symptoms."""
#     )
#     symptoms = json.loads(GEMINI.generate_content(prompt,
#                     generation_config={"response_mime_type":"application/json"}
#                  ).text)


#     # New update
#     # Dialogflow CX sends its parameters nested under sessionInfo.parameters
#     user_msg = request_json.get('sessionInfo', {}).get('parameters', {}).get('user_message')
#     if not user_msg:
#         return ('Missing "user_message" parameter in Dialogflow CX request.', 400)


#     # 2️⃣ severity model
#     prediction = aiplatform.PredictionServiceClient().predict(
#         endpoint=SEVERITY_ENDPOINT,
#         instances=[{"symptoms": ", ".join(symptoms)}],
#     )
#     severity   = prediction.predictions[0]["severity"]
#     confidence = prediction.predictions[0]["confidence"]

#     # 3️⃣ decide next step
#     doc_ref = db.collection("patients").add({
#         "msg": user_msg,
#         "symptoms": symptoms,
#         "severity": severity,
#         "confidence": confidence,
#         "status": "queued"
#     })[1]

#     # 4️⃣ Construct Dialogflow CX WebhookResponse
#         # Default message based on severity
#         dialogflow_message = ""
#         if severity == "routine":
#             dialogflow_message = "Based on your symptoms, your condition appears routine. You may consider over-the-counter remedies or schedule a regular appointment if symptoms persist."
#         elif severity == "moderate":
#             dialogflow_message = "Your symptoms indicate a moderate concern. It's advisable to consult a healthcare professional within the next 24-48 hours. Would you like assistance finding a clinic?"
#         elif severity == "urgent":
#             dialogflow_message = "Your symptoms suggest an urgent need for care. Please seek medical attention within the next few hours. We can help you find an urgent care clinic or emergency room."
#         elif severity == "emergent":
#             dialogflow_message = "Your symptoms are emergent. Please call emergency services immediately or go to the nearest emergency room."
#         else:
#             dialogflow_message = "I couldn't determine the severity of your symptoms. Please clarify or provide more details."

    
#     response_for_dialogflow = {
#             "fulfillmentResponse": {
#                 "messages": [
#                     {
#                         "text": {
#                             "text": [dialogflow_message]
#                         }
#                     }
#                 ]
#             },
#             "sessionInfo": {
#                 "parameters": {
#                     "triage_severity": severity, # Use a clear parameter name for CX conditions
#                     "triage_confidence": float(confidence), # Ensure it's a float
#                     "triage_doc_id": doc_ref_id, # Pass the Firestore document ID back
#                     "extracted_symptoms": ", ".join(symptoms) # Pass extracted symptoms back for potential display/logging
#                 }
#             }
#             # targetPage or targetFlow can be added here if you want to force a transition
#             # but it's usually better to handle transitions with conditions in CX Routes
#         }

#     return json.dumps(response_for_dialogflow), 200, {'Content-Type': 'application/json'}
    
#     # initial function return
#     # return {"id": doc_ref.id,
#     #         "severity": severity,
#     #         "confidence": confidence}, 200
