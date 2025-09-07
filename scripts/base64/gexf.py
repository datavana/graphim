#%%
# Inject base64 encoded images as data URLS into a gexf file
# Those files can be visualised with Gephi Lite.

import os
import base64
from lxml import etree
from PIL import Image
from io import BytesIO
from tqdm import tqdm

#%% Paths

gexf_input_path = "data/microcefalia/microcefalia.layouted.gexf"
gexf_output_path = "data/microcefalia/microcefalia.img.layouted.gexf"
images_folder = "data/microcefalia/images"

#%% Helpers
def image_to_data_url(image_path, size=(100, 100)):
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

#%% Load gexf file
parser = etree.XMLParser(remove_blank_text=True)
tree = etree.parse(gexf_input_path, parser)
root = tree.getroot()

nsmap = root.nsmap
gexf_ns = nsmap.get(None)
ns = {"g": gexf_ns}  # prefix 'g' used for XPath queries

#%% Add imgdata attribute to graph header

attributes_xpath = ".//g:graph/g:attributes[@class='node']"
attributes_elems = root.xpath(attributes_xpath, namespaces=ns)

if attributes_elems:
    attributes_node = attributes_elems[0]
    if not attributes_node.xpath("g:attribute[@id='imgdata']", namespaces=ns):
        new_attribute = etree.Element(f"{{{gexf_ns}}}attribute")
        new_attribute.set("id", "imgdata")
        new_attribute.set("title", "imgdata")
        new_attribute.set("type", "string")
        attributes_node.append(new_attribute)

#%% Add images

nodes_xpath = ".//g:graph/g:nodes/g:node"
attvalues_tag = "g:attvalues"
attvalue_tag = "g:attvalue"

errors = []
nodes = root.xpath(nodes_xpath, namespaces=ns)
for node in tqdm(nodes, desc="Processing nodes"):
    # find attvalues element
    attvalues = node.find(attvalues_tag, namespaces=ns)
    if attvalues is None:
        continue

    # find attvalue with attribute for="img"
    img_attvalue = None
    for attvalue in attvalues.findall(attvalue_tag, namespaces=ns):
        if attvalue.get("for") == "img":
            img_attvalue = attvalue
            break

    if img_attvalue is None:
        continue

    img_filename = img_attvalue.get("value")
    if not img_filename:
        continue

    img_path = os.path.join(images_folder, img_filename)

    if not os.path.isfile(img_path):
        errors.append(f"Image file not found for node id={node.get('id')}: {img_filename}")
        continue

    data_url = image_to_data_url(img_path)
    if data_url is None:
        continue

    # add or replace attvalue with for="imgdata"
    existing_imgdata = None
    for attvalue in attvalues.findall(attvalue_tag, namespaces=ns):
        if attvalue.get("for") == "imgdata":
            existing_imgdata = attvalue
            break

    if existing_imgdata is not None:
        existing_imgdata.set("value", data_url)
    else:
        new_attvalue = etree.Element(f"{{{gexf_ns}}}attvalue")
        new_attvalue.set("for", "imgdata")
        new_attvalue.set("value", data_url)
        attvalues.append(new_attvalue)

print(f"Done. {len(errors)} errors.")

#%% Save

tree.write(gexf_output_path, pretty_print=True, encoding="utf-8", xml_declaration=True)

