#
# Convert Images to Textual Descriptions (captions)
#

## Using BLIP-2
# https://github.com/salesforce/LAVIS/blob/main/examples/blip_image_captioning.ipynb
# pip install salesforce-lavis

import os
from PIL import Image
import pandas as pd
from tqdm import tqdm
import torch
from lavis.models import load_model_and_preprocess

#from libs.settings import *
#data_folder = path + 'data/memesgerman/'
data_folder = 'data/memesgerman/'

#%% Define paths
input_folder = data_folder + 'images/'
output_file = data_folder + 'text/lavis-descriptions.csv'

# Get all image files in the input folder
image_files = [f for f in os.listdir(input_folder) if f.endswith(('png', 'jpg', 'jpeg'))]

# %%

# Load BLIP model
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model, vis_processors, _ = load_model_and_preprocess(
    name="blip_caption", model_type="large_coco", is_eval=True, device=device
)

# Process each image in the directory
captions = {}
for filename in tqdm(image_files):
    if filename.lower().endswith(('.png', '.jpg', '.jpeg', '.bmp', '.gif')):
        file_path = os.path.join(input_folder, filename)
        img = Image.open(file_path).convert('RGB')

        # Process image with the model
        image_tensor = vis_processors["eval"](img).unsqueeze(0).to(device)
        result = model.generate({"image": image_tensor})

        # Convert result to a single caption string (assuming the first caption is the desired one)
        caption = result[0] if isinstance(result, list) else result
        captions[filename] = caption

#%% Save to CSV
results = pd.DataFrame(list(captions.items()), columns=['filename', 'text'])
results.to_csv(output_file, index=False,sep=";")


