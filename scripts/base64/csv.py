#%%
# Add base64 encoded images as data URLS to a csv file

import pandas as pd
import os
import base64
from PIL import Image
from io import BytesIO
from tqdm import tqdm
tqdm.pandas()

#%% Load files

images_folder = "data/georgefloyd/images"

df = pd.read_csv("data/georgefloyd/blacktuesday.csv")
df['filename'] = df['imgUrl'].str.split('/').str[-1].str.split('?').str[0]

#%% Helpers

def image_to_data_url(filename, size=(100, 100)):
    if pd.isna(filename):
        return None

    image_path = os.path.join(images_folder, filename)
    if not os.path.isfile(image_path):
        return None

    try:
        img = Image.open(image_path)
        img = img.resize(size, Image.Resampling.LANCZOS)
        buffered = BytesIO()
        img.save(buffered, format="JPEG")
        img_bytes = buffered.getvalue()
        base64_str = base64.b64encode(img_bytes).decode("utf-8")
        data_url = f"data:image/jpeg;base64,{base64_str}"
        return data_url
    except Exception as e:
        print(f"Error processing image {image_path}: {e}")
        return None

#%% Convert

df['imgdata'] = df['filename'].progress_apply(image_to_data_url)