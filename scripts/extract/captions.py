#
# Example for caption generation
#

import os
from tqdm import tqdm
import pandas as pd
from transformers import BlipProcessor, BlipForConditionalGeneration
from PIL import Image

data_folder = 'data/memesgerman/'

#%% Define paths
input_folder = data_folder + 'images/'
output_file = data_folder + 'text/blipcaptions.csv'

# Get all image files in the input folder
image_files = [f for f in os.listdir(input_folder) if f.endswith(('png', 'jpg', 'jpeg'))]

#%% Load the processor and model
processor = BlipProcessor.from_pretrained("Salesforce/blip-image-captioning-base")
model = BlipForConditionalGeneration.from_pretrained("Salesforce/blip-image-captioning-base")

#%% Generate captions

# Process each image in the directory
captions = {}
for filename in tqdm(image_files):
    if filename.lower().endswith(('.png', '.jpg', '.jpeg', '.bmp', '.gif')):
        file_path = os.path.join(input_folder, filename)
        img = Image.open(file_path).convert('RGB')

        inputs = processor(images=img, return_tensors="pt")
        out = model.generate(**inputs)

        caption = processor.decode(out[0], skip_special_tokens=True)
        captions[filename] = caption

#%% Save to CSV
results = pd.DataFrame(list(captions.items()), columns=['filename', 'text'])
results.to_csv(output_file, index=False,sep=";")

