# install dependencies
FROM ubuntu:22.04 as base

# Install dependencies
RUN apt update
RUN apt install -y gcc g++ make curl pkg-config libssl-dev libdbus-1-dev \
        libglib2.0-dev libavahi-client-dev \
        unzip libgirepository1.0-dev libcairo2-dev libreadline-dev \
        pi-bluetooth avahi-utils iproute2 wireguard

# Install Node.js
RUN curl -fsSL https://deb.nodesource.com/setup_16.x | bash - &&\
    apt install -y nodejs

# build and run
FROM base as app

WORKDIR /app

# Copy package files
COPY package*.json .
COPY patches/ ./patches

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build
RUN npm run build

ENTRYPOINT ["npm", "start"]
