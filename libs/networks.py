import base64
from io import BytesIO
import pandas as pd
import networkx as nx


def get_edges(dist_matrix, threshold, nodeslist):
    """
    Construct an edge list from a distance matrix based on a threshold.
    """
    num_nodes = dist_matrix.shape[0]
    edges = []

    for i in range(num_nodes):
        for j in range(i + 1, num_nodes):
            distance = dist_matrix[i, j]
            if distance < threshold:
                edges.append((nodeslist[i], nodeslist[j], float(distance)))

    # Convert to DataFrame
    edge_df = pd.DataFrame(edges, columns=['source', 'target', 'weight'])
    return edge_df


def get_nodes(filenames, images):
    """
    Create a DataFrame with filenames and base64-encoded image data URLs.

    Args:
        filenames (list of str): List of image filenames.
        images (list of PIL.Image.Image): List of PIL image thumbnails.

    Returns:
        pd.DataFrame: DataFrame with columns ['filename', 'imgdata'].
    """
    data = []

    for fname, img in zip(filenames, images):
        # Save image to a bytes buffer in PNG format
        buffer = BytesIO()
        img.save(buffer, format="PNG")
        buffer.seek(0)

        # Encode as base64
        img_b64 = base64.b64encode(buffer.read()).decode('utf-8')
        data_url = f"data:image/png;base64,{img_b64}"

        data.append({'id': fname, 'imgdata': data_url})

    return pd.DataFrame(data)

def create_gexf(edge_list_df, node_list_df, output_path="graph.gexf"):
    """
    Create a GEXF file from an edge list and a node list with image data.

    Args:
        edge_list_df (pd.DataFrame): DataFrame with columns ['source', 'target', 'weight'].
        node_list_df (pd.DataFrame): DataFrame with columns ['id', 'imgdata'].
        output_path (str): Path to save the GEXF file.
    """
    # Create an undirected graph
    G = nx.Graph()

    # Add nodes with attributes
    for _, row in node_list_df.iterrows():
        G.add_node(row['id'], img=row['imgdata'])

    # Add edges with weights
    for _, row in edge_list_df.iterrows():
        G.add_edge(row['source'], row['target'], weight=row['weight'])

    # Write to GEXF
    nx.write_gexf(G, output_path)