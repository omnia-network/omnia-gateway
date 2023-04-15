import crypto from "crypto";
import fetch from "node-fetch";
import { ENV_VARIABLES } from "./../constants/environment.js";

const getNonce = (): string => {
  return crypto.randomBytes(16).toString("hex");
};

export const httpNonceChallenge = async (customFetch: typeof fetch) => {
  const nonce = getNonce();

  const res = await customFetch(
    `${ENV_VARIABLES.OMNIA_BACKEND_HOST_URL}/?canisterId=${ENV_VARIABLES.OMNIA_BACKEND_CANISTER_ID}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        nonce,
      }),
    },
  );

  if (!res.ok) {
    const error = `Unable to send nonce challenge: ${await res.text()}`;
    console.error(error);
    throw new Error(error);
  }

  return nonce;
};
