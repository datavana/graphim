#
# Finetune CLIP
#

#pip install torch torchvision transformers datasets chromadb

import os
from PIL import Image
import pandas as pd
from tqdm import tqdm

from datasets import Dataset
from transformers import CLIPProcessor, CLIPModel

import torch
from torch.utils.data import DataLoader
from torch.nn import CosineSimilarity, CrossEntropyLoss

device = "cuda" if torch.cuda.is_available() else "cpu"

datafolder = r"data/di-100/"
imagefolder = datafolder + "images/"
textcsv = datafolder + "di100-img-txt.csv"

#%% Load data frame

df = pd.read_csv(textcsv, sep=";")
df = df.dropna(subset=["description","images"])

df["imagepath"] = df["images"].apply(lambda x: os.path.join(imagefolder, x))


#%% Load model

# TODO: Check, supports German
model_name = "openai/clip-vit-base-patch32"
model = CLIPModel.from_pretrained(model_name)
processor = CLIPProcessor.from_pretrained(model_name)

#%% Chunk text

chunked = []

for _, row in df.iterrows():

    # Split long text into smaller chunks that fit CLIP’s max token limit.
    text = row["description"]
    max_tokens = processor.tokenizer.model_max_length - 3
    token_ids = processor.tokenizer.encode(text, add_special_tokens=False)
    chunks = []
    for i in range(0, len(token_ids), max_tokens):
        chunk_ids = token_ids[i:i + max_tokens]
        chunk_text = processor.tokenizer.decode(chunk_ids, clean_up_tokenization_spaces=True)
        chunks.append(chunk_text)

    # Check valid length
    valid = []
    for c in chunks:
        tokenlength = len(processor.tokenizer.encode(str(c), add_special_tokens=True))
        if 0 < tokenlength <= processor.tokenizer.model_max_length:
            valid.append({"imagepath": row["imagepath"], "text": c})

    chunked.extend(valid)

dataset = Dataset.from_list(chunked)

#%%
def collate_fn(batch):
    images = [Image.open(item["imagepath"]).convert("RGB") for item in batch]
    texts  = [item["text"] for item in batch]

    encodings = processor(
        text=texts,
        images=images,
        padding=True,
        truncation=True,
        return_tensors="pt"
    )
    return {
        "input_ids": encodings["input_ids"],
        "attention_mask": encodings["attention_mask"],
        "pixel_values": encodings["pixel_values"]
    }

train_loader = DataLoader(
    dataset,
    batch_size=16,
    shuffle=True,
    collate_fn=collate_fn
)

optimizer = torch.optim.AdamW(model.parameters(), lr=5e-6)
model.to(device)

#%% Some checks

batch = next(iter(train_loader))
print(batch["input_ids"].shape) # (batch_size, seq_len)
print(batch["pixel_values"].shape)  # (batch_size, 3, H, W)

batch = {k: v.to(device) for k, v in batch.items()}

outputs = model(**batch)
print("Batch keys:", batch.keys())
print("Output keys:", outputs.keys())
print("Loss:", outputs.loss)

#%% Train

model.train()

for epoch in range(3):
    loop = tqdm(train_loader)
    for batch in loop:
        batch = {k: v.to(device) for k,v in batch.items()}

        # Get features
        image_features = model.get_image_features(batch["pixel_values"])
        text_features  = model.get_text_features(batch["input_ids"], attention_mask=batch["attention_mask"])

        # Normalize
        image_features = image_features / image_features.norm(dim=-1, keepdim=True)
        text_features  = text_features / text_features.norm(dim=-1, keepdim=True)

        # Compute similarity
        logits = image_features @ text_features.T  # (batch_size, batch_size)

        # Targets
        targets = torch.arange(len(logits), device=device)

        # Cross-entropy loss
        # We need to use a custom loss computations because
        # by chunking we can have identical images with different texts.
        # That would render contrastive learning impossible.
        loss_img = CrossEntropyLoss()(logits, targets)
        loss_txt = CrossEntropyLoss()(logits.T, targets)
        loss = (loss_img + loss_txt)/2

        optimizer.zero_grad()
        loss.backward()
        optimizer.step()

        loop.set_postfix(loss=loss.item())

#%%

model.save_pretrained("models/clip-di-finetuned")
processor.save_pretrained("models/clip-di-finetuned")
