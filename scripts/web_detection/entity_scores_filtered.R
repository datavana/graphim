# Evaluation
library(readr)
library(dplyr)

# Load data
source("settings.R")
data <- read_csv(paste0(path_data, "/data/di/all_entity_scores.csv"))

# Filter scores
filtered <- data %>%
  group_by(filename) %>%
  arrange(desc(score), .by_group = TRUE) %>%
  slice_head(n = 3) %>%  
  ungroup()

