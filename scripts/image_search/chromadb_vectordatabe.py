#%%
#  CELL 1: CONFIGURATION — Edit here and run with Ctrl+Enter
# -----------------------------------------------------------

UPLOAD_FOLDER = r"C:\Users\lumor\Downloads\images"  # <-- EDIT ME

# Choose query mode: "text", "image", or "multimodal" (text + image together)
QUERY_MODE = "text"  # <-- EDIT ME: "text", "image", or "multimodal"

# If QUERY_MODE == "text" or "multimodal"
TEXT_QUERY = "a woman"  # <-- EDIT ME

# If QUERY_MODE == "image" or "multimodal"
IMAGE_QUERY_PATH = r"C:\Users\lumor\Downloads\images\f8e4bb0d520c0c5bafa8f385f416828f71bc09c5.jpg"  # <-- EDIT ME

# Number of results
TOP_K = 5  # <-- EDIT ME

print("Configuration loaded.")

#%%
#  CELL 2: SETUP — Initialize ChromaDB and embedding function
# -----------------------------------------------------------

import os
from PIL import Image
import chromadb
from chromadb.utils import embedding_functions
from chromadb.utils.data_loaders import ImageLoader

# Initialize embedding function (OpenCLIP supports text + images)
embedding_func = embedding_functions.OpenCLIPEmbeddingFunction()

# Initialize persistent ChromaDB client
client = chromadb.PersistentClient(path="./chroma_db")

# Initialize ImageLoader for handling local image URIs
data_loader = ImageLoader()

# Get or create collection
collection = client.get_or_create_collection(
    name="image_search",
    embedding_function=embedding_func,
    data_loader=data_loader,
    metadata={"hnsw:space": "cosine"}  # cosine similarity
)

print("ChromaDB initialized with multimodal support.")

#%%
#  CELL 3: UPLOAD IMAGES — Index all images in UPLOAD_FOLDER
# -----------------------------------------------------------

def is_image_file(filename):
    """Check if file is an image based on extension."""
    extensions = {'.jpg', '.jpeg', '.png', '.bmp', '.gif'}
    return any(filename.lower().endswith(ext) for ext in extensions)

def add_images_from_folder(folder_path):
    """Add all images in folder to ChromaDB collection using URIs."""
    if not os.path.isdir(folder_path):
        print(f"Error: folder '{folder_path}' does not exist.")
        return

    image_files = [f for f in os.listdir(folder_path) if is_image_file(f)]
    if not image_files:
        print("No images found in folder.")
        return

    ids = []
    uris = []
    metadatas = []

    for img_file in image_files:
        img_path = os.path.join(folder_path, img_file)
        try:
            with Image.open(img_path) as img:
                img.verify()  # Verify image integrity
            ids.append(img_file)
            uris.append(img_path)
            metadatas.append({"filename": img_file, "path": img_path})
            print(f"Queued: {img_file}")
        except Exception as e:
            print(f"Failed to process {img_file}: {e}")

    if uris:
        collection.add(
            ids=ids,
            uris=uris,        # Use URIs for multimodal indexing
            metadatas=metadatas
        )
        print(f"Added {len(uris)} images to collection.")

# Run upload
if UPLOAD_FOLDER:
    print(f"Uploading/indexing images from: {UPLOAD_FOLDER}")
    add_images_from_folder(UPLOAD_FOLDER)
else:
    print("UPLOAD_FOLDER not set — skipping upload.")

#%%
#  CELL 4: MULTIMODAL QUERY — Unified text + image search
# ---------------------------------------------------------

def multimodal_query(text_query=None, image_query_path=None, top_k=5):
    """
    Perform multimodal search: text, image, or both.
    """
    query_texts = [text_query] if text_query else None
    query_uris = [image_query_path] if image_query_path else None

    if not query_texts and not query_uris:
        print("No query provided.")
        return None

    print("\nMultimodal Query:")
    if text_query:
        print(f"   Text: '{text_query}'")
    if image_query_path:
        print(f"   Image: '{image_query_path}'")

    results = collection.query(
        query_texts=query_texts,
        query_uris=query_uris,
        n_results=top_k,
        include=["metadatas", "distances"]
    )
    return results

def display_results(results, top_k):
    """Display search results in a clean format."""
    if not results or not results["metadatas"][0]:
        print("No results found.")
        return

    print(f"\nTop {min(top_k, len(results['metadatas'][0]))} Results:")
    print("-" * 60)
    for i, (meta, dist) in enumerate(zip(results["metadatas"][0], results["distances"][0])):
        print(f"{i+1:2d}. {meta['filename']:<40} (distance: {dist:.4f})")

# --- Run query based on mode ---
if QUERY_MODE == "text":
    if TEXT_QUERY:
        results = multimodal_query(text_query=TEXT_QUERY, top_k=TOP_K)
        display_results(results, TOP_K)
    else:
        print("TEXT_QUERY is empty — skipping text search.")

elif QUERY_MODE == "image":
    if IMAGE_QUERY_PATH:
        results = multimodal_query(image_query_path=IMAGE_QUERY_PATH, top_k=TOP_K)
        display_results(results, TOP_K)
    else:
        print("IMAGE_QUERY_PATH is not set — skipping image search.")

elif QUERY_MODE == "multimodal":
    if TEXT_QUERY and IMAGE_QUERY_PATH:
        results = multimodal_query(text_query=TEXT_QUERY, image_query_path=IMAGE_QUERY_PATH, top_k=TOP_K)
        display_results(results, TOP_K)
    else:
        print("Both TEXT_QUERY and IMAGE_QUERY_PATH must be set for multimodal search.")

else:
    print(f"Unknown QUERY_MODE: {QUERY_MODE}")

#%%
#  CELL 5: VISUALIZE RESULTS — Show top-K images interactively
# --------------------------------------------------------------

import matplotlib.pyplot as plt
import matplotlib.image as mpimg

def visualize_results(results, top_k=5, query_label="Query"):
    """
    Display the top-K results as images in a grid.
    Shows filename and distance as title for each image.
    """
    if not results or not results["metadatas"][0]:
        print("No results to visualize.")
        return

    metadatas = results["metadatas"][0]
    distances = results["distances"][0]
    n = min(top_k, len(metadatas))

    # Create subplot grid (1 row, n columns)
    fig, axes = plt.subplots(1, n, figsize=(4 * n, 5))
    if n == 1:
        axes = [axes]  # Make it iterable

    fig.suptitle(f"Top {n} Results for '{query_label}'", fontsize=16, weight='bold')

    for i in range(n):
        img_path = metadatas[i]["path"]
        filename = metadatas[i]["filename"]
        dist = distances[i]

        try:
            img = mpimg.imread(img_path)
            axes[i].imshow(img)
            axes[i].set_title(f"{filename}\n(dist: {dist:.4f})", fontsize=10)
            axes[i].axis('off')
        except Exception as e:
            axes[i].text(0.5, 0.5, f"Error loading\n{filename}", ha='center', va='center')
            axes[i].axis('off')
            print(f"Could not load image {img_path}: {e}")

    plt.tight_layout()
    plt.show()

# --- Auto-detect which query was run and visualize ---

if QUERY_MODE == "text" and TEXT_QUERY:
    results = multimodal_query(text_query=TEXT_QUERY, top_k=TOP_K)
    visualize_results(results, TOP_K, query_label=TEXT_QUERY)

elif QUERY_MODE == "image" and IMAGE_QUERY_PATH:
    results = multimodal_query(image_query_path=IMAGE_QUERY_PATH, top_k=TOP_K)
    visualize_results(results, TOP_K, query_label=os.path.basename(IMAGE_QUERY_PATH))

    # Optional: Show the query image above results
    try:
        plt.figure(figsize=(4, 4))
        query_img = mpimg.imread(IMAGE_QUERY_PATH)
        plt.imshow(query_img)
        plt.title(f"Query Image: {os.path.basename(IMAGE_QUERY_PATH)}", weight='bold')
        plt.axis('off')
        plt.show()
    except Exception as e:
        print(f"Could not display query image: {e}")

elif QUERY_MODE == "multimodal" and TEXT_QUERY and IMAGE_QUERY_PATH:
    results = multimodal_query(text_query=TEXT_QUERY, image_query_path=IMAGE_QUERY_PATH, top_k=TOP_K)
    label = f"Text: '{TEXT_QUERY}' + Image: '{os.path.basename(IMAGE_QUERY_PATH)}'"
    visualize_results(results, TOP_K, query_label=label)

    # Also show query image
    try:
        plt.figure(figsize=(4, 4))
        query_img = mpimg.imread(IMAGE_QUERY_PATH)
        plt.imshow(query_img)
        plt.title(f"Query Image for Multimodal Search", weight='bold')
        plt.axis('off')
        plt.show()
    except Exception as e:
        print(f"Could not display query image: {e}")

else:
    print("No query executed — nothing to visualize.")

#%%
#  CELL 6: CLEAR COLLECTION — So we re-embed with better model
# --------------------------------------------------------------

try:
    collection.delete(where={})  # Clear all documents
    print("Collection cleared. Ready for re-embedding.")
except Exception as e:
    print(f"Could not clear collection: {e}")
    print("You may need to delete and recreate collection manually.")
