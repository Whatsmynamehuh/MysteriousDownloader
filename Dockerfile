FROM golang:1.23-bookworm AS builder

RUN apt-get update && apt-get install -y git build-essential
WORKDIR /build
RUN git clone https://github.com/zhaarey/apple-music-downloader.git .
RUN go build -o apple-music-downloader main.go

FROM ubuntu:24.04

# Prevent interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Install runtime dependencies
# Ubuntu 24.04 includes FFmpeg 6.x (libavcodec60), which is required by the user's GPAC .deb
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    ffmpeg \
    nodejs \
    npm \
    wget \
    unzip \
    tar \
    git \
    binutils \
    xz-utils \
    zstd \
    && rm -rf /var/lib/apt/lists/*

# Argument for architecture
ARG TARGETARCH

# Install Bento4 (User provided link)
WORKDIR /tmp/install
RUN echo "Installing Bento4..." && \
    wget -O bento4.zip https://www.bok.net/Bento4/binaries/Bento4-SDK-1-6-0-641.x86_64-unknown-linux.zip && \
    unzip bento4.zip && \
    mkdir -p /usr/local/bin && \
    cp -r Bento4-SDK-*/bin/* /usr/local/bin/ && \
    rm -rf Bento4-SDK-* bento4.zip

# Install GPAC (User provided link)
# We use apt-get install ./gpac.deb. This works on Ubuntu 24.04 because it has the required newer libraries.
RUN echo "Installing GPAC..." && \
    wget -O gpac.deb https://download.tsi.telecom-paristech.fr/gpac/new_builds/gpac_latest_head_linux64.deb && \
    apt-get update && apt-get install -y ./gpac.deb && \
    rm gpac.deb && \
    # Create a lowercase symlink just in case some tools look for 'mp4box'
    ln -s /usr/bin/MP4Box /usr/local/bin/mp4box && \
    rm -rf /var/lib/apt/lists/*

# Clone Wrapper Repo
WORKDIR /app
RUN git clone https://github.com/zhaarey/wrapper.git .

# Download wrapper binary
RUN echo "Building for architecture: $TARGETARCH" && \
    if [ "$TARGETARCH" = "arm64" ]; then \
      wget -O wrapper.zip https://github.com/zhaarey/wrapper/releases/download/arm64/Wrapper.arm64.zip && \
      unzip wrapper.zip && \
      mv Wrapper.arm64 wrapper && \
      rm wrapper.zip; \
    else \
      wget -O wrapper.tar.gz https://github.com/zhaarey/wrapper/releases/download/linux.V2/wrapper.x86_64.tar.gz && \
      tar -xzf wrapper.tar.gz && \
      if [ -f wrapper ]; then echo "Found wrapper"; else echo "Assuming wrapper extracted"; fi && \
      rm wrapper.tar.gz; \
    fi

RUN chmod +x wrapper

# Setup application directory
COPY --from=builder /build/apple-music-downloader /usr/local/bin/apple-music-downloader

# Install Python dependencies
# Use --break-system-packages because Ubuntu 24.04 enforces PEP 668
RUN pip3 install --break-system-packages fastapi uvicorn websockets requests PyYAML ruamel.yaml

# Copy application files
COPY web_server.py .
COPY index.html .
COPY static ./static

# Create directories for volumes
RUN mkdir -p /app/config /app/downloads /app/wrapper_data
RUN chmod -R 777 /app

# Expose ports (Web UI + Wrapper)
EXPOSE 5000 10020

# Run the web server
CMD ["python3", "web_server.py"]