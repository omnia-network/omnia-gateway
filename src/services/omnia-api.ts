import { ENV_VARIABLES } from "../constants/environment.js";
import { omnia_backend } from "../canisters/omnia_backend";

ENV_VARIABLES

const omniaBackend = omnia_backend.getProfile();

console.log(omniaBackend);
