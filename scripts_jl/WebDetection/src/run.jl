# 2025-09-16 init package
# do this only once after you cloned the repository
using Pkg
repo_root = "./Documents/projects/imgnetmkr"
Pkg.activate(joinpath(repo_root, "scripts_jl/WebDetection/"))
Pkg.instantiate()

# 2025-09-16 start your session
using Revise, Pkg
repo_root = "./Documents/projects/imgnetmkr"
Pkg.activate(joinpath(repo_root, "scripts_jl/WebDetection/"))
using DataFrames
using WebDetection

# 2025-09-15 
# ** query Wikidata, count classes per file
# extract web entities from Google vision results
cd(repo_root)

# read JSON files 
dirname = "./data/di-100/vision_results"
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

# 2029-09-16 get also IDs for the classes
using Revise, Pkg
repo_root = "./Documents/projects/imgnetmkr"
Pkg.activate(joinpath(repo_root, "scripts_jl/WebDetection/"))
using DataFrames
using CSV
using WebDetection

# get df_file_web_entities and web_entities: see above

# tests
# fb_id = "/m/02csf"
fb_id = "/m/080kk2c"
qr = WebDetection.get_wikidata_by_freebase_id(fb_id, "p31")

# get data for P31: instance of

df_p31 = WebDetection.collect_wd_property(web_entities, "P31", language = "de")
CSV.write("./data/di-100/counts/web_entity-p31.csv", df_p31, delimiter = ",")

df_file_p31 = innerjoin(df_file_web_entities, df_p31[:, [:entityId, :entityWd, :p31, :p31Label]], on = :web_entity => :entityId)

gdf = groupby(df_file_p31, [:p31, :p31Label])
df_p31_count = combine(gdf, nrow)
sort!(df_p31_count, :nrow, rev=true)

CSV.write("./data/di-100/counts/p31_filecount_de.csv", df_p31_count)

# get data for P279: subclass of

df_p279 = WebDetection.collect_wd_property(web_entities, "P279", language = "de")
CSV.write("./data/di-100/counts/web_entity-p279.csv", df_p279, delimiter = ",")

df_file_p279 = innerjoin(df_file_web_entities, df_p279[:, [:entityId, :entityWd, :p279, :p279Label]], on = :web_entity => :entityId)

gdf = groupby(df_file_p279, [:p279, :p279Label])
df_p279_count = combine(gdf, nrow)
sort!(df_p279_count, :nrow, rev=true)

CSV.write("./data/di-100/counts/p279_filecount_de.csv", df_p279_count)

# get data for P136: genre

df_p136 = WebDetection.collect_wd_property(web_entities, "P136", language = "de")
CSV.write("./data/di-100/counts/web_entity-p136.csv", df_p136, delimiter = ",")

df_file_p136 = innerjoin(df_file_web_entities, df_p136[:, [:entityId, :entityWd, :p136, :p136Label]], on = :web_entity => :entityId)

gdf = groupby(df_file_p136, [:p136, :p136Label])
df_p136_count = combine(gdf, nrow)
sort!(df_p136_count, :nrow, rev=true)

CSV.write("./data/di-100/counts/p136_filecount_de.csv", df_p136_count)

# get data for P921: main subject

df_p921 = WebDetection.collect_wd_property(web_entities, "P921", language = "de")
CSV.write("./data/di-100/counts/web_entity-p921.csv", df_p921, delimiter = ",")

df_file_p921 = innerjoin(df_file_web_entities, df_p921[:, [:entityId, :entityWd, :p921, :p921Label]], on = :web_entity => :entityId)

gdf = groupby(df_file_p921, [:p921, :p921Label])
df_p921_count = combine(gdf, nrow)
sort!(df_p921_count, :nrow, rev=true)

CSV.write("./data/di-100/counts/p921_filecount_de.csv", df_p921_count)

# 2029-09-18
# merge files of different properties
using DataFrames, CSV

function merge_class_files(file_name_list)    
    df = DataFrame(prop = String[], wd_id = String[], wd_label = String[], nrow = Int[])    
    for file in file_name_list
        df_loop = CSV.read(file, DataFrame)
        prop = names(df_loop) |> first
        rename!(df_loop, [1 => :wd_id, 2 => :wd_label])
        df_loop.prop .= prop
        append!(df, df_loop)            
    end             
    return df
end


using Revise, Pkg
repo_root = "./Documents/projects/imgnetmkr"
Pkg.activate(joinpath(repo_root, "scripts_jl/WebDetection/"))

cd(repo_root)

file_name_list = ["./data/di-100/counts/$(prop)_filecount_de.csv" for prop in ["p31", "p136", "p279", "p921"]]
df_fc_prop_all = merge_class_files(file_name_list)

sort!(df_fc_prop_all, :nrow, rev=true)

CSV.write("./data/di-100/counts/pAll_filecount_de.csv", df_fc_prop_all)

# 2025-09-18
## ** select web entities by p31 classes
data_path = "./data/di-100/counts/"

# selection on P31
df_p31_graph = CSV.read(joinpath(data_path, "p31_filecount_de_graph.csv"), DataFrame)

# mapping web entity to selected P31 classes and image files to selected web entities
df_entity_p31 = CSV.read(joinpath(data_path, "web_entity-P31.csv"), DataFrame)

df_entity_p31_graph = innerjoin(df_entity_p31, df_p31_graph[:, [:p31, :graph2]], on=:p31)

df_img = CSV.read(joinpath(data_path, "image-web_entity.csv"), DataFrame)

df_img_graph = leftjoin(df_img, df_entity_p31_graph[:, [:entityId, :p31Label, :graph2]], on=:web_entity => :entityId)

# evaluate the selection
df_img_graph_filtered = subset(df_img_graph, :graph2 => ByRow(isequal(1)))

CSV.write(joinpath(data_path, "image-web_entity-p31-filtered.csv"), df_img_graph_filtered)

function set_ext(file, new_ext)
    parts = splitext(file)
    return string(parts |> first, ".", new_ext)
end

transform!(df_img_graph_filtered, :filename => ByRow(x -> set_ext(x, "jpg")) => :filename_jpg)