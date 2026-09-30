import { OFFER_TTL_MS } from "./dispatch.config";
import {
  DispatchConfig,
  MIN_OFFER_TIMEOUT_SECONDS,
  MAX_OFFER_TIMEOUT_SECONDS,
} from "./dispatchConfig.model";

/**
 * The offer window every new offer is created with. Read from the database on
 * each offer (offers are infrequent and this is a primary-key lookup), so an
 * admin change applies on every PM2 worker immediately — no cache to go stale.
 *
 * Until an admin has saved a value, DISPATCH_OFFER_TTL_MS stays in charge, so
 * existing deployments and the e2e suite (which shortens it) behave as before.
 */
export async function getOfferTtlMs(): Promise<number> {
  const doc = await DispatchConfig.findById("global").select("offerTimeoutSeconds").lean();
  return doc?.offerTimeoutSeconds ? doc.offerTimeoutSeconds * 1000 : OFFER_TTL_MS;
}

export async function getDispatchConfig(): Promise<{
  offerTimeoutSeconds: number;
  minOfferTimeoutSeconds: number;
  maxOfferTimeoutSeconds: number;
}> {
  return {
    offerTimeoutSeconds: Math.round((await getOfferTtlMs()) / 1000),
    minOfferTimeoutSeconds: MIN_OFFER_TIMEOUT_SECONDS,
    maxOfferTimeoutSeconds: MAX_OFFER_TIMEOUT_SECONDS,
  };
}

/** Applies to offers made after the change; an offer already on screen keeps its original deadline. */
export async function updateDispatchConfig(config: { offerTimeoutSeconds: number }) {
  await DispatchConfig.findByIdAndUpdate(
    "global",
    { $set: { offerTimeoutSeconds: Math.round(config.offerTimeoutSeconds) } },
    { upsert: true, runValidators: true },
  );
  return getDispatchConfig();
}
