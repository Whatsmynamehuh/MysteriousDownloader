FROM golang:1.23-alpine AS builder

RUN apk add --no-cache git build-base
WORKDIR /build
RUN git clone https://github.com/zhaarey/apple-music-downloader.git .
RUN go build -o apple-music-downloader main.go

FROM python:3.11-alpine

# Install runtime dependencies
# gcompat is CRITICAL for running glibc binaries (like the one in the .deb) on Alpine
RUN apk add --no-cache ffmpeg nodejs npm gcompat libstdc++ wget unzip tar git binutils xz zstd

# Argument for architecture
ARG TARGETARCH

# Install Bento4 and GPAC in a temporary directory
WORKDIR /tmp/install

# Install Bento4 (User provided link for x86_64)
RUN echo "Installing Bento4..." && \
    wget -O bento4.zip https://www.bok.net/Bento4/binaries/Bento4-SDK-1-6-0-641.x86_64-unknown-linux.zip && \
    unzip bento4.zip && \
    mkdir -p /usr/local/bin && \
    cp -r Bento4-SDK-*/bin/* /usr/local/bin/ && \
    rm -rf Bento4-SDK-* bento4.zip

# Install GPAC (User provided link for x86_64 .deb)
# We extract the .deb manually since apk doesn't support it.
# We handle different compression formats (xz, gz, zst).
RUN echo "Installing GPAC..." && \
    wget -O gpac.deb https://download.tsi.telecom-paristech.fr/gpac/new_builds/gpac_latest_head_linux64.deb && \
    ar x gpac.deb && \
    # Find the data tarball
    DATA_TAR=$(ls data.tar.*) && \
    echo "Found data archive: $DATA_TAR" && \
    # Extract based on extension or let tar auto-detect if supported
    if echo "$DATA_TAR" | grep -q ".zst"; then \
        unzstd "$DATA_TAR" -o data.tar && tar -xf data.tar; \
    else \
        tar -xf "$DATA_TAR"; \
    fi && \
    # Copy binaries
    cp -r usr/bin/* /usr/local/bin/ && \
    # Copy libraries (handle lib vs lib64)
    if [ -d "usr/lib" ]; then cp -r usr/lib/* /usr/local/lib/; fi && \
    if [ -d "usr/lib64" ]; then cp -r usr/lib64/* /usr/local/lib/; fi && \
    # Copy shared resources
    if [ -d "usr/share" ]; then cp -r usr/share/* /usr/local/share/; fi && \
    # Cleanup
    cd / && rm -rf /tmp/install

# Clone Wrapper Repo (to get rootfs and other assets)
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
# (We stay in /app which now has wrapper repo contents)
COPY --from=builder /build/apple-music-downloader /usr/local/bin/apple-music-downloader

# Install Python dependencies
RUN pip install fastapi uvicorn websockets requests PyYAML ruamel.yaml

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
CMD ["python", "web_server.py"]