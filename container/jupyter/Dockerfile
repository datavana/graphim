FROM jupyter/base-notebook:latest

# Install common Python + ML/CV libraries
RUN pip install --no-cache-dir \
    numpy \
    pandas \
    matplotlib \
    seaborn \
    scikit-learn \
    jupyterlab \
    torch \
    torchvision \
    opencv-python \
    pillow \
    scikit-image \
    tqdm \
    albumentations \
    transformers

RUN pip install --no-cache-dir \
    openai

# Optional: if you also want image/video handling
# RUN pip install --no-cache-dir imageio moviepy

# Set PYTHONPATH so "libs" modules are importable
ENV PYTHONPATH="/home/jovyan/work/libs:${PYTHONPATH}"

# Default to JupyterLab
CMD ["start-notebook.sh", "--NotebookApp.token=''"]
