import { ENV_VARIABLES } from "./constants/environment.js";
import { OmniaGateway } from "./services/gateway.js";

const gateway = new OmniaGateway({
  standaloneMode: ENV_VARIABLES.STANDALONE_MODE,
  exposeSimpleDevice: ENV_VARIABLES.EXPOSE_SIMPLE_DEVICE,

  wotHttpServerConfig: {
    // we should listen only to localhost because NGINX will proxy the requests from the outside
    address: "127.0.0.1",
    port: parseInt(ENV_VARIABLES.SERVIENT_PORT),
  },

  matterControllerChipWsPort: parseInt(
    ENV_VARIABLES.MATTER_CONTROLLER_CHIP_WS_PORT,
  ),
  matterControllerChipToolPath: ENV_VARIABLES.MATTER_CONTROLLER_CHIP_TOOL_PATH,
  useProxy: ENV_VARIABLES.USE_PROXY,
});

// TODO: handle process termination
// process.on('SIGINT', async () => {
//   console.log("Caught interrupt signal");

//   await gateway.stop();
// });

gateway.start();
