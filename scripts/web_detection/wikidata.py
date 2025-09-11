#%% imports
import csv
import requests

#%% lib
import requests

def get_wikidata_property_label_by_freebase_id(freebase_id: str, target_property: str = "P31", language: str = "de") -> list:
    """
    Abfrage der Wikidata-SPARQL-Schnittstelle für eine gegebene Freebase-ID (P646)
    und Rückgabe der Labels der Werte einer anderen Eigenschaft (z. B. P31).

    :param freebase_id: Die Freebase-ID (z. B. "/m/068hy" für Berlin)
    :param target_property: Die Wikidata-Eigenschaft, deren Wert abgefragt werden soll (z. B. "P31")
    :param language: Die Sprache für das Label (Standard: "de" für Deutsch)
    :return: Liste der Labels für die Ziel-Eigenschaft
    """
    # SPARQL-Abfrage mit Label-Abfrage
    query = f"""
    SELECT DISTINCT ?value ?valueLabel WHERE {{
      ?item wdt:P646 "{freebase_id}" .
      ?item wdt:{target_property} ?value .
      SERVICE wikibase:label {{ bd:serviceParam wikibase:language "{language}" . }}
    }}
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
        labels = []
        for result in data["results"]["bindings"]:
            if "valueLabel" in result:
                labels.append(result["valueLabel"]["value"])
        return labels
    else:
        # raise Exception(f"Fehler bei der Abfrage: {response.status_code}")
        return ["HTTP-Code != 200"]


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

#%% lib aux

def get_P31(freebase_id):
    val_list = get_wikidata_property_label_by_freebase_id(freebase_id, "P31", "de")
    val_list = map(lambda x: x.split('/')[-1], val_list)
    return ";".join(val_list)

#%% test
get_P31("/m/0135kl")



#%% 2025-09-11 run
source_file = "./data/di-100/counts/entity_counts.csv"
output_file = "./data/di-100/counts/entity_counts_wd.csv"
source_column = "entityId"
new_column = "P31"

enhance_csv(source_file, output_file, source_column, new_column, get_P31)






