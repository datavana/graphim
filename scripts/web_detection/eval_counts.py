import os, json
import pandas as pd
from settings import path_data

#%%
input_path = f"{path_data}/data/di/vision_results"
output_path =f"{path_data}/data/di"

#%%
records = []

for filename in os.listdir(input_path):
    if filename.endswith(".json"):
        with open(os.path.join(input_path, filename), encoding="utf-8") as f:
            data = json.load(f)

        for resp in data.get("responses", []):
            for e in resp.get("webDetection", {}).get("webEntities", []):
                if e.get("description"):
                    records.append({
                        "filename": filename,
                        "entityId": e.get("entityId"),
                        "score": e.get("score"),
                        "description": e["description"]

                    })

df = pd.DataFrame(records)

df.to_csv(os.path.join(output_path, "all_entity_scores.csv"),
                      index=False, encoding="utf-8")


#%% Counts nach entityId + Description
counts = df.dropna(subset=["entityId"]).groupby(
    ["entityId", "description"]
).agg(
    count=("entityId", "count"),
    filenames=("filename", lambda x: ";".join(sorted(x)))
).reset_index()

counts.to_csv(os.path.join(output_path, "pentity_counts.csv"),
                      index=False, encoding="utf-8")

