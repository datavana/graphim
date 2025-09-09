import base64
import json
import requests
import os
from pathlib import Path
from PIL import Image
from transformers.models.llama4.modeling_llama4 import vision_apply_rotary_emb


#%% lib
def vision_loop(image_path,  token=None, api_key=None, service_account_key_path=None, limit=5):

    # Authenticate and set the URL and headers
    # if api_key:
    #     url = f"https://vision.googleapis.com/v1/images:annotate?key={api_key}"
    #     headers = {"Content-Type": "application/json"}
    # elif service_account_key_path:
    #     # Generate an OAuth2 token using the service account key
    #     from google.oauth2 import service_account
    #     credentials = service_account.Credentials.from_service_account_file(service_account_key_path)
    #     token = credentials.token
    #     url = "https://vision.googleapis.com/v1/images:annotate"
    #     headers = {
    #         "Content-Type": "application/json",
    #         "Authorization": f"Bearer {token}",
    #     }
    # else:
    #     raise ValueError("Either api_key or service_account_key_path must be provided.")

    url = "https://vision.googleapis.com/v1/images:annotate"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}",
    }

    # loop over files in image_path
    counter = 0
    for image in Path(image_path).iterdir():
        counter += 1
        if counter > limit:
            break
        if image.is_file():
            # Scale pictures down to 200px x 200px
            full_name = os.path.join(image_path, image.name)
            vision_result = detect_web_info(full_name, url, headers)
            # vision_result.save(os.path.join(str(Path(image_path).parent), "small", image.name))
            if "responses" not in vision_result or not vision_result["responses"]:
                print("Error with image " + image.name)
                continue

        with open(os.path.join(str(Path(image_path).parent),
                               "vision_results",
                               os.path.splitext(image.name)[0] + '.json')) as json_file:
            json_file.write(vision_result)



def detect_web_info(image_file, url, headers):
    max_size = 224
    # Read, resize, and encode the image
    with Image.open(image_file, "r") as image:
        img_width, img_height = image.size
        scale = min(max_size / img_width, max_size / img_height)
        resized_image = image.resize((int(img_width * scale), int(img_height * scale)), Image.LANCZOS)
        encoded_image = base64.b64encode(resized_image.tobytes()).decode("utf-8")


    # Construct the request body for WEB_DETECTION
    request_body = {
        "requests": [
            {
                "image": {
                    "content": encoded_image,
                },
                "features": [
                    {
                        "type": "WEB_DETECTION",
                        "maxResults": 10,  # Optional: limit the number of results
                    }
                ],
            }
        ]
    }

    # Send the POST request
    response = requests.post(url, headers=headers, data=json.dumps(request_body))
    response.raise_for_status()

    result = response.json()
    return result


def examine_result(result):
    web_detection = result["responses"][0].get("webDetection", {})
    # Print Web Entities
    print("\n=== Web Entities ===")
    for entity in web_detection.get("webEntities", []):
        print(f"Description: {entity['description']}")
        print(f"Score: {entity['score']:.2f}")
        print(f"Entity ID: {entity['entityId']}")
        print("---")

    # Print Visually Similar Images
    print("\n=== Visually Similar Images ===")
    for image in web_detection.get("visuallySimilarImages", []):
        print(f"URL: {image['url']}")
        print("---")

    # Print Pages with Matching Images
    print("\n=== Pages with Matching Images ===")
    for page in web_detection.get("pagesWithMatchingImages", []):
        print(f"URL: {page['url']}")
        print("---")

    # Print Best Guess Labels
    print("\n=== Best Guess Labels ===")
    for label in web_detection.get("bestGuessLabels", []):
        print(f"Label: {label['label']}")
        print(f"Language: {label['languageCode']}")
        print("---")

#%% run 2029-09-09
token = ""
vision_loop("./data/di-100", token="0", limit=5)

