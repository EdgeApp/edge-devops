/*
deno run \
  --allow-net \
  --allow-read \
  --unstable \
  --lock=<(curl -o- https://raw.githubusercontent.com/EdgeApp/edge-devops/master/provisions/sync-server-digitalocean/lock.json) \
  --cached-only \
  https://raw.githubusercontent.com/EdgeApp/edge-devops/master/provisions/sync-server-digitalocean/index.ts
*/

import {
  Checkbox,
  Input,
  Number,
  Secret,
  Select,
} from "https://deno.land/x/cliffy@v0.17.2/prompt/mod.ts";
import { parseFlags } from "https://deno.land/x/cliffy@v0.17.2/flags/mod.ts";
import { asConfg, Config } from "./config.ts";
import {
  asEither,
  asString,
  asUndefined,
} from "https://deno.land/x/cleaners@v0.3.6/mod.ts";

// Config file:

let config: Config | undefined;

const { flags } = parseFlags(Deno.args);
const configFileName = asEither(asString, asUndefined)(flags.config);

if (configFileName != null) {
  const configFileContent = await Deno.readTextFile(configFileName);
  config = asConfg(JSON.parse(configFileContent));
}

// Tag:

const TAG = "sync";

// Token:

const TOKEN = config?.digitalOceanToken ?? await Secret.prompt({
  message: "DigitalOcean API key",
  validate: (v) => v.trim() !== "",
});

// Top-level Domain:

const TLD = config?.topLevelDomain ?? await Input.prompt({
  message: "Enter top-level domain",
  default: "edge.app",
});

const headers = {
  "Content-Type": "application/json",
  "Authorization": `Bearer ${TOKEN}`,
};

// Hostname and Domain Name:

const HOST = config?.hostname ?? await Input.prompt({
  message: `Hostname (<hostname>.${TLD})`,
  validate: (v) => /^[\w\d\-]+$/.test(v),
});
const DOMAIN = `${HOST}.${TLD}`;

// Internal Hostname and Domain name:

const hostnameLevels = HOST.split(".");
const bottomLevel = hostnameLevels.shift();
const HOST_INTERNAL = [`${bottomLevel}-int`, ...hostnameLevels].join(".");
const DOMAIN_INTERNAL = `${HOST_INTERNAL}.${TLD}`;

// Check droplet name:

if (await isDropletNameUsed(DOMAIN)) {
  console.error(`Droplet name already used`);
  Deno.exit(1);
}

// Check domain records:

const domainRecords = await getDomainRecords([DOMAIN, DOMAIN_INTERNAL]);

if (domainRecords.length > 0) {
  for (const domainRecord of domainRecords) {
    const type = domainRecord.type;
    const domain = `${domainRecord.name}.${TLD}`;
    const action = await Select.prompt({
      message: `${type} record for '${domain}' already exists`,
      options: [
        {
          name: "Exit",
          value: "exit",
        },
        {
          name: "Replace",
          value: "replace",
        },
      ],
    });

    if (action === "exit") {
      Deno.exit(0);
    }

    if (action === "replace") {
      const res = await fetch(
        `https://api.digitalocean.com/v2/domains/${TLD}/records/${domainRecord.id}`,
        {
          method: "DELETE",
          headers,
        },
      );

      if (res.status !== 204) {
        console.error(await res.text());
        Deno.exit(1);
      }
    }
  }
}

// Volume Size:

const VOLUME_SIZE = config?.volumeSizeGb ?? await Number.prompt({
  message: "Volume size (GB)",
  min: 0,
  max: 2000,
});

// Regions:

const regionsResBody = await fetch(
  "https://api.digitalocean.com/v2/regions",
  {
    headers,
  },
).then((res) => res.json());

const REGION = config?.region ?? (await Select.prompt({
  message: "Select Region",
  options: regionsResBody.regions.map((
    obj: { name: string; slug: string },
  ) => ({
    name: obj.name,
    value: obj.slug,
  })),
}));

// Size:

const regionSizeSlugs =
  (regionsResBody.regions).find((obj: { slug: string }) => obj.slug === REGION)
    .sizes;

const sizesResBody = await fetch(
  "https://api.digitalocean.com/v2/sizes",
  {
    headers,
  },
).then((res) => res.json());

type Size = { slug: string; available: boolean };

const sizes: Size[] = sizesResBody.sizes.filter((
  size: Size,
) => regionSizeSlugs.includes(size.slug) && size.available);

const SIZE = config?.dropletSize ?? (await Select.prompt({
  message: "Select Droplet Size",
  options: sizes.map((
    size,
  ) => ({
    name: size.slug,
    value: size.slug,
  })),
}));

// SSH Keys:

const accountKeysResBody = await fetch(
  "https://api.digitalocean.com/v2/account/keys",
  {
    headers,
  },
).then((res) => res.json());

const SSH_KEY_IDS: number[] = (await Checkbox.prompt({
  message: "Select SSH Keys",
  minOptions: 1,
  options: accountKeysResBody.ssh_keys.map((
    obj: { name: string; id: number },
  ) => ({
    name: obj.name,
    value: String(obj.id),
  })),
})).map((value: string) => parseInt(value));

// Couch Info:

const COUCH_PASSWORD = config?.couchPassword ?? await Secret.prompt({
  message: "CouchDB password",
  validate: (v) => v.trim() !== "",
});
const COUCH_COOKIE = config?.couchMasterCookie ?? await Secret.prompt({
  message: "CouchDB master cookie",
  validate: (v) => v.trim() !== "",
});

// User Data Script:

const scriptUrl = new URL("../install-sync-digitalocean.sh", import.meta.url);
const scriptContent = await getFile(scriptUrl);
const SCRIPT = `#!/bin/bash
export COUCH_MODE="clustered"
export COUCH_PASSWORD="${COUCH_PASSWORD}"
export COUCH_COOKIE="${COUCH_COOKIE}"
${scriptContent}
`;

// Create Volume:

const volumeName = `volume--${DOMAIN.replace(/\./g, "-dot-")}`;

console.log(`Creating volume '${volumeName}'...`);

const createVolumeRes = await fetch("https://api.digitalocean.com/v2/volumes", {
  method: "POST",
  headers,
  body: JSON.stringify({
    size_gigabytes: VOLUME_SIZE,
    name: volumeName,
    region: REGION,
  }),
});

if (createVolumeRes.status !== 201) {
  console.error(await createVolumeRes.text());
  Deno.exit(1);
}

const createVolumeResBody = await createVolumeRes.json();

const volumeId = createVolumeResBody.volume.id;

// Create Droplet:

console.log(`Creating droplet '${DOMAIN}'....`);

const createDropletRes = await fetch(
  "https://api.digitalocean.com/v2/droplets",
  {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: DOMAIN,
      region: REGION,
      size: SIZE,
      ssh_keys: SSH_KEY_IDS,
      user_data: SCRIPT,
      volumes: [volumeId],
      image: "ubuntu-20-04-x64",
      ipv6: true,
      monitoring: true,
      tags: [TAG],
    }),
  },
);

if (createDropletRes.status !== 202) {
  console.error(await createDropletRes.text());
  Deno.exit(1);
}

const createDropletResBody = await createDropletRes.json();
const dropletId = createDropletResBody.droplet.id;

let tries = 0;
let ipv4: string | undefined;
let ipv4Private: string | undefined;
let ipv6: string | undefined;

do {
  ++tries;
  console.log("Waiting for droplet creation...");
  await new Promise((resolve, reject) => setTimeout(resolve, 1000));

  const getDropletResBody = await fetch(
    `https://api.digitalocean.com/v2/droplets/${dropletId}`,
    {
      headers,
    },
  ).then((res) => res.json());

  const networks = getDropletResBody.droplet.networks;

  type IpObj = {
    // deno-lint-ignore camelcase
    ip_address: string;
    type: "public" | "private";
  };

  if (networks.v4.length) {
    ipv4 = networks.v4.find((ipObj: IpObj) =>
      ipObj.type === "public"
    ).ip_address;
    ipv4Private = networks.v4.find((ipObj: IpObj) =>
      ipObj.type === "private"
    ).ip_address;
  }

  if (networks.v6.length) {
    ipv6 = networks.v6.find((ipObj: IpObj) =>
      ipObj.type === "public"
    ).ip_address;
  }

  if (tries > 10) {
    console.error(`Droplet creation timeout exceeded`);
    Deno.exit;
  }
} while (!ipv4 || !ipv6 || !ipv4Private);

console.log("Creating domain records...");

const createDomainRecordResponses = await Promise.all([
  addDomainRecord("A", HOST, ipv4),
  addDomainRecord("A", HOST_INTERNAL, ipv4Private),
  addDomainRecord("AAAA", HOST, ipv6),
]);

const errTexts = (await Promise.all(createDomainRecordResponses.map(
  async (createDomainRecordRes) => {
    if (createDomainRecordRes.status !== 201) {
      return (await createDomainRecordRes.text());
    }
  },
))).filter((errText) => errText != null);

if (errTexts.length > 0) {
  errTexts.map((errText) => console.error(errText));
  Deno.exit(1);
}

console.log("done!");

// Functions:

function addDomainRecord(type: "A" | "AAAA", domain: string, ip: string) {
  return fetch(`https://api.digitalocean.com/v2/domains/${TLD}/records`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      type,
      name: domain,
      data: ip,
      priority: null,
      port: null,
      ttl: 900,
      weight: null,
      flags: null,
      tag: TAG,
    }),
  });
}

function getFile(url: URL): Promise<string> {
  if (url.protocol === "file:") {
    return Deno.readFile(url.pathname).then((bytes) =>
      new TextDecoder("utf8").decode(bytes)
    );
  } else {
    return fetch(url).then((res) => res.text());
  }
}

type DomainRecord = {
  id: number;
  type: string;
  name: string;
  data: string;
};

async function getDomainRecords(domains: string[]): Promise<DomainRecord[]> {
  return (await Promise.all(
    domains.map(
      (domain) =>
        fetch(
          `https://api.digitalocean.com/v2/domains/${TLD}/records?name=${domain}`,
          { headers },
        ).then((res) => res.json()),
    ),
  )).flatMap((response) => response.domain_records);
}

async function isDropletNameUsed(dropletName: string): Promise<boolean> {
  const paginator = (url: string): Promise<{ droplets: { name: string }[] }> =>
    fetch(
      url,
      {
        method: "GET",
        headers,
      },
    ).then((res) => res.json()).then(async (res) =>
      res.links?.pages?.next != null
        ? {
          ...res,
          droplets: [
            ...res.droplets,
            ...await paginator(res.links.pages.next).then((res) =>
              res.droplets
            ),
          ],
        }
        : res
    );

  const getDropletResponse = await paginator(
    `https://api.digitalocean.com/v2/droplets?per_page=200`,
  );

  const droplets: { name: string }[] = getDropletResponse.droplets;

  return droplets.some(({ name }) => name === dropletName);
}
