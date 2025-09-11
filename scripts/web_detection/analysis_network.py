# %%
import json
from pathlib import Path
import csv
import os


# %%
def list_to_csv(origin_list, output_file, fieldnames):
    with open(output_file, 'w', newline='') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(origin_list)


def create_csv(json_path):
    tmp_list = []

    # loop over json files
    for jsonfile in Path(json_path).iterdir():

        # read json
        with open(jsonfile, 'r') as file:
            data = json.load(file)

        # append json data as dictionary to tmp_list
        try:
            entities = data['responses'][0]['webDetection']['webEntities']
            filtered = [item['description'] for item in entities if "description" in item]
            tmp_list.append({'img_path': os.path.splitext(jsonfile.name)[0] + '.jpg', 'entities': ';'.join(filtered)})
        except KeyError as e:
            tmp_list.append({'img_path': os.path.splitext(jsonfile.name)[0] + '.jpg', 'entities': 'No entities!'})

    # write tmp_list to csv file
    fieldnames = ['img_path', 'entities']
    list_to_csv(tmp_list, './data/entities_network.csv', fieldnames)


def filter_searchterm(searchterm, csvfile, column_to_search):
    filtered_list = []

    with open(csvfile, newline='') as file:
        reader = csv.DictReader(file)
        for row in reader:
            if searchterm.lower() in row[column_to_search].lower():
                filtered_list.append(row)

        print(filtered_list)
        print(reader.fieldnames)
        list_to_csv(filtered_list, './data/entities_deutsche_inschriften_network.csv', reader.fieldnames)


def find_inschriften_matching(json_path):
    tmp_list = []

    for jsonfile in Path(json_path).iterdir():

        # read json
        with open(jsonfile, 'r') as file:
            data = json.load(file)

        web_detection = data["responses"][0].get("webDetection", {})
        # collect urls with matching images in tmp_list
        for page in web_detection.get("pagesWithMatchingImages", []):
            if "www.inschriften.net" in page['url']:
                tmp_list.append(
                    {'img_path': os.path.splitext(jsonfile.name)[0] + '.jpg', 'url_matching_site': page['url']})

        # write tmp_list to csv file
        fieldnames = ['img_path', 'url_matching_site']
        list_to_csv(tmp_list, './data/matching_site_inschriften.csv', fieldnames)


def compare_two_columns_on_equality(csvfile1, column_to_compare1, csvfile2, column_to_compare2):
    # Read column from file1.csv
    with open(csvfile1, newline='') as f1:
        reader1 = csv.DictReader(f1)
        column1 = [row[column_to_compare1] for row in reader1]

    # Read column from file2.csv
    with open(csvfile2, newline='') as f2:
        reader2 = csv.DictReader(f2)
        column2 = [row[column_to_compare2] for row in reader2]

    # Compare sets
    set1 = set(column1)
    set2 = set(column2)

    common = set1 & set2
    only_in_file1 = set1 - set2
    only_in_file2 = set2 - set1

    print("✅ Common values:", common)
    print("📁 Only in file1:", only_in_file1)
    print("📁 Only in file2:", only_in_file2)


# %%
create_csv(json_path="./data/vision_results")

# %%
filter_searchterm(searchterm="die deutschen inschriften", csvfile="./data/entities_network.csv",
                  column_to_search="entities")

# %%
find_inschriften_matching(json_path="./data/vision_results")

# %%
compare_two_columns_on_equality("./data/entities_deutsche_inschriften_network.csv", "img_path",
                                "./data/matching_site_inschriften.csv", "img_path")
