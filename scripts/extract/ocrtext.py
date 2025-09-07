#
# Text extraction using OCR
#

import easyocr
import os
from PIL import Image
import pandas as pd
from tqdm import tqdm

#from libs.settings import *
#data_folder = datapath + 'data/memesgerman/'
data_folder = 'data/memesgerman/'

#%% Define paths
input_folder = data_folder + 'images/'
output_file = data_folder + 'text/easyocr.csv'

# Get all image files in the input folder
image_files = [f for f in os.listdir(input_folder) if f.endswith(('png', 'jpg', 'jpeg'))]

#%% OCR

reader = easyocr.Reader(['de'])

ocr_results = {}
for filename in tqdm(image_files):
    if filename.lower().endswith(('.png', '.jpg', '.jpeg', '.bmp', '.gif')):
        file_path = os.path.join(input_folder, filename)
        img = Image.open(file_path)
        result = reader.readtext(img)
        extracted_text = ' '.join([text[1] for text in result])
        ocr_results[filename] = extracted_text

#%% Save to CSV
results = pd.DataFrame(list(ocr_results.items()), columns=['filename', 'text'])
results.to_csv(output_file, index=False,sep=";")

