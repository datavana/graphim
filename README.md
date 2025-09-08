# Graphs from Images

The repository contains tools and workflows for image network and context analysis.

The idea of this repository is to develop JavaScript tools running in the browser
that can be deployed using GitHub Pages. In case server processing is needed,
mature Python scripts, later, can be integrated into the [Datavana Databoard service](https://databoard.uni-muenster.de/). 
The Databoard service provides an API that can be accessed by the web apps or other applications
such as Epigraf or Facepager.

Folder Structure:  

- **docs**: Lightweigt web apps running in the browser, to be deployed using GitHub Pages.
- **data**: Data is stored outside the repository.  Because the folder content is ignored by git,
  You can safely copy data from outside the repository into the data subfolder.    
- **scripts**: Scripts for working with images. Develop your workflows here. 
- **notebooks**: Interactive Jupyter Notebooks for trying out examples.
  You can start a local Jupyter Environment using docker, see below.
- **libs**: A place to store helper files to be imported into scripts or notebooks. 
  Also used for settings, see the settings.default.py.
- **container**: Docker files for docker compose setups.


## Getting started with an image network

1. Go to https://gephi.org/gephi-lite/ 
   and open the local file `Samples/microcefalia/microcefalia.img.gexf`
   (the file is not in this repository, see Sciebo).
3. Click the color palette button (left sidebar), 
   scroll down to the Images section and select  "imgdata" as image source
4. Zoom into the network to see the images. Zoom out again for the next step.
5. Click the layout button (left sidebar, last icon),
   select ForceAtlas2, click Guess settings and start

## Getting started with a web app

1. Clone the repository
2. Open the file docs/img2url/index.html in you browser
3. Process some images by clicking the folder selector
4. See the source code of index.html

This app is deployed using GitHub Pages.
You can access it online at [https://datavana.github.io/graphim/img2url](https://datavana.github.io/graphim/img2url)

## Getting started with image processing

See the scripts folder for examples to generate image descriptions, extract text,
feed images to a llm, extract image components or calculate image similarity using embeddings.

## Facepager: Getting started with image prompts to the OpenAI API

1. Install the latest Facepager version
2. Create a database (New database) and 
   add image files as seed nodes (Add Nodes -> Add files, then select some images). 
3. Open the image prompt preset in the OpenAI category (Preset button)
4. Enter your API key into the Access Token field
5. Fetch data

## Facepager: Getting started with using the Google Cloud Vision API

*You need to register an app at the google cloud console and enable billing.
Find some hints in the [Facepager wiki](https://github.com/strohne/Facepager/wiki/Getting-Started-with-Google-Cloud-Platform).
Alternatively, ask someone to borrow credentials. Careful: Costs may be generated.*

1. Install the latest Facepager version
2. Create a database (New database) and 
   add image files as seed nodes (Add Nodes -> Add files, then select some images). 
3. Open the web detection preset in the Google Cloud Platform category 
4. Set OAuth2 client key and client secret of your Google Cloud vision project (Settings button). 
   In the headers, change the project ID according to your Google Cloud Vision project.
5. Login and fetch data

You can export the resulting data, 
convert it to a gexf file using [Table2Net](https://medialab.github.io/table2net/),
and visualize it with [Gephi Lite](https://gephi.org/gephi-lite/).

Recommended export options: wide format, comma as separator, only the level with the final data.  
For keeping ids, scores and descriptions of the web entities in the network,
 unpack the web entities in Facepager before exporting (-> Extract Data button). 

## Getting started with Jupyter

1. Fire up the containers:
   ```
   docker compose up -d
   ```
2. Open Jupyter at http://localhost:8888

3. Run the notebook BLIP example notebook


The notebooks, data and lib folders are mounted into the Jupyter environment.
You can access data by going up one folder:
```
image_path = "../data/memesgerman/images/msg10.png"
```

You can import scripts directly from the libs folder:
```
from settings import *
```


*I can haz GPU?*
For GPU/CUDA support, adapt the docker-compose.yml to use the DockerfileCuda.
When working in the WSL, you have to install the appropriate Nvidia driver.
Also, rename the container and service to avoid naming conflicts. 
Add a deploy key to provide GPU resources to your containers:    
```
  deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]
```

# Conventions

Please mind, before you commit and push any scripts or notebooks: 
- Use only lowercase filenames, no whitespaces, no special character.
- Remove credentials from the scripts and notebook outputs.
- Remove large data or images from notebook output.
- Don't push data, only skripts.

If you need folders or files not to be pushed to the repository:
All folder named "private" are ignored by git.