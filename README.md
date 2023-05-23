# Omnia Gateway
The **Omnia Gateway** is a core component of the Omnia Network. It handles the communication between the [Omnia Backend](https://github.com/omnia-network/omnia-backend) and the IoT devices.

We suggest reading the [Architecture](https://github.com/omnia-network/omnia-backend/blob/main/docs/architecture.md) document to understand how the Omnia Network works before diving into the code.

## Considerations
The Omnia Gateway is written in **Typescript**, mainly because the most popular and more maintained Web of Things (WoT) library is [node-wot](https://github.com/eclipse-thingweb/node-wot). The plans are to migrate to Rust in the future.

### IoT protocols support
In the current version, the Omnia Gateway supports [Matter](https://csa-iot.org/all-solutions/matter/) only, but the plans are to expand to any other relevant IoT protocol.

We want to expand the support to **HTTP**, so that the Omnia Gateway can be deployed on top of any other IoT gateway that already handles the IoT protocol of that specific use case.

## Getting started
The current version has been tested on a **Raspberry Pi 4** (with *Ubuntu Server 22.04 LTS (64-bit)* OS).

### Prerequisites
- [Node.js](https://nodejs.org/en/) (v16.14.1 or higher)
- [npm](https://www.npmjs.com/) (v8.5.5)
- [Docker](https://www.docker.com/) (v23.0.6 or higher)
- [Docker Compose](https://docs.docker.com/compose/) (v2.17.2 or higher)
- a [chip-tool](https://github.com/project-chip/connectedhomeip/blob/master/docs/guides/chip_tool_guide.md) binary (the Matter Controller) for the Raspberry Pi 4 (see [Building Matter](https://github.com/project-chip/connectedhomeip/blob/master/docs/guides/BUILDING.md) guide and pay attention to [Prerequisites on Raspberry Pi 4](https://github.com/project-chip/connectedhomeip/blob/master/docs/guides/BUILDING.md#installing-prerequisites-on-raspberry-pi-4))

### Configuration
Copy the `.env.example` file to `.env` and fill in the required values.

The following environment variables need an explanation:
- `MATTER_CONTROLLER_CHIP_TOOL_PATH` is the path to the Matter Controller binary (the chip-tool mentioned in the prerequisites)
- `DISABLE_MATTER_CONTROLLER` is a flag to disable the Matter Controller (useful for development purposes when the Matter Controller is not available)
- `WIFI_SSID` and `WIFI_PASSWORD` are the credentials of the WiFi network to which the Gateway is connected to. This is used to configure Matter Devices during the commissioning process.
- `USE_PROXY` is a flag to enable the use of the [Omnia Proxy](https://github.com/omnia-network/omnia-proxy). This is particularly useful when the Gateway is deployed on a local network and it's not reachable from the Internet. See [Omnia Proxy](https://github.com/omnia-network/omnia-proxy) for details on how to configure the other required variables.
- `DFX_NETWORK`: in the current version the only supported IC replica is the local one, available when running `dfx start`. See [Omnia Backend](https://github.com/omnia-network/omnia-backend) for details.

### Running (Docker)
We suggest running the Omnia Gateway using Docker, so that an [NGINX reverse proxy](https://docs.nginx.com/nginx/admin-guide/web-server/reverse-proxy/) can be used to handle the HTTPS communication from [Internet Computer Canisters](https://internetcomputer.org/how-it-works/canister-lifecycle/).

Make sure Docker engine is running and then run the following command:
```bash
docker compose up
```
This will build the Gateway Docker image and run it.

## License
Licensed under the [MIT License](./LICENSE).

### Dependencies report
To generate a report of all dependencies licenses, run the following command:
```bash
npm run report:licenses
```
