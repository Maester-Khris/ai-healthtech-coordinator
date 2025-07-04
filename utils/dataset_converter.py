# import json
# from pathlib import Path

# OLD_FILE = "conversational_dataset.jsonl"   # ← your existing file
# NEW_FILE = "symptom_severity_new.jsonl"   # ← will be created

# def convert_record(old_rec: dict) -> dict:
#     """
#     old_rec =
#       {"messages": [
#           {"role":"user",  "contents":"…"},
#           {"role":"model", "contents":"routine"}
#       ]}
#     returns =
#       {"contents":[
#           {"role":"user","parts":[{"text":"…"}]},
#           {"role":"model","parts":[{"text":"routine"}]}
#       ]}
#     """
#     new_contents = [
#         {
#             "role": m["role"],
#             "parts": [{"text": m["contents"]}]
#         }
#         for m in old_rec["messages"]
#     ]
#     return {"contents": new_contents}

# with Path(OLD_FILE).open() as fin, Path(NEW_FILE).open("w") as fout:
#     for line in fin:
#         line = line.strip()
#         if not line:                 # skip blank lines
#             continue
#         old = json.loads(line)
#         new = convert_record(old)
#         fout.write(json.dumps(new, ensure_ascii=False) + "\n")

# print(f"Converted → {NEW_FILE}")

import json
from pathlib import Path

OLD_FILE = "conversational_dataset.jsonl"     # original file
NEW_FILE = "symptom_severity_combined.jsonl"  # new file with one record

def to_content(message):
    """Turn {"role":..., "contents":...} → {"role":..., "parts":[{"text":...}]}"""
    return {
        "role": message["role"],
        "parts": [{"text": message["contents"]}]
    }

all_contents = []

# Read every line and append its user / model parts to one big list
with Path(OLD_FILE).open() as fin:
    for raw in fin:
        raw = raw.strip()
        if not raw:
            continue
        record = json.loads(raw)
        for msg in record["messages"]:
            all_contents.append(to_content(msg))

# Write a single JSON object containing the aggregated contents array
with Path(NEW_FILE).open("w") as fout:
    json.dump({"contents": all_contents}, fout, ensure_ascii=False)
    fout.write("\n")

print(f"Created {NEW_FILE} with {len(all_contents)} dialogue turns.")
