import { ENV_VARIABLES } from "./constants/environment.js";
import { OmniaGateway } from "./gateway.js";

const gateway = new OmniaGateway({
  standaloneMode: ENV_VARIABLES.STANDALONE_MODE,
  exposeSimpleDevice: ENV_VARIABLES.EXPOSE_SIMPLE_DEVICE,

  wotHttpServerConfig: {
    // we should listen only to localhost because NGINX will proxy the requests from the outside
    address: "127.0.0.1",
    port: parseInt(ENV_VARIABLES.SERVIENT_PORT),
  },

  enableMatterController: ENV_VARIABLES.ENABLE_MATTER_CONTROLLER,
  matterControllerChipWsPort: parseInt(
    ENV_VARIABLES.MATTER_CONTROLLER_CHIP_WS_PORT,
  ),
  matterControllerChipToolPath: ENV_VARIABLES.MATTER_CONTROLLER_CHIP_TOOL_PATH,
  wifiSsid: ENV_VARIABLES.WIFI_SSID,
  wifiPassword: ENV_VARIABLES.WIFI_PASSWORD,

  enableProxy: ENV_VARIABLES.ENABLE_PROXY,
  proxyUrl: ENV_VARIABLES.OMNIA_PROXY_URL,
  proxyWgAddress: ENV_VARIABLES.OMNIA_PROXY_WG_ADDRESS,
});

// TODO: handle process termination
// process.on('SIGINT', async () => {
//   console.log("Caught interrupt signal");

//   await gateway.stop();
// });

gateway.start();
