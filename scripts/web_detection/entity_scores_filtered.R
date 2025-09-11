# Entity Filter + Plot 
library(readr)
library(dplyr)
library(tidyr)

# Load data
source("settings.R")
data <- read_csv(paste0(path_data, "/data/di/all_entity_scores.csv"))

# Filter entity scores
filtered <- data %>%
  group_by(filename) %>%
  arrange(desc(score), .by_group = TRUE) %>%
  slice_head(n = 3) %>%  
  ungroup()

filtered_wide <- filtered %>%
  group_by(filename) %>%
  summarise(
    entityId = paste(entityId, collapse = ", "),
    score = paste(score, collapse = ", "),
    description = paste(description, collapse = ", "),
    .groups = "drop"
  )

write.csv(filtered_wide, paste0(path_data, "/data/di/wide_entity_scores.csv"))

# Plots   
filtered %>%
  count(description) %>%
  filter(n >= 10) %>%
  ggplot(aes(x = reorder(description, n), y = n)) +
  geom_col(fill = "orange") +
  geom_text(aes(label = n), vjust = 0.5, hjust = 1.3, size = 5) +  
  theme(axis.text = element_text(size = 10)) +
  coord_flip() +
  labs(
    title = "Entity Description Counts (n >= 10), filtered by highest Scores ",
    x = "Description",
    y = "Count"
  )


data %>%
  count(description) %>%
  filter(n >= 10) %>%
  ggplot(aes(x = reorder(description, n), y = n)) +
  geom_col(fill = "steelblue") +
  geom_text(aes(label = n), vjust = 0.5, hjust = 1.3, size = 5) +  
  theme(axis.text = element_text(size = 10)) +
  coord_flip() +
  labs(
    title = "Entity Description Counts (n >= 10) - Full Data",
    x = "Description",
    y = "Count"
  )


ggsave(paste0(path_data, "/data/di/entity_plot_full.png"))

