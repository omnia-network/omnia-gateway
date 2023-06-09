import { ENV_VARIABLES } from "./constants/environment.js";
import { OmniaGateway } from "./services/gateway.js";

const gateway = new OmniaGateway({
  standaloneMode: ENV_VARIABLES.STANDALONE_MODE,
  wotServientPort: parseInt(ENV_VARIABLES.SERVIENT_PORT),
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
