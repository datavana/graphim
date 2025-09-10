#%% imports
import requests
import csv

#%% lib
def get_wikidata_property_values(search_term, property_id, language="de"):
    """
    Queries Wikidata using SPARQL to fetch values for a given property.

    Args:
        search_term (str): The search term (e.g., "Berlin").
        property_id (str): The Wikidata property ID (e.g., "P31").
        language (str): Language for labels (default: "de").

    Returns:
        list: A list of property values (labels) or an error message.
    """
    # Step 1: Find the Wikidata entity ID for the search term
    search_url = "https://www.wikidata.org/w/api.php"
    params = {
        "action": "wbsearchentities",
        "search": search_term,
        "language": language,
        "format": "json",
        "uselang": language,
    }
    headers = {
        "User-Agent": "WikidataSPARQLQuery/1.0 (https://example.com; your-email@example.com)"
    }

    response = requests.get(search_url, params=params, headers=headers)
    if response.status_code != 200:
        return [f"Error: Wikidata search failed (HTTP {response.status_code})."]

    data = response.json()
    if not data.get("search"):
        return ["No results found."]

    entity_id = data["search"][0]["id"]  # Use the first result

    # Step 2: Query the SPARQL endpoint for the property values
    sparql_query = f"""
    SELECT DISTINCT ?propertyValueLabel WHERE {{
      wd:{entity_id} wdt:{property_id} ?propertyValue .
      SERVICE wikibase:label {{ bd:serviceParam wikibase:language "{language},en". }}
    }}
    """
    sparql_url = "https://query.wikidata.org/sparql"
    params = {"query": sparql_query, "format": "json"}
    headers = {
        "User-Agent": "WikidataSPARQLQuery/1.0 (https://example.com; your-email@example.com)",
        "Accept": "application/json"
    }

    response = requests.get(sparql_url, params=params, headers=headers)
    if response.status_code != 200:
        return [f"Error: SPARQL query failed (HTTP {response.status_code})."]

    sparql_data = response.json()
    results = sparql_data.get("results", {}).get("bindings", [])

    # Extract the labels
    values = [result["propertyValueLabel"]["value"] for result in results]

    return values if values else ["No values found for this property."]


def enhance_csv(input_file, output_file, new_column_name, new_column_value_func):
    """
    Liest eine CSV-Datei, fügt eine neue Spalte hinzu und speichert das Ergebnis.

    Args:
        input_file (str): Pfad zur Eingabedatei (z. B. "input.csv").
        output_file (str): Pfad zur Ausgabedatei (z. B. "output.csv").
        new_column_name (str): Name der neuen Spalte (z. B. "Status").
        new_column_value_func (function): Funktion, die den Wert der neuen Spalte für jede Zeile berechnet.
            Signatur: `def func(row: dict) -> any`
    """
    with open(input_file, mode='r', encoding='utf-8') as infile, \
         open(output_file, mode='w', encoding='utf-8', newline='') as outfile:

        reader = csv.DictReader(infile)
        fieldnames = reader.fieldnames + [new_column_name]
        writer = csv.DictWriter(outfile, fieldnames=fieldnames)

        writer.writeheader()

        for row in reader:
            # Berechne den Wert der neuen Spalte
            row[new_column_name] = new_column_value_func(row)
            writer.writerow(row)

# Beispielaufruf: Füge eine Spalte "Status" hinzu, die "Aktiv" setzt, wenn "Alter" > 18
def set_status(row):
    return "Aktiv" if int(row.get("Alter", 0)) > 18 else "Inaktiv"

enhance_csv("input.csv", "output.csv", "Status", set_status)


#%% 2025-09-10 run
# Example usage
print(get_wikidata_property_values("Berlin", "P31"))  # Instance of
print(get_wikidata_property_values("Berlin", "P17"))  # Country

#%%
