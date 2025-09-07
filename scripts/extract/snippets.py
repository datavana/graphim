#
# Extract image components using FastSAM
#

# Install Fastsam
# pip install git+https://github.com/CASIA-IVA-Lab/FastSAM.git
# pip install ultralytics==8.0.120
# pip install yolov5

#!! Mind a requirements.txt in FASTsam repo (see requirements.fastsam.txt)
# Might conflict with other package versions in this repo.!!

#%%
import os
#from yolov5 import YOLOv5
import ultralytics
from fastsam import FastSAM
import torch
import cv2
import numpy as np

from scipy.sparse.csgraph import connected_components

#from libs.settings import *
# data_folder = datapath + 'data/memesgerman/'
data_folder = 'data/memesgerman/'

#%% Define paths
input_folder = data_folder + 'images/'
output_folder = data_folder + 'snippets/'

# Get all image files in the input folder
image_files = [f for f in os.listdir(input_folder) if f.endswith(('png', 'jpg', 'jpeg'))]

#%%

# Load model weights
# Download from https://github.com/CASIA-IVA-Lab/FastSAM?tab=readme-ov-file#model-checkpoints
# Due to an update in the weights_only default of pytorch, we need to add a bunch of safe globals
# when using up to date torch and torchvision
# See https://github.com/CASIA-IVA-Lab/FastSAM/issues/271
torch.serialization.add_safe_globals([ultralytics.nn.tasks.SegmentationModel])
torch.serialization.add_safe_globals([torch.nn.modules.container.Sequential])
torch.serialization.add_safe_globals([ultralytics.nn.modules.conv.Conv])
torch.serialization.add_safe_globals([torch.nn.modules.conv.Conv2d])
torch.serialization.add_safe_globals([torch.nn.modules.batchnorm.BatchNorm2d])
torch.serialization.add_safe_globals([torch.nn.modules.activation.SiLU])
torch.serialization.add_safe_globals([ultralytics.nn.modules.block.C2f])
torch.serialization.add_safe_globals([torch.nn.modules.container.ModuleList])
torch.serialization.add_safe_globals([ultralytics.nn.modules.block.Bottleneck])
torch.serialization.add_safe_globals([ultralytics.nn.modules.block.SPPF])
torch.serialization.add_safe_globals([torch.nn.modules.pooling.MaxPool2d])
torch.serialization.add_safe_globals([torch.nn.modules.upsampling.Upsample])
torch.serialization.add_safe_globals([ultralytics.nn.modules.conv.Concat])
torch.serialization.add_safe_globals([ultralytics.nn.modules.head.Segment])
torch.serialization.add_safe_globals([ultralytics.nn.modules.block.DFL])
torch.serialization.add_safe_globals([ultralytics.nn.modules.block.Proto])
torch.serialization.add_safe_globals([torch.nn.modules.conv.ConvTranspose2d])
torch.serialization.add_safe_globals([getattr])
torch.serialization.add_safe_globals([ultralytics.nn.modules.head.Detect])
torch.serialization.add_safe_globals([ultralytics.yolo.utils.IterableSimpleNamespace])

model = FastSAM('weights/FastSAM.pt', verbose=False)

#%% Helpers

def bbox(mask):
    x, y, w, h = cv2.boundingRect(mask)
    return (x, y, x + w, y + h)

def box_contains_ratio(box_big, box_small, min_ratio=0.8):
    # Check area overlap ratio of bounding boxes as rough filter
    x1_min, y1_min, x1_max, y1_max = box_big
    x2_min, y2_min, x2_max, y2_max = box_small

    xi_min = max(x1_min, x2_min)
    yi_min = max(y1_min, y2_min)
    xi_max = min(x1_max, x2_max)
    yi_max = min(y1_max, y2_max)

    if xi_min >= xi_max or yi_min >= yi_max:
        return False

    inter_area = (xi_max - xi_min) * (yi_max - yi_min)
    small_area = (x2_max - x2_min) * (y2_max - y2_min)
    return (inter_area / small_area) >= min_ratio

def mergeMasks(masks, threshold = 0.9):
    # Convert list of masks to numpy array if needed
    if isinstance(masks, list):
        masks = np.stack(masks, axis=0)

    masks_bin = (masks > 0.5).astype(np.uint8)

    boxes = [bbox(m) for m in masks_bin]

    # Build adjacency matrix for "mostly contained" relation
    N = masks_bin.shape[0]
    adjacency = np.zeros((N, N), dtype=bool)

    for i in range(N):
        area_i = masks_bin[i].sum()
        if area_i == 0:
            continue
        box_i = boxes[i]
        for j in range(N):
            if i == j:
                continue

            box_j = boxes[j]
            # Quick bbox filter: is bbox i mostly inside bbox j? Skip otherwise
            if not box_contains_ratio(box_j, box_i, min_ratio=0.8):
                continue

            # Compute pixel overlap and ratio
            intersection = (masks_bin[i] & masks_bin[j]).sum()
            ratio = intersection / area_i

            if ratio >= threshold:
                adjacency[i, j] = True

    # Symmetrize adjacency for undirected connected groups
    undirected_adj = adjacency | adjacency.T

    # Find connected components
    n_components, labels = connected_components(csgraph=undirected_adj, directed=False, return_labels=True)

    # Merge masks in each group
    merged_masks = []
    for comp_id in range(n_components):
        indices = np.where(labels == comp_id)[0]
        merged = np.clip(masks_bin[indices].sum(axis=0), 0, 1).astype(np.uint8)
        merged_masks.append(merged)

    return merged_masks

def createTransparentSegment(image_rgb, mask, blur_kernel_size=0, blur_sigma=0):
    """
    Create RGBA image with smooth alpha channel from mask.
    :param image_rgb: (H, W, 3) RGB uint8 image
    :param mask: (H, W) binary mask uint8 (0 or 255)
    :param blur_kernel_size: kernel size for Gaussian blur (odd, e.g., 15)
    :param blur_sigma: Gaussian blur sigma; 0 = auto
    :return: (H, W, 4) RGBA image with fuzzy alpha
   """
    mask = (mask > 0).astype(np.uint8) * 255

    # Convert RGB to BGRA
    bgra = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2BGRA)

    # Blur mask for fuzzy edges
    if blur_kernel_size > 0:
        mask = cv2.GaussianBlur(mask, (blur_kernel_size, blur_kernel_size), blur_sigma)
        mask = np.clip(mask, 0, 255).astype(np.uint8)

    # Set alpha channel from mask
    bgra[:, :, 3] = mask

    rgba = cv2.cvtColor(bgra, cv2.COLOR_BGRA2RGBA)
    return rgba

def cropTransparentSegment(image_rgba):
    """
    Crop transparent RGBA image to bounding box of non-transparent pixels.
    :param bgra: (H, W, 4) BGRA image with alpha channel
    :return: cropped BGRA image
    """

    bgra = cv2.cvtColor(image_rgba, cv2.COLOR_RGB2BGRA)
    alpha = bgra[:, :, 3]

    coords = cv2.findNonZero(alpha)
    if coords is None:
        # No non-transparent pixels – return empty image or original
        return bgra

    x, y, w, h = cv2.boundingRect(coords)
    cropped = bgra[y:y+h, x:x+w]
    cropped = cv2.cvtColor(cropped, cv2.COLOR_BGRA2RGBA)
    return cropped



#%% Process images

from tqdm import tqdm

device = "cuda" if torch.cuda.is_available() else "cpu"
for image_file in tqdm(image_files):
    image_path = os.path.join(input_folder, image_file)

    everything = model(image_path, device=device, retina_masks=True, imgsz=1024, conf=0.4, iou=0.9)
    masks = everything[0].masks.data.cpu().numpy()  # (num_masks, H, W)
    masks = mergeMasks(masks, 0.6)

    image = cv2.imread(image_path)
    image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

    for i, mask in enumerate(masks):
        segment = createTransparentSegment(image_rgb, mask)
        segment = cropTransparentSegment(segment)

        segment_folder = os.path.join(output_folder, image_file)
        os.makedirs(segment_folder, exist_ok=True)
        filename = os.path.join(segment_folder, f'segment_{i}.png')
        cv2.imwrite(filename, cv2.cvtColor(segment, cv2.COLOR_RGBA2BGRA))

    #break
