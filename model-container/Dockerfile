FROM python:3.9-slim

WORKDIR /app

COPY requirements.txt .

RUN apt-get update && apt-get install -y \
    build-essential \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# IMPORTANT: pin pip and DON'T upgrade it afterward
RUN python -m pip install \
    "pip==23.3.2" \
    "setuptools<70" \
    wheel

# Verify the version during the build
RUN python -m pip --version

# Install old PyTorch stack
RUN python -m pip install \
    torch==1.12.1 \
    torchvision==0.13.1

# Install Lightning explicitly while we're definitely on old pip
RUN python -m pip install \
    "pytorch-lightning==1.7.7"

# Install your requirements
RUN python -m pip install \
    --no-cache-dir \
    -r requirements.txt

RUN apt-get update && apt-get install -y --no-install-recommends patchelf \
    && patchelf --clear-execstack /usr/local/lib/python3.9/site-packages/torch/lib/libtorch_cpu.so \
    && apt-get purge -y patchelf \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

ENV CUDA_VISIBLE_DEVICES=""

COPY ./app/serve.py .
COPY ./app/inference.py .

EXPOSE 8080

CMD ["python", "serve.py"]