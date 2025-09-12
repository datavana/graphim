#%% imports
import csv
import requests

#%% lib

def enhance_csv(input_file, output_file, source_column, new_column, new_column_value_func):
    """
    Liest eine CSV-Datei, fügt eine neue Spalte hinzu und speichert das Ergebnis.

    Args:
        input_file (str): Pfad zur Eingabedatei (z. B. "input.csv").
        output_file (str): Pfad zur Ausgabedatei (z. B. "output.csv").
        new_column (str): Name der neuen Spalte (z. B. "Status").
        new_column_value_func (function): Funktion, die den Wert der neuen Spalte für jede Zeile berechnet.
            Signatur: `def func(row: dict) -> any`
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
            # Berechne den Wert der neuen Spalte
            row[new_column] = new_column_value_func(row[source_column])
            writer.writerow(row)
            if row_counter % msg_interval == 0:
                print(f"row: {row_counter}")


# example usagge
# def set_status(row):
#     return "Aktiv" if int(row.get("Alter", 0)) > 18 else "Inaktiv"
#
# enhance_csv("input.csv", "output.csv", "Status", set_status)

#%% test 2025-09-11
get_wikidata_property_by_freebase_id("/m/0135kl", "P31")

#%% lib2

def get_wikidata_by_freebase_id(freebase_id: str, language: str = "de") -> dict:
    """
    Abfrage der Wikidata-SPARQL-Schnittstelle für eine gegebene Freebase-ID (P646)
    und Rückgabe der Labels für die Eigenschaften P31, P136 und P279.

    :param freebase_id: Die Freebase-ID (z. B. "/m/068hy" für Berlin)
    :param language: Die Sprache für die Labels (Standard: "de" für Deutsch)
    :return: Dictionary mit den Labels der gefundenen Eigenschaften
    """
    # SPARQL-Abfrage mit festen Eigenschaften
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

    # URL des Wikidata Query Service
    url = "https://query.wikidata.org/sparql"

    # Header für die Anfrage
    headers = {
        "Accept": "application/sparql-results+json"
    }

    # Anfrage senden
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
        # raise Exception(f"Fehler bei der Abfrage: {response.status_code}")
        return []

# Beispielaufruf
# if __name__ == "__main__":
#     freebase_id = "/m/068hy"  # Freebase-ID für Berlin
#     results = get_wikidata_by_freebase_id(freebase_id, language="de")
#     for result in results:
#         print(f"Item: {result['label']}")
#         print(f"  P31 (Instanz von): {', '.join(result['p31']) if result['p31'] else 'nicht vorhanden'}")
#         print(f"  P136 (Genre): {', '.join(result['p136']) if result['p136'] else 'nicht vorhanden'}")
#         print(f"  P279 (Unterklasse von): {', '.join(result['p279']) if result['p279'] else 'nicht vorhanden'}")

#%% test wikidata query
get_wikidata_by_freebase_id("/m/0135kl")

#%% lib3
def extract_query_results(q_results):
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
            reader = csv.DictReader(source_handle)  # Liest die erste Zeile als Spaltennamen
            writer = csv.writer(out_handle, delimiter=delimiter)
            writer.writerow(['id', 'label', 'class'])
            counter = 0
            msg_interval = 50
            for row in reader:
                # hack to go for free-base IDs only
                entityId = row["entityId"]
                counter += 1
                if msg_interval > 0 and counter % msg_interval == 0:
                    print("Row: " + str(counter))
                if counter >= limit:
                    break
                #print(row['entityId'])
                q_result = extract_query_results(get_wikidata_by_freebase_id(row["entityId"]))
                for entry in q_result:
                    writer.writerow(entry)


#%% test extraction function
extract_query_results(get_wikidata_by_freebase_id("/m/0135kl"))

#%% run 2025-09-12
source_file = "./data/di-100/counts/entity_counts.csv"
wikidata_file = "./data/di-100/counts/wikidata-p31-gm.csv"
query_wikipedia(source_file, wikidata_file, limit=400)








