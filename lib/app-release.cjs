// @ts-check

const fs = require('node:fs');
const path = require('node:path');

const VERSION_TAG_REGEX = /^v(\d+\.\d+\.\d+(-(alpha|beta)\.\d+)?)$/;

/** @typedef {{ org: string; packages: string; }} Inputs */

/** @typedef {import('github-script').AsyncFunctionArguments} AsyncFunctionArguments */

/** @typedef {Awaited<ReturnType<AsyncFunctionArguments['github']['rest']['packages']['getAllPackageVersionsForPackageOwnedByOrg']>>['data'][number]} PackageInfo */

/** @typedef {any} MatrixItem */

/**
 * Load the package.json file for the repository
 * @returns {{ [key: string]: any }}
 */
function loadPackageJson() {
  const filename = 'package.json';
  const searchDir = process.cwd();
  if (!fs.readdirSync(searchDir).includes(filename)) {
    throw new Error(`Could not find file '${filename}' in directory: ${searchDir}`);
  }
  return JSON.parse(fs.readFileSync(path.join(searchDir, filename), 'utf-8'));
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
    include: [
      { config: 'Debug', project: 'foo' },
      { config: 'Release', project: 'bar' }
    ]
  });
};
