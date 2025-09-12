# %%
import json
from pathlib import Path
import csv
import os


# %%
def create_csv_with_entitites_from_google_vision_json(json_path, output_csv_path):

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
    list_to_csv(tmp_list, output_csv_path, fieldnames)

def create_csv_with_full_matches_from_google_vision_json(json_path, output_csv_path):

    tmp_list = []

    # loop over json files
    for jsonfile in Path(json_path).iterdir():

        # read json
        with open(jsonfile, 'r') as file:
            data = json.load(file)

        # append json data as dictionary to tmp_list
        try:
            matching_pages = data['responses'][0]['webDetection']['fullMatchingImages']
            filtered = [item['url'] for item in matching_pages if "url" in item]
            tmp_list.append({'img_path': os.path.splitext(jsonfile.name)[0] + '.jpg', 'matching_pages': ';'.join(filtered)})
        except KeyError as e:
            tmp_list.append({'img_path': os.path.splitext(jsonfile.name)[0] + '.jpg', 'matching_pages': 'No matching pages!'})

    # write tmp_list to csv file
    fieldnames = ['img_path', 'matching_pages']
    list_to_csv(tmp_list, output_csv_path, fieldnames)

def list_to_csv(origin_list, output_csv_path, fieldnames):

    with open(output_csv_path, 'w', newline='') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(origin_list)

def filter_csv_for_searchterm(searchterm, csvfile, column_to_search, output_csv_path):

    filtered_list = []

    with open(csvfile, newline='') as file:
        reader = csv.DictReader(file)
        for row in reader:
            if searchterm.lower() in row[column_to_search].lower():
                filtered_list.append(row)

        list_to_csv(filtered_list, output_csv_path, reader.fieldnames)

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
create_csv_with_entitites_from_google_vision_json(
    json_path="./data/vision_results",
    output_csv_path='./data/entities_network.csv'
)

# %%
filter_csv_for_searchterm(
    searchterm="die deutschen inschriften",
    csvfile="./data/entities_network.csv",
    column_to_search="entities",
    output_csv_path="./data/entities_deutsche_inschriften_network.csv"
)

#%%
create_csv_with_full_matches_from_google_vision_json(
    json_path="./data/vision_results",
    output_csv_path="./data/matching_pages_network.csv"
)

#%%
filter_csv_for_searchterm(
    searchterm="www.inschriften.net",
    csvfile="./data/matching_pages_network.csv",
    column_to_search="matching_pages",
    output_csv_path="./data/matching_pages_inschriften_network.csv"
)

# %%
compare_two_columns_on_equality("./data/entities_deutsche_inschriften_network.csv", "img_path",
                                "./data/matching_pages_inschriften_network.csv", "img_path")
