#
# Import image collection into chroma and query it
# Embedding model: **OpenClip default**
#

# Prerequisites:
# pip install open-clip-torch
# pip install chromadb
import os

import chromadb
from chromadb.utils import embedding_functions
from chromadb.utils.data_loaders import ImageLoader

import importlib
from libs import images
importlib.reload(images)

datafolder = r"data/di-100/"
imagefolder = datafolder + "images/"

#%% Init model

# Initialize embedding function (OpenCLIP supports text + images)
embedding_func = embedding_functions.OpenCLIPEmbeddingFunction()

# Initialize persistent ChromaDB client
# Initialize ImageLoader for handling local image URIs
client = chromadb.PersistentClient(path="data/chromadb")
data_loader = ImageLoader()

try:
    client.delete_collection(name="di100-default")
except:
    pass

# Get or create collection
collection = client.get_or_create_collection(
    name="di100-default",
    embedding_function=embedding_func,
    data_loader=data_loader,
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
    uris= chroma_uris
)

#%% Query chroma

results = collection.query(
    query_texts= "Frau",
    n_results=10,
    include=["distances"]
)

# After saving, open html file in the browser to see the results
images.chromaResults2Html(results, imagefolder, datafolder + "answer_untuned.html")


