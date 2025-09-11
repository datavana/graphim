import base64
import json
import requests
import os
import io
import csv
from pathlib import Path
from PIL import Image
from google.oauth2 import service_account
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow


#%% lib

# Scope für Cloud Vision API
SCOPES = ['https://www.googleapis.com/auth/cloud-vision']

def authenticate(service_accout_path):
    flow = InstalledAppFlow.from_client_secrets_file(
        service_accout_path,  # Pfad zu deiner OAuth 2.0 Client-ID JSON-Datei
        SCOPES
    )
    credentials = flow.run_local_server(port=0)
    return credentials



def vision_loop(image_path,  token=None, api_key=None, service_account_key_path=None, limit=5):
    print(service_account_key_path)
    # Authenticate and set the URL and headers
    if api_key:
        url = f"https://vision.googleapis.com/v1/images:annotate?key={api_key}"
        headers = {"Content-Type": "application/json"}
    elif service_account_key_path:
        # Generate an OAuth2 token using the service account key
        credentials = service_account.Credentials.from_service_account_file(service_account_key_path)
        token = credentials.token
        url = "https://vision.googleapis.com/v1/images:annotate"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}",
        }
        print("token from service account: ", token)
    elif token:
        url = "https://vision.googleapis.com/v1/images:annotate"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}",
        }
    else:
        raise ValueError("Either api_key or service_account_key_path must be provided.")


    # loop over files in image_path
    counter = 0
    for image in Path(image_path).iterdir():
        counter += 1
        if counter > limit:
            break
        if image.is_file():
            full_name = os.path.join(image_path, image.name)
            vision_result = detect_web_info(full_name, url, headers)
            # vision_result.save(os.path.join(str(Path(image_path).parent), "small", image.name))
            if "responses" not in vision_result or not vision_result["responses"]:
                print("Error with image " + image.name)
                continue

        with open(os.path.join(str(Path(image_path).parent),
                               "vision_results",
                               os.path.splitext(image.name)[0] + '.json'), "w") as json_file:
            json_file.write(json.dumps(vision_result))

        # with open(os.path.join(str(Path(image_path).parent),
        #                        "encoded",
        #                        os.path.splitext(image.name)[0] + '.b64'), "w") as f:
        #     f.write(vision_result)

def detect_web_info(image_file, url, headers):
    max_size = 800
    # Read, resize, and encode the image
    with Image.open(image_file, "r") as image:
        encoded_image = resize_and_encode_image(image, max_size)

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

def resize_and_encode_image(image, max_size):

    # resize image
    img_width, img_height = image.size
    scale = min(max_size / img_width, max_size / img_height)
    resized_image = image.resize((int(img_width * scale), int(img_height * scale)), Image.LANCZOS)

    # encode image
    buffered = io.BytesIO()
    resized_image.save(buffered, format="JPEG")
    img_bytes = buffered.getvalue()
    encoded_image = base64.b64encode(img_bytes).decode("utf-8")

    return encoded_image

def add_base64encoding_to_csv(input_csvfile, column_with_image_filenames, path_to_image_folder, output_csvfile):

    # additionally: adds two new columns for labels (column with whitespaces for image_id_label and duplicate column of objecttype)

    # Step 1: Read the original CSV into memory
    with open(input_csvfile, mode='r') as infile:
        reader = csv.DictReader(infile)
        rows = list(reader)
        fieldnames = reader.fieldnames + ["image_base64", "image_id_label", "objecttype_label"]
        print(fieldnames)

    # Step 2: Process each row and add base64-encoded image
    max_size = 200
    for row in rows:
        filename = row.get(column_with_image_filenames)
        row["objecttype_label"] = row.get("objecttype")
        row["image_id_label"] = " "
        if filename:
            full_path = os.path.join(path_to_image_folder, filename)
            if os.path.isfile(full_path):
                with Image.open(full_path, "r") as image_file:
                    row["image_base64"] = "data:image/png;base64," + resize_and_encode_image(image_file, max_size)
            else:
                row["image_base64"] = ""
        else:
            row["image_base64"] = ""

    # Step 3: Write the updated data to a new CSV
    with open(output_csvfile, mode='w', newline='') as outfile:
        writer = csv.DictWriter(outfile, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

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

#%%
add_base64encoding_to_csv("./data/export_lueneburg_epigraf_no_concat.csv",
                          "image_id",
                          "./data/googlekg/di-100",
                          "./data/export_lueneburg_epigraf_with_base64_no_concat.csv")
#%%
token = None
service_account_key_path = "./secrets/service_account_key.json"
vision_loop("./data/di-100/images-rest", limit = 1000, token=token)

