import os
import base64
from io import BytesIO
from PIL import Image

def image_to_data_url(filepath, size=(100, 100)):

    if not os.path.isfile(filepath):
        return None

    try:
        img = Image.open(filepath)
        img = img.resize(size, Image.Resampling.LANCZOS)
        buffered = BytesIO()
        img.save(buffered, format="JPEG")
        img_bytes = buffered.getvalue()
        base64_str = base64.b64encode(img_bytes).decode("utf-8")
        data_url = f"data:image/jpeg;base64,{base64_str}"
        return data_url
    except Exception as e:
        return None

def chromaResults2Html(results, imgfolder, outputfile):

    html_content = """
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>Search Results</title>
        <style>
            body { font-family: Arial, sans-serif; }
              .resultlist {
                display: flex;
                flex-wrap: wrap;
                gap: 16px;
                padding: 10px;
              }            
            .result { width:400; height:400; margin-bottom: 20px; }
            .result img { max-width: 400px; max-height: 400px; display: block; margin-bottom: 5px; }
            .result-distance { font-size: 0.9em; color: #555; }
        </style>
    </head>
    <body>
    <div class="resultlist">
    """

    for filename, dist in zip(results['ids'][0], results['distances'][0]):
        filepath = os.path.join(imgfolder, filename.replace('file:', ''))
        filedata = image_to_data_url(filepath, (600, 600))
        html_content += f"""
        <div class="result">
            <img src="{filedata}" alt="{filename}" />
            <div class="result-title">{filename}</div>
            <div class="result-distance">Distance: {dist:.4f}</div>
        </div>
        """

    html_content += """
    </div>
    </body>
    </html>
    """

    with open(outputfile, "w", encoding="utf-8") as f:
        f.write(html_content)

    return outputfile