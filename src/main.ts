import { ENV_VARIABLES } from "./constants/environment.js";
import { OmniaGateway } from "./services/gateway.js";

const gateway = new OmniaGateway({
  wotServientPort: parseInt(ENV_VARIABLES.SERVIENT_PORT),
  matterControllerChipWsPort: parseInt(
    ENV_VARIABLES.MATTER_CONTROLLER_CHIP_WS_PORT,
  ),
  matterControllerChipToolPath: ENV_VARIABLES.MATTER_CONTROLLER_CHIP_TOOL_PATH,
});

gateway.start();
