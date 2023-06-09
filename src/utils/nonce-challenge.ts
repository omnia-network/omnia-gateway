import crypto from "crypto";
import fetch from "node-fetch";
import { ENV_VARIABLES } from "./../constants/environment.js";

const rawUrl = ENV_VARIABLES.DFX_NETWORK === "ic"
  ? new URL(`https://${ENV_VARIABLES.OMNIA_BACKEND_CANISTER_ID}.raw.icp0.io/`)
  : new URL(ENV_VARIABLES.OMNIA_BACKEND_HOST_URL);

const getNonce = (): string => {
  return crypto.randomBytes(16).toString("hex");
};

export const httpNonceChallenge = async (customFetch: typeof fetch) => {
  const nonce = getNonce();

  const ipChallengeUrl = new URL(
    '/ip-challenge',
    rawUrl,
  );

  if (ENV_VARIABLES.DFX_NETWORK !== "ic") {
    ipChallengeUrl.searchParams.append("canisterId", ENV_VARIABLES.OMNIA_BACKEND_CANISTER_ID);
  }

  const res = await customFetch(
    ipChallengeUrl,
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
    const error = `Unable to send nonce challenge (URL: ${ipChallengeUrl.href}): ${await res.text()}`;
    console.error(error);
    throw new Error(error);
  }

  return nonce;
};
