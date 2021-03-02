import {
  asNumber,
  asObject,
  asOptional,
  asString,
} from "https://deno.land/x/cleaners@v0.3.6/mod.ts";

export type Config = ReturnType<typeof asConfg>;
export const asConfg = asObject({
  digitalOceanToken: asOptional(asString),
  topLevelDomain: asOptional(asString),
  hostname: asOptional(asString),
  volumeSizeGb: asOptional(asNumber),
  region: asOptional(asString),
  dropletSize: asOptional(asString),
  couchPassword: asOptional(asString),
  couchMasterCookie: asOptional(asString),
});
