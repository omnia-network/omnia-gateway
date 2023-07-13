import crypto from "crypto";
import fetch from "node-fetch";

const {
  DFX_NETWORK = "local",
  OMNIA_BACKEND_HOST_URL = "",
  OMNIA_BACKEND_CANISTER_ID = "",
} = process.env;

export const getUrl = (): URL => {
  if (DFX_NETWORK === "ic") {
    return new URL("https://icp0.io");
  }

  return new URL(OMNIA_BACKEND_HOST_URL);
};

const getRawUrl = (): URL => {
  if (DFX_NETWORK === "ic") {
    return new URL(`https://${OMNIA_BACKEND_CANISTER_ID}.raw.icp0.io/`);
  }

  return new URL(OMNIA_BACKEND_HOST_URL);
};

const getNonce = (): string => {
  return crypto.randomBytes(16).toString("hex");
};

export const httpNonceChallenge = async (customFetch: typeof fetch) => {
  const nonce = getNonce();

  const ipChallengeUrl = new URL("/ip-challenge", getRawUrl());

  if (DFX_NETWORK !== "ic") {
    ipChallengeUrl.searchParams.append("canisterId", OMNIA_BACKEND_CANISTER_ID);
  }

  const res = await customFetch(ipChallengeUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      nonce,
    }),
  });

  if (!res.ok) {
    const error = `Unable to send nonce challenge (URL: ${
      ipChallengeUrl.href
    }): ${await res.text()}`;
    console.error(error);
    throw new Error(error);
  }

  return nonce;
};
