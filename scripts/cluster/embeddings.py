#
# Cluster images by embedding similarity
# 
# The script follows the approch used in [The evolution of political memes: Detecting and characterizing internet memes with multi-modal deep learning](https://www.sciencedirect.com/science/article/pii/S0306457319307988?casa_token=cWOC3lAL0doAAAAA:0E1Kfggg2MeWF9iOj9RBT56bfeP88bddkdMzI6u7LilF9CCh60oKAZ72d-AFdTo4Ia4wHYv1EjEf). 
# 
# 1. Feature extraction using google/vit-base-patch16-224
# 2. Calculate Euclidian distance 
# 3. Construct graph based on radius 
# 
# Model information; https://huggingface.co/google/vit-base-patch16-224

#%% Imports
import os
import torch

from transformers import AutoImageProcessor, AutoModel
from PIL import Image

from libs.networks import *

#from libs.settings import *
data_folder = 'data/memesgerman/'
imagefolder = data_folder + "images/"
outputfolder = data_folder + "embeddings/"


#%% Helpers

def load_images(folder_path, processor, model):
    """Load and preprocess all images in a folder."""

    tensors = []
    images = []
    filenames = []
    features = []

    for filename in os.listdir(folder_path):
        if filename.endswith((".png", ".jpg", ".jpeg")):
            filenames.append(filename)

            image_path = os.path.join(folder_path, filename)
            image = Image.open(image_path).convert("RGB")
            image.thumbnail((100, 100), Image.Resampling.LANCZOS)  # Resize images for visualization
            images.append(image)

            inputs = processor(images=image, return_tensors="pt")
            tensor = inputs.to(DEVICE)
            tensors.append(tensor)

            with torch.no_grad():
                outputs = model(**tensor)
                features.append(outputs.last_hidden_state[:, 0, :])  # Class token

    return filenames, images, tensors, features


#%% Load model

DEVICE = 'cuda' if torch.cuda.is_available() else 'cpu'
processor = AutoImageProcessor.from_pretrained("google/vit-base-patch16-224")
model = AutoModel.from_pretrained("google/vit-base-patch16-224").to(DEVICE)


#%% Process images

filenames, images, tensors, features = load_images(imagefolder, processor, model)

#%% Calculate a pairwise Euclidean distance matrix

features = torch.cat(features)
distmatrix = torch.cdist(features, features, p=2)

#%% Save using helper functions in libs/networks.py

edgelist = get_edges(distmatrix, 20, filenames)
edgelist.to_csv(outputfolder + 'edges.csv', index=False)

nodeslist = get_nodes(filenames, images)
nodeslist.to_csv(outputfolder + 'nodes.csv', index=False)

create_gexf(edgelist, nodeslist, outputfolder + 'embeddings.gexf')