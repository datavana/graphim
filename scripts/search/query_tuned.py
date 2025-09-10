#
# Import image collection into chroma and query it
# Embedding model: **clip-di-finetuned**
#

# Prerequisites:
# pip install open-clip-torch
# pip install chromadb
import os

import chromadb
from chromadb.utils.data_loaders import ImageLoader
from chromadb import EmbeddingFunction
from chromadb.api.types import (
    Documents,
    Embeddings,
    Image,
)

from transformers import CLIPProcessor, CLIPModel

import importlib
from libs import images
importlib.reload(images)

import torch
import numpy as np
from PIL import Image

device = "cuda" if torch.cuda.is_available() else "cpu"

datafolder = r"data/di-100/"
imagefolder = datafolder + "images/"

#%% Custom embedding function

# TODO: Improve, bad style to check for image vs text
class CustomCLIPEmbeddingFunction(EmbeddingFunction):
    def __init__(self, model, processor, device="cpu"):
        self.model = model.to(device)
        self.processor = processor
        self.device = device

    def __call__(self, inputs: Documents) -> Embeddings:
        embeddings = []
        batch_size = 16
        for i in range(0, len(inputs), batch_size):
            batch = inputs[i:i+batch_size]

            if all(os.path.exists(x) for x in batch):
                # image mode
                images = [Image.open(p).convert("RGB") for p in batch]
                encodings = self.processor(images=images, return_tensors="pt")
                with torch.no_grad():
                    feats = self.model.get_image_features(encodings["pixel_values"].to(self.device))
            else:
                # text mode
                encodings = self.processor(text=batch, return_tensors="pt", padding=True, truncation=True)
                with torch.no_grad():
                    feats = self.model.get_text_features(
                        input_ids=encodings["input_ids"].to(self.device),
                        attention_mask=encodings["attention_mask"].to(self.device)
                    )

            feats = feats / feats.norm(dim=-1, keepdim=True)
            embeddings.extend(feats.cpu().tolist())

        return embeddings


#%% Load model for embeddings

model_path = "models/clip-di-finetuned"
processor = CLIPProcessor.from_pretrained(model_path)
model = CLIPModel.from_pretrained(model_path)
model.eval()

embedding_func = CustomCLIPEmbeddingFunction(model, processor, device=device)

#%%

# Initialize persistent ChromaDB client
# Initialize ImageLoader for handling local image URIs
client = chromadb.PersistentClient(path="data/chromadb")
#data_loader = ImageLoader()

try:
    client.delete_collection(name="di100-finetuned")
except:
    pass

# Get or create collection
collection = client.create_collection(
    name="di100-finetuned",
    embedding_function=embedding_func,
    #data_loader=data_loader,
    metadata={"hnsw:space": "cosine"}
)

#%% Add to chroma

# You just need to add the absolute image paths as uris.
# Then. the ImageLoader and the embedding function produce the embeddings
image_files = [f for f in os.listdir(imagefolder) if f.endswith(".jpg")]
chroma_ids = ["file:" + x for x in image_files]
chroma_uris = [os.path.join(imagefolder, x) for x in image_files]

collection.add(
    ids = chroma_ids,
    documents= chroma_uris
)

#%% Query chroma

results = collection.query(
    query_texts= "Glocke",
    n_results=10,
    include=["distances"]
)

# After saving, open answer.html in the browser to see the results
images.chromaResults2Html(results, imagefolder, datafolder + "answer_tuned.html")



