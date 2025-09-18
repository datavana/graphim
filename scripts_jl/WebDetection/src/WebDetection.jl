module WebDetection
using HTTP, JSON3
using DataFrames

"""
    extract_web_entities(dirname::String)

Read JSON-files in `dirname` an extract web entities

# Returns
- data frame with file names and web entities
"""

function extract_web_entities(dirname::String)
    df = DataFrame(filename = String[], web_entity = String[], web_entity_description = String[])
    for file in readdir(dirname, join=true)        
        json_string = read(file, String)
        json = JSON3.read(json_string)
        web_detection = json["responses"][1]["webDetection"]        
        if haskey(web_detection, "webEntities")
            file_short = splitdir(file) |> last
            for web_entity in web_detection["webEntities"]
                description = get(web_entity, "description", "")
                push!(df, (file_short, web_entity["entityId"], description))
            end
        end
    end

    return df
end


"""
    get_wikidata_by_freebase_id(freebase_id::String; language::String="de") -> Vector{Dict{String, Any}}

Query the Wikidata SPARQL-API for a freebase id (P646) or a Google Knowledge Graph id (P2671).
Retrieve labels for the following properties:
- instance of (P31)
- genre (P136)
- subclass of (P279)

# Arguments
- `freebase_id::String`: Freebase id or Google Knowledge Graph id.
- `language::String`: Language for the labels (default: "de").

# Returns
- `Vector{Dict{String, Any}}`: A vector of dictionaries, each containing:
    - `item`: Wikidata item URI.
    - `label`: Label of the item.
    - `p31`: Array of labels for "instance of" (P31).
    - `p136`: Array of labels for "genre" (P136).
    - `p279`: Array of labels for "subclass of" (P279).
"""
function get_wikidata_by_freebase_id(freebase_id::String; language::String="de")    
    query = """
    SELECT DISTINCT ?item ?itemLabel
                    (GROUP_CONCAT(DISTINCT ?p31Label; separator=", ") AS ?p31Labels)
                    (GROUP_CONCAT(DISTINCT ?p136Label; separator=", ") AS ?p136Labels)
                    (GROUP_CONCAT(DISTINCT ?p279Label; separator=", ") AS ?p279Labels)
    WHERE {

      {
      ?item wdt:P646 "$freebase_id" .
      }
      UNION
      {
      ?item wdt:P2671 "$freebase_id" .
      }
      OPTIONAL {
        ?item wdt:P31 ?p31 .
        ?p31 rdfs:label ?p31Label .
        FILTER(LANG(?p31Label) = "$language")
      }
      OPTIONAL {
        ?item wdt:P136 ?p136 .
        ?p136 rdfs:label ?p136Label .
        FILTER(LANG(?p136Label) = "$language")
      }
      OPTIONAL {
        ?item wdt:P279 ?p279 .
        ?p279 rdfs:label ?p279Label .
        FILTER(LANG(?p279Label) = "$language")
      }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "$language" . }
    }
    GROUP BY ?item ?itemLabel
    """

    url = "https://query.wikidata.org/sparql"
    headers = ["Accept" => "application/sparql-results+json"]

    try
        response = HTTP.get(url, query=Dict("query" => query), headers)
        if response.status == 200
            data = JSON3.read(response.body)
            results = []
            for result in data.results.bindings
                item_result = Dict{String, Any}(
                    "item" => result.item.value,
                    "label" => result.itemLabel.value,
                    "p31" => get(result, "p31Labels", Dict()).value isa String ? split(result.p31Labels.value, ", ") : String[],
                    "p136" => get(result, "p136Labels", Dict()).value isa String ? split(result.p136Labels.value, ", ") : String[],
                    "p279" => get(result, "p279Labels", Dict()).value isa String ? split(result.p279Labels.value, ", ") : String[],
                )
                push!(results, item_result)
            end
            return results
        else
            @warn "Error during the query: $(response.status)"
            return []
        end
    catch e
        @warn "Exception during the query: $e"
        return []
    end
end

"""
    get_wikidata_by_freebase_id(entity_id::String, property::String; language::String="de") -> Vector{Dict{String, Any}}

Query the Wikidata SPARQL-API for a freebase id (P646) or a Google Knowledge Graph id (P2671).
Retrieve IDs and labels for `property`

# Arguments
- `entity_id::String`: Freebase id or Google Knowledge Graph id.
- `property`: e.g. "P31"
- `language::String`: Language for the labels (default: "de").

# Returns
- A vector of tuples:
    - entityId: value of entity_id
    - entityWd: Wikidata ID of the entity
    - entityWdLabel: Label of the entity
    - `property`: Wikidata ID of the property value
    - `property` * Label : property value label
"""
function get_wikidata_by_freebase_id(entity_id::String, property::String; language::String="de")    
    pb = lowercasefirst(property)
    wdtP = uppercasefirst(property)
    query = """
    SELECT DISTINCT ?entityWd ?entityWdLabel ?$pb ?$(pb)Label
    WHERE {
      {
      ?entityWd wdt:P646 "$entity_id" .
      }
      UNION
      {
      ?entityWd wdt:P2671 "$entity_id" .
      }
      OPTIONAL {
        ?entityWd wdt:$wdtP ?$pb .
        ?$pb rdfs:label ?$(pb)Label .
        FILTER(LANG(?$(pb)Label) = "$language")
      }      
      SERVICE wikibase:label { bd:serviceParam wikibase:language "$language" . }
    }    
    """

    url = "https://query.wikidata.org/sparql"
    headers = ["Accept" => "application/sparql-results+json"]

    function bindings_to_tuple(bindings) 
        results = []
        for binding in bindings
            if !haskey(binding, pb)
                continue
            end
            key_list = ("entityWd", "entityWdLabel", pb, pb * "Label")            
            value_tuple = NamedTuple((Symbol(k) => binding[k]["value"] for k in key_list))
            push!(results, NamedTuple((entityId = entity_id, value_tuple...)))
        end
        return results
    end

    try
        response = HTTP.get(url, query=Dict("query" => query), headers)
        if response.status == 200
            data = JSON3.read(response.body)            
            return bindings_to_tuple(data.results.bindings)
        else
            @warn "Error during the query: $(response.status)"
            return []
        end
    catch e
        @warn "Exception during the query: $e"
        return []
    end
end

"""
    collect_wd_classes(web_entities::String[])

Query Wikidata and collect classes for each item in `web_entities`.
    
# Returns
- data frame with web entity ID, Wikidata ID, Wikidata label, class label
"""
function collect_wd_classes(web_entitities::Vector{String}, language="en")
    df = DataFrame(
        web_entity_id = String[],
        wd_id = String[],
        wd_label = String[],
        wd_class = String[]
    )
    unique_web_entities = unique(web_entitities)
    msg_interval = 50
    counter = 0
    for web_entity in unique_web_entities
        counter += 1
        if counter % msg_interval == 0
            @info counter
        end
        wd_result_set = get_wikidata_by_freebase_id(web_entity, language=language)
        for wd_result in wd_result_set
            wd_id = split(wd_result["item"], "/") |> last
            for class in vcat(wd_result["p31"], wd_result["p136"], wd_result["p279"])                
                if class == ""
                     continue
                end                
                push!(df, (web_entity, wd_id, wd_result["label"], class))
            end          
        end
    end
    return df
end

"""
    collect_wd_property(web_entities::String[])

Query Wikidata and collect classes for each item in `web_entities`.
    
# Returns
- data frame with web entity ID, Wikidata ID, Wikidata label, class label
"""
function collect_wd_property(web_entitities::Vector{String}, property::String; language="en", limit = 10000)
    pb = lowercasefirst(property)
    df = DataFrame(
        :entityId => String[],
        :entityWd => String[],
        :entityWdLabel => String[],
        Symbol(pb) => String[],
        Symbol(pb * "Label") => String[]
    )
    unique_web_entities = unique(web_entitities)
    msg_interval = 50
    counter = 0
    for web_entity in unique_web_entities
        counter += 1
        if counter % msg_interval == 0
            @info counter
        end
        if counter > limit
            break
        end
        wd_result_set = get_wikidata_by_freebase_id(web_entity, property, language=language)
        for wd_result in wd_result_set            
            push!(df, wd_result)
        end
    end
    return df
end

end # module WebDetection
