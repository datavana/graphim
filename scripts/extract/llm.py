# Image prompts

#%%
import base64
from openai import OpenAI

# Set the API key in libs/settings.py
from libs import settings
client = OpenAI(api_key = settings.openai_apikey)


#%%
image_path = "data/memesgerman/images/msg10.png"
with open(image_path, "rb") as image_file:
    b64_image = base64.b64encode(image_file.read()).decode("utf-8")

#%%
#prompt = "What is in this image?"

prompt = "Who or what is in the image, what is the context of the image, how is it discussed on the web?"
response = client.responses.create(
    model="gpt-4o-mini",
    input=[
        {
            "role": "user",
            "content": [
                {"type": "input_text", "text": prompt},
                {"type": "input_image", "image_url": f"data:image/png;base64,{b64_image}"},
            ],
        }
    ],
)

#%%
print(response.output_text)

