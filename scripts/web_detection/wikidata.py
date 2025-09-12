#%% imports
import csv
import requests

#%% lib

def enhance_csv(input_file, output_file, source_column, new_column, new_column_value_func):
    """
    Read a CSV file, add a column and save the result.

    Args:
        input_file (str): path to the CSV file
        output_file (str): path to the result file
        source_column (str): column name of the column that is being processed
        new_column (str): new column name
        new_column_value_func (function): function that yields the new column value
            signature: `def func(row[source_column]) -> any`
    """
    with open(input_file, mode='r', encoding='utf-8') as infile, \
         open(output_file, mode='w', encoding='utf-8', newline='') as outfile:

        reader = csv.DictReader(infile)
        fieldnames = reader.fieldnames + [new_column]
        writer = csv.DictWriter(outfile, fieldnames=fieldnames)

        writer.writeheader()

        msg_interval = 20
        row_counter = 0
        for row in reader:
            row_counter += 1
            row[new_column] = new_column_value_func(row[source_column])
            writer.writerow(row)
            if row_counter % msg_interval == 0:
                print(f"row: {row_counter}")

#%% lib2
def get_wikidata_by_freebase_id(freebase_id: str, language: str = "de") -> dict:
    """
    Query the Wikidata SPARQL-API for a freebase id (P646), or a google knowledge graph id (P2671)
    Get labels for properties
    - instance of (P31)
    - genre (P136)
    - subclass of (P279)

    :param freebase_id: freebase id or google knowledge graph id
    :param language: language for the labels
    :return: dictionary with the labels for the collected properties
    """

    query = f"""
    SELECT DISTINCT ?item ?itemLabel
                    (GROUP_CONCAT(DISTINCT ?p31Label; separator=", ") AS ?p31Labels)
                    (GROUP_CONCAT(DISTINCT ?p136Label; separator=", ") AS ?p136Labels)
                    (GROUP_CONCAT(DISTINCT ?p279Label; separator=", ") AS ?p279Labels)
    WHERE {{
    
      {{    
      ?item wdt:P646 "{freebase_id}" .
      }}
      UNION 
      {{
      ?item wdt:P2671 "{freebase_id}" .
      }}

      OPTIONAL {{
        ?item wdt:P31 ?p31 .
        ?p31 rdfs:label ?p31Label .
        FILTER(LANG(?p31Label) = "{language}")
      }}

      OPTIONAL {{
        ?item wdt:P136 ?p136 .
        ?p136 rdfs:label ?p136Label .
        FILTER(LANG(?p136Label) = "{language}")
      }}

      OPTIONAL {{
        ?item wdt:P279 ?p279 .
        ?p279 rdfs:label ?p279Label .
        FILTER(LANG(?p279Label) = "{language}")
      }}

      SERVICE wikibase:label {{ bd:serviceParam wikibase:language "{language}" . }}
    }}
    GROUP BY ?item ?itemLabel
    """

    # wikidata query service
    url = "https://query.wikidata.org/sparql"

    headers = {
        "Accept": "application/sparql-results+json"
    }

    response = requests.get(url, params={"query": query}, headers=headers)

    # Ergebnis verarbeiten
    if response.status_code == 200:
        data = response.json()
        results = []
        for result in data["results"]["bindings"]:
            item_result = {
                "item": result["item"]["value"],
                "label": result["itemLabel"]["value"],
                "p31": result.get("p31Labels", {}).get("value", "").split(", ") if "p31Labels" in result else [],
                "p136": result.get("p136Labels", {}).get("value", "").split(", ") if "p136Labels" in result else [],
                "p279": result.get("p279Labels", {}).get("value", "").split(", ") if "p279Labels" in result else [],
            }
            results.append(item_result)
        return results
    else:
        # raise Exception(f"Error during the query: {response.status_code}")
        return []


#%% test wikidata query
get_wikidata_by_freebase_id("/m/0135kl")

#%% lib3
def extract_query_results(q_results):
    """
    Create an array of arrays from the Wikidata SPARQL query results
    """
    results = []
    for q_result in q_results:
        for key in ['p31', 'p136', 'p279']:
            for term in q_result[key]:
                row = []
                if term == '':
                    continue
                row.append(q_result['item'].split("/")[-1])
                row.append(q_result['label'])
                row.append(term)
                results.append(row)
    return results

def query_wikipedia(source_file, output_file, limit = 5):
    delimiter = ','
    with open(output_file, mode='w', encoding='utf-8', newline='') as out_handle:
        with open(source_file, mode='r', encoding='utf-8') as source_handle:
            reader = csv.DictReader(source_handle)  # Reads first row
            writer = csv.writer(out_handle, delimiter=delimiter)
            writer.writerow(['id', 'label', 'class'])
            counter = 0
            msg_interval = 50
            for row in reader:
                entityId = row["entityId"]
                if not (entityId.startswith("/m/") or entityId.startswith("/g/")):
                    continue
                counter += 1
                if msg_interval > 0 and counter % msg_interval == 0:
                    print("Row: " + str(counter))
                if counter >= limit:
                    break
                #print(row['entityId'])
                q_result = extract_query_results(get_wikidata_by_freebase_id(row["entityId"], "en"))
                for entry in q_result:
                    writer.writerow(entry)


#%% test extraction function
extract_query_results(get_wikidata_by_freebase_id("/m/0135kl"))

#%% run 2025-09-12
source_file = "./data/di-100/counts/entity_counts.csv"
wikidata_file = "./data/di-100/counts/wikidata-p31-gm-en.csv"
query_wikipedia(source_file, wikidata_file, limit=400)








