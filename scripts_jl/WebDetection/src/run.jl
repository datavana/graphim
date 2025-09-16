using Revise, Pkg
repo_root = "./Documents/projects/graphim"
Pkg.activate(joinpath(repo_root, "scripts_jl/WebDetection/"))
using DataFrames
using WebDetection

# 2025-09-15 
# ** query Wikidata, count classes per file
# extract web entities from Google vision results
cd(repo_root)

# read JSON files 
dirname = "data/di-100/vision_results"
df_file_web_entities = WebDetection.extract_web_entities(dirname)

using CSV
CSV.write("./data/di-100/counts/image-web_entity.csv", df_file_web_entities, delimiter = ",")

df_file_web_entities[100:103, :]

# test
m_04_ghwz = WebDetection.get_wikidata_by_freebase_id("/m/04ghwz")

web_entities = df_file_web_entities[:, :web_entity] |> unique
# 385 web_entities
df_classes = WebDetection.collect_wd_classes(web_entities, "de")

CSV.write("./data/di-100/counts/web_entity-class.csv", df_classes, delimiter = ",")

df_file_class = innerjoin(df_file_web_entities, df_classes[:, [:web_entity_id, :wd_class]], on = :web_entity => :web_entity_id)

gdf = groupby(df_file_class, :wd_class)
df_wd_class_count = combine(gdf, nrow)

sort!(df_wd_class_count, :nrow, rev=true)

CSV.write("./data/di-100/counts/wd_class_count.csv", df_wd_class_count)

# repeat for english class names
df_classes = WebDetection.collect_wd_classes(web_entities, "en")

CSV.write("./data/di-100/counts/web_entity-class-en.csv", df_classes, delimiter = ",")

df_file_class = innerjoin(df_file_web_entities, df_classes[:, [:web_entity_id, :wd_class]], on = :web_entity => :web_entity_id)

gdf = groupby(df_file_class, :wd_class)
df_wd_class_count = combine(gdf, nrow)
sort!(df_wd_class_count, :nrow, rev=true)

CSV.write("./data/di-100/counts/wd_class_count_en.csv", df_wd_class_count)
