import {
  asArray,
  asMap,
  asNumber,
  asObject,
  asOptional,
  asString,
} from "https://deno.land/x/cleaners@v0.3.6/mod.ts";

export const asInstallScript = asObject({
  location: asString,
  env: asOptional(asMap(asString)),
});

export type Config = ReturnType<typeof asConfg>;
export const asConfg = asObject({
  digitalOceanToken: asOptional(asString),
  dropletTag: asOptional(asString),
  topLevelDomain: asOptional(asString),
  hostname: asOptional(asString),
  volumeSizeGb: asOptional(asNumber),
  region: asOptional(asString),
  dropletSize: asOptional(asString),
  couchPassword: asOptional(asString),
  couchMasterCookie: asOptional(asString),
  couchClusterSeedList: asArray(asString),
  sshKeyNames: asOptional(asArray(asString)),
  gitSshKey: asOptional(asString),
  installScripts: asOptional(asArray(asInstallScript)),
  env: asOptional(asMap(asString)),
});
