/*
export BURL=https://raw.githubusercontent.com/EdgeApp/edge-devops/master;
deno run \
  --allow-net \
  --allow-read \
  --allow-env \
  --unstable \
  --lock=<(curl -o- "$BURL/lock.json") \
  --cached-only \
  "$BURL/provisions/digitalocean/index.ts" `#--config config.json`
*/

import {
  Confirm,
  List,
  Secret,
} from "https://deno.land/x/cliffy@v0.18.2/prompt/mod.ts";
import { parseFlags } from "https://deno.land/x/cliffy@v0.18.2/flags/mod.ts";
import { asConfg, Config } from "./config.ts";
import {
  asEither,
  asString,
  asUndefined,
} from "https://deno.land/x/cleaners@v0.3.6/mod.ts";
import {
  generateProvisionScript,
  getProvisionSettings,
  provisionServer,
} from "./util.ts";

const MAX_SCRIPT_SIZE = 64 * 1024;

// Config:
let config: Config | undefined;

const { flags } = parseFlags(Deno.args);
const configFileName = asEither(asString, asUndefined)(flags.config);
const skipConfirmation = Boolean(flags.y);

if (configFileName != null) {
  const configFileContent = await Deno.readTextFile(configFileName);
  config = asConfg(JSON.parse(configFileContent));
}

// Provision Settings;
const settings = await getProvisionSettings({
  tag: config?.dropletTag,
  token: config?.digitalOceanToken,
  tld: config?.topLevelDomain,
  hostname: config?.hostname,
  volumeSizeGb: config?.volumeSizeGb,
  region: config?.region,
  dropletSize: config?.dropletSize,
  sshKeyNames: config?.sshKeyNames,
});

// Install Script
let SCRIPT: string | undefined;

if (config?.installScripts != null) {
  const ENV = config?.env ?? {};

  const GITKEY = config?.gitSshKey
    ? await Deno.readTextFile(config?.gitSshKey)
    : "";

  const scripts = await Promise.all(
    config.installScripts.map(async (installScript) => {
      // Env Var:
      const { TLD } = settings;
      const COUCH_MODE = "clustered";
      const COUCH_PASSWORD = config?.couchPassword ?? await Secret.prompt({
        message: "CouchDB password",
        validate: (v) => v.trim() !== "",
      });
      const COUCH_COOKIE = config?.couchMasterCookie ?? await Secret.prompt({
        message: "CouchDB master cookie",
        validate: (v) => v.trim() !== "",
      });
      const COUCH_SEEDLIST = config?.couchClusterSeedList ?? await List.prompt({
        message: "CouchDB cluster seedlist",
        validate: (v) => v.trim() !== "",
      });

      const scriptUrl = new URL(
        `../../${installScript.location}`,
        import.meta.url,
      );

      // User Data Script:
      const script = await generateProvisionScript(
        scriptUrl,
        {
          ...ENV,
          ...installScript.env,
          GITKEY,
          TLD,
          COUCH_MODE,
          COUCH_PASSWORD,
          COUCH_COOKIE,
          COUCH_SEEDLIST: COUCH_SEEDLIST.join(","),
        },
      );

      return [
        bashHeader(`Script: ${scriptUrl}`),
        script,
      ]
        .join("\n");
    }),
  );

  SCRIPT = ["#!/bin/bash", ...scripts].join("\n");

  const scriptSize = new Blob([SCRIPT]).size;

  if (scriptSize > MAX_SCRIPT_SIZE) {
    console.error(
      `Exceeded maximum script size: ${scriptSize} of ${MAX_SCRIPT_SIZE} bytes`,
    );
    Deno.exit(1);
  }
  console.log(SCRIPT);
} else {
  console.log(`No install script.`);
}

const confirmation = skipConfirmation ||
  await Confirm.prompt("Continue with provision?");

// Provision:
if (confirmation) {
  await provisionServer(settings, SCRIPT);
}

function bashHeader(title: string): string {
  const titleLine = `# ${title} #`;
  const line = Array.from({ length: titleLine.length + 1 }).join("#");
  return [line, titleLine, line].join("\n");
}
