"""
Emergent-sounding, single-turn synthetic symptom messages used to drive Phase B's
DeepEval Faithfulness pass (see docs/superpowers/plans/2026-07-12-triage-deepeval-faithfulness-eval.md).

Emergent severity bypasses TRIAGE_MIN_TURNS (llm_agent.py), so a single message
reliably produces a triage_response tool call with a recommended facility on the
first turn — no multi-turn conversation state needed.

Coordinates are jittered around downtown Toronto (CN Tower reference point),
matching the facility data's coverage area.
"""

SYMPTOM_SCENARIOS: list[dict] = [
    {"message": "I have crushing chest pain radiating to my left arm and I can't catch my breath.", "lat": 43.6426, "lng": -79.3871},
    {"message": "My face is drooping on one side and I can't lift my right arm, this started 10 minutes ago.", "lat": 43.6511, "lng": -79.3470},
    {"message": "I'm having a severe allergic reaction, my throat is closing up and my face is swelling.", "lat": 43.6629, "lng": -79.3957},
    {"message": "I was in a car accident and there's heavy bleeding from a deep cut on my leg that won't stop.", "lat": 43.6205, "lng": -79.5132},
    {"message": "My child is unconscious and not responding after falling down the stairs.", "lat": 43.7000, "lng": -79.4163},
    {"message": "I suddenly can't see out of one eye and have the worst headache of my life.", "lat": 43.6890, "lng": -79.4507},
    {"message": "I'm having a seizure right now, this is the third one in an hour.", "lat": 43.7615, "lng": -79.4111},
    {"message": "I'm coughing up blood and have severe difficulty breathing that's getting worse.", "lat": 43.6435, "lng": -79.5656},
    {"message": "My baby has a fever of 40C and is limp and won't wake up.", "lat": 43.7532, "lng": -79.3832},
    {"message": "I took too much of my medication by accident and I'm feeling dizzy and confused.", "lat": 43.6677, "lng": -79.4200},
    {"message": "I have sudden severe abdominal pain and I've been vomiting blood.", "lat": 43.7042, "lng": -79.3550},
    {"message": "I burned myself badly with boiling water and the skin is blistering over a large area.", "lat": 43.6108, "lng": -79.4849},
]
