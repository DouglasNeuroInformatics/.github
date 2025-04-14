// @ts-check

const fs = require('node:fs');
const path = require('node:path');

const yaml = require('../vendor/js-yaml.cjs');

const GITHUB_WORKSPACE = /** @type {string} */ (process.env.GITHUB_WORKSPACE);
if (!GITHUB_WORKSPACE) {
  throw new Error("Expected environment variable 'GITHUB_WORKSPACE' to be defined");
}

const VERSION_TAG_REGEX = /^v(\d+\.\d+\.\d+(-(alpha|beta)\.\d+)?)$/;

/** @typedef {{ org: string; packages: string; }} Inputs */

/** @typedef {import('github-script').AsyncFunctionArguments} AsyncFunctionArguments */

/** @typedef {Awaited<ReturnType<AsyncFunctionArguments['github']['rest']['packages']['getAllPackageVersionsForPackageOwnedByOrg']>>['data'][number]} PackageInfo */

/** @typedef {{ dockerfile: string, image: string }} DockerServiceInfo */

/**
 * Returns whether the argument is an object
 * @param {unknown} arg
 * @returns {arg is {[key: string]: any}}
 */
function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

/**
 * Load a file from the workspace
 * @param {string} filename
 * @returns {string}
 */
function loadFile(filename) {
  if (!fs.readdirSync(GITHUB_WORKSPACE).includes(filename)) {
    throw new Error(`Could not find file '${filename}' in directory: ${GITHUB_WORKSPACE}`);
  }
  return fs.readFileSync(path.join(GITHUB_WORKSPACE, filename), 'utf-8');
}

/**
 * Load the package.json file for the repository
 * @returns {{ [key: string]: any }}
 */
function loadPackageJson() {
  return JSON.parse(loadFile('package.json'));
}

/**
 *
 * @param {string} packageName
 * @param { {[key: string]: any }} services
 * @returns {DockerServiceInfo}
 */
function extractServiceInfo(packageName, services) {
  const serviceNames = Object.keys(services);
  for (const key of serviceNames) {
    const service = services[key];
    if (!isObject(service)) {
      throw new Error(`Unexpected entry for docker compose service '${key}': expected object`);
    } else if (typeof service.image !== 'string') {
      continue;
    } else if (!isObject(service.build)) {
      continue;
    }

    const dockerfile = service.build.dockerfile;
    if (typeof dockerfile !== 'string') {
      throw new Error(`Expected build property for service '${key}' to specify property 'dockerfile' as string`);
    }

    const image = /** @type {string} */ (service.image.split(':')[0]);
    const imageName = image.split('/').at(-1);
    if (imageName === packageName) {
      return { dockerfile, image };
    }
  }
  throw new Error(`Could not find entry for package '${packageName}' in services: ${serviceNames.join(', ')}`);
}

/**
 * Load the docker-compose.yaml file for the repository
 * @param {string[]} packageNames
 * @returns {DockerServiceInfo[]}
 */
function parseDockerCompose(packageNames) {
  const filename = 'docker-compose.yaml';
  /** @type {any} */
  const compose = yaml.load(loadFile(filename));
  if (!isObject(compose)) {
    throw new Error(`Expected content of '${filename}' to be object`);
  } else if (!compose.services) {
    throw new Error(`Expected '${filename}' to have property 'services'`);
  } else if (!isObject(compose.services)) {
    throw new Error(`Expected property 'services' in '${filename}' to be object`);
  }
  const results = [];
  for (const packageName of packageNames) {
    results.push(extractServiceInfo(packageName, compose.services));
  }
  return results;
}

/**
 * Extract a list of tags for a package
 * @param {PackageInfo} packageInfo
 * @returns {string[]}
 */
function parseTags(packageInfo) {
  const tags = packageInfo.metadata?.container?.tags;
  if (!tags) {
    throw new Error(`Package '${packageInfo.name}' missing expected tags property 'metadata.container.tags'`);
  } else if (!tags.length) {
    throw new Error(`Package '${packageInfo.name}' contains zero tags`);
  }
  return tags;
}

/**
 * Get the package info for the latest release of a package
 * @param {object} arg
 * @param {AsyncFunctionArguments['github']} arg.github
 * @param {string} arg.org
 * @param {string} arg.packageName
 * @returns {Promise<PackageInfo>}
 */
async function getLatestVersionForPackage({ github, org, packageName }) {
  const response = await github.rest.packages.getAllPackageVersionsForPackageOwnedByOrg({
    org,
    package_name: packageName,
    package_type: 'container'
  });
  if (response.status !== 200) {
    throw new Error(`Unexpected status code '${response.status}' for request to url '${response.url}'`);
  }
  const latestPackage = response.data.find((item) => parseTags(item).includes('latest'));
  if (!latestPackage) {
    throw new Error(`Failed to find package '${packageName}' with tag 'latest'`);
  }
  return latestPackage;
}

/**
 * Extract the version tag for a package
 * @param {PackageInfo} packageInfo
 * @returns {null | string}
 */
function extractPackageVersionTag(packageInfo) {
  const tags = parseTags(packageInfo);
  for (const tag of tags) {
    const match = VERSION_TAG_REGEX.exec(tag)?.[1];
    if (match) {
      return match;
    }
  }
  return null;
}

/**
 @param {AsyncFunctionArguments & { inputs: Inputs }} args
 @returns {Promise<null | string>}
 */
module.exports = async function main({ github, inputs }) {
  const packages = inputs.packages.split(',').map((s) => s.trim());
  if (!packages.length) {
    throw new Error(`Invalid packages input: must contain one or more entries`);
  }

  /** @type {string} */
  const currentVersion = loadPackageJson().version;

  /** @type {string | null | undefined} */
  let resolvedReleaseVersionTag = undefined;

  for (const packageName of packages) {
    const latestPackage = await getLatestVersionForPackage({ github, org: inputs.org, packageName });
    const versionTag = extractPackageVersionTag(latestPackage);
    if (resolvedReleaseVersionTag === undefined) {
      resolvedReleaseVersionTag = versionTag;
    } else if (versionTag !== resolvedReleaseVersionTag) {
      throw new Error(
        `Unexpected version for package '${packageName}': expected '${resolvedReleaseVersionTag}', got '${versionTag}'`
      );
    }
  }

  if (currentVersion === resolvedReleaseVersionTag) {
    return null;
  }

  return JSON.stringify({
    buildMatrix: {
      include: parseDockerCompose(packages)
    },
    currentVersion
  });
};
