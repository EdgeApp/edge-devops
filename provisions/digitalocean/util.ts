import {
  Checkbox,
  Input,
  Number,
  Secret,
  Select,
} from "https://deno.land/x/cliffy@v0.18.2/prompt/mod.ts";

const DEFAULT_BURL =
  "https://raw.githubusercontent.com/EdgeApp/edge-devops/master";

export interface ProvisionOptions {
  tag?: string;
  token?: string;
  tld?: string;
  hostname?: string;
  volumeSizeGb?: number;
  region?: string;
  dropletSize?: string;
  sshKeyNames?: string[];
}

export interface ProvisionSettings {
  TAG?: string;
  TOKEN: string;
  TLD: string;
  HOST: string;
  HOST_INTERNAL: string;
  DOMAIN: string;
  DOMAIN_INTERNAL: string;
  VOLUME_SIZE: number;
  REGION: string;
  SIZE: string;
  SSH_KEY_IDS: number[];
}

export async function getProvisionSettings(
  opt?: ProvisionOptions,
): Promise<ProvisionSettings> {
  // Tag:
  const TAG = opt?.tag;

  // Token:
  const TOKEN = opt?.token ?? await Secret.prompt({
    message: "DigitalOcean API key",
    validate: (v) => v.trim() !== "",
  });

  const headers = getFetchHeaders(TOKEN);

  // Top-level Domain:
  const TLD = opt?.tld ?? await Input.prompt({
    message: "Enter top-level domain",
    default: "edge.app",
  });

  // Hostname and Domain Name:
  const HOST = opt?.hostname ?? await Input.prompt({
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
  if (await isDropletNameUsed(TOKEN, DOMAIN)) {
    console.error(`Droplet name already used`);
    Deno.exit(1);
  }

  // Check domain records:
  const domainRecords = await getDomainRecords(TOKEN, TLD, [
    DOMAIN,
    DOMAIN_INTERNAL,
  ]);

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
  const VOLUME_SIZE = opt?.volumeSizeGb ?? await Number.prompt({
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

  const REGION = opt?.region ?? (await Select.prompt({
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
    (regionsResBody.regions).find((obj: { slug: string }) =>
      obj.slug === REGION
    )
      .sizes;

  const sizesResBody = await fetch(
    "https://api.digitalocean.com/v2/sizes",
    {
      headers,
    },
  ).then((res) => res.json());

  type Size = {
    slug: string;
    memory: number;
    vcpus: number;
    disk: number;
    transfer: number;
    // deno-lint-ignore camelcase
    price_monthly: number;
    available: boolean;
  };

  const sizes: Size[] = sizesResBody.sizes.filter((
    size: Size,
  ) => regionSizeSlugs.includes(size.slug) && size.available);

  const SIZE = opt?.dropletSize ?? (await Select.prompt({
    message: "Select Droplet Size",
    options: sizes.map((
      size,
    ) => ({
      name:
        `${size.slug} | $${size.price_monthly}/mo | ${size.memory} MB RAM | ${size.vcpus} vCPUs | ${size.disk} GB Disk | ${size.transfer} TB transfer`,
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

  const sshKeyObjects: { name: string; id: number }[] =
    accountKeysResBody.ssh_keys;

  // Map of key name to ssh key object ID (e.g. `{ "Paul Puey": 123456789 }` )
  const accountKeysMap = sshKeyObjects.reduce(
    (map: { [name: string]: number }, sshKeyObj) => {
      map[sshKeyObj.name] = sshKeyObj.id;
      return map;
    },
    {},
  );

  // Use the sshKeyNames opt if present otherwise prompt for ssh key names
  const selectedSshKeyNames =
    (opt?.sshKeyNames != null ? opt.sshKeyNames : await Checkbox.prompt({
      message: "Select SSH Keys",
      minOptions: 1,
      options: sshKeyObjects.map((
        sshKeyObj,
      ) => ({
        name: sshKeyObj.name,
        value: sshKeyObj.name,
      })),
    }));

  // Map over the accountKeysMap using the selected names as the entry key
  const SSH_KEY_IDS: number[] = selectedSshKeyNames.map((sshKeyName) => {
    const sshKeyId = accountKeysMap[sshKeyName];

    if (sshKeyId == null) {
      console.error(`Unable to find SSH key for "${sshKeyName}"`);
      Deno.exit(1);
    }

    return sshKeyId;
  });

  return {
    TAG,
    TOKEN,
    TLD,
    HOST,
    HOST_INTERNAL,
    DOMAIN,
    DOMAIN_INTERNAL,
    VOLUME_SIZE,
    REGION,
    SIZE,
    SSH_KEY_IDS,
  };
}

export async function generateProvisionScript(
  scriptUrl: URL,
  envVars: Record<string, string> = {},
): Promise<string> {
  const scriptContent = await getFile(scriptUrl);

  envVars.BURL = Deno.env.get("BURL") ?? DEFAULT_BURL;

  const envs = Object.entries(envVars).map(
    ([name, value]) => {
      return `export ${name}="${value}"`;
    },
  );
  const envScript = envs.join("\n");
  const envExports = `export ENV_EXPORTS='${envs.join(";")}'`;

  return [`#!/bin/bash`, envExports, envScript, scriptContent].join("\n");
}

export async function provisionServer(
  config: ProvisionSettings,
  script?: string,
) {
  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${config.TOKEN}`,
  };

  // Create Volume:
  const volumeName = `volume--${config.DOMAIN.replace(/\./g, "-dot-")}`;

  console.log(`Creating volume '${volumeName}'...`);

  const createVolumeRes = await fetch(
    "https://api.digitalocean.com/v2/volumes",
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        size_gigabytes: config.VOLUME_SIZE,
        name: volumeName,
        region: config.REGION,
      }),
    },
  );

  if (createVolumeRes.status !== 201) {
    console.error(await createVolumeRes.text());
    Deno.exit(1);
  }

  const createVolumeResBody = await createVolumeRes.json();

  const volumeId = createVolumeResBody.volume.id;

  // Create Droplet:
  console.log(`Creating droplet '${config.DOMAIN}'....`);

  const createDropletRes = await fetch(
    "https://api.digitalocean.com/v2/droplets",
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: config.DOMAIN,
        region: config.REGION,
        size: config.SIZE,
        ssh_keys: config.SSH_KEY_IDS,
        user_data: script,
        volumes: [volumeId],
        image: "ubuntu-20-04-x64",
        ipv6: true,
        monitoring: true,
        tags: [config.TAG],
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
      ipv4Private =
        networks.v4.find((ipObj: IpObj) => ipObj.type === "private").ip_address;
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
    addDomainRecord(config.TOKEN, config.TLD, "A", config.HOST, ipv4),
    addDomainRecord(
      config.TOKEN,
      config.TLD,
      "A",
      config.HOST_INTERNAL,
      ipv4Private,
    ),
    addDomainRecord(config.TOKEN, config.TLD, "AAAA", config.HOST, ipv6),
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

  console.log("Droplet successfully created!");

  // Check for Droplet access
}

export function getFile(url: URL): Promise<string> {
  if (url.protocol === "file:") {
    return Deno.readFile(url.pathname).then((bytes) =>
      new TextDecoder("utf8").decode(bytes)
    );
  } else {
    return fetch(url).then((res) => res.text());
  }
}

// ---------------------------------------------------------------------
// Private Functions
// ---------------------------------------------------------------------

function addDomainRecord(
  token: string,
  hostname: string,
  type: "A" | "AAAA",
  domain: string,
  ip: string,
) {
  return fetch(`https://api.digitalocean.com/v2/domains/${hostname}/records`, {
    method: "POST",
    headers: getFetchHeaders(token),
    body: JSON.stringify({
      type,
      name: domain,
      data: ip,
      priority: null,
      port: null,
      ttl: 900,
      weight: null,
      flags: null,
    }),
  });
}

type DomainRecord = {
  id: number;
  type: string;
  name: string;
  data: string;
};

async function getDomainRecords(
  token: string,
  hostname: string,
  domains: string[],
): Promise<DomainRecord[]> {
  return (await Promise.all(
    domains.map(
      (domain) =>
        fetch(
          `https://api.digitalocean.com/v2/domains/${hostname}/records?name=${domain}`,
          { headers: getFetchHeaders(token) },
        ).then((res) => res.json()),
    ),
  )).flatMap((response) => response.domain_records);
}

async function isDropletNameUsed(
  token: string,
  dropletName: string,
): Promise<boolean> {
  const paginator = (
    url: string,
  ): Promise<{ droplets: { name: string }[] }> =>
    fetch(
      url,
      {
        method: "GET",
        headers: getFetchHeaders(token),
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

function getFetchHeaders(token: string) {
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`,
  };
}
