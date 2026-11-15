import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packagePairs = [
  ["tauri", "@tauri-apps/api"],
  ["tauri-plugin-dialog", "@tauri-apps/plugin-dialog"],
  ["tauri-plugin-fs", "@tauri-apps/plugin-fs"],
  ["tauri-plugin-notification", "@tauri-apps/plugin-notification"],
  ["tauri-plugin-opener", "@tauri-apps/plugin-opener"],
];

function parseCargoPackages(cargoLock) {
  return cargoLock
    .split(/^\[\[package\]\]\s*$/m)
    .slice(1)
    .map((block) => ({
      name: block.match(/^name = "([^"]+)"$/m)?.[1],
      version: block.match(/^version = "([^"]+)"$/m)?.[1],
    }))
    .filter(({ name, version }) => name && version);
}

function getMajorMinor(version, packageName) {
  const match = version.match(/^(\d+)\.(\d+)\.\d+/);
  if (!match) {
    throw new Error(`Unsupported version "${version}" for ${packageName}.`);
  }
  return `${match[1]}.${match[2]}`;
}

export function checkTauriVersions(npmLock, cargoLock) {
  if (!npmLock.packages || typeof npmLock.packages !== "object") {
    throw new Error("package-lock.json does not contain a packages map.");
  }

  const cargoPackages = parseCargoPackages(cargoLock);

  return packagePairs.map(([cargoName, npmName]) => {
    const cargoVersions = cargoPackages
      .filter((entry) => entry.name === cargoName)
      .map((entry) => entry.version);

    if (cargoVersions.length === 0) {
      throw new Error(`Could not find ${cargoName} in src-tauri/Cargo.lock.`);
    }
    if (cargoVersions.length > 1) {
      throw new Error(
        `Found multiple ${cargoName} versions in src-tauri/Cargo.lock: ${cargoVersions.join(", ")}.`,
      );
    }

    const npmVersion = npmLock.packages[`node_modules/${npmName}`]?.version;
    if (!npmVersion) {
      throw new Error(`Could not find ${npmName} in package-lock.json.`);
    }

    const cargoVersion = cargoVersions[0];
    return {
      cargoName,
      cargoVersion,
      npmName,
      npmVersion,
      matches:
        getMajorMinor(cargoVersion, cargoName) ===
        getMajorMinor(npmVersion, npmName),
    };
  });
}

function main() {
  const repoRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
  );
  const npmLock = JSON.parse(
    readFileSync(path.join(repoRoot, "package-lock.json"), "utf8"),
  );
  const cargoLock = readFileSync(
    path.join(repoRoot, "src-tauri", "Cargo.lock"),
    "utf8",
  );
  const results = checkTauriVersions(npmLock, cargoLock);
  const mismatches = results.filter(({ matches }) => !matches);

  if (mismatches.length > 0) {
    console.error("Tauri package major/minor version mismatch:");
    for (const {
      cargoName,
      cargoVersion,
      npmName,
      npmVersion,
    } of mismatches) {
      console.error(`  ${cargoName} ${cargoVersion} vs ${npmName} ${npmVersion}`);
    }
    console.error(
      "Align the versions in package.json and src-tauri/Cargo.toml, then update both lockfiles.",
    );
    process.exitCode = 1;
    return;
  }

  console.log("Tauri package major/minor versions are aligned:");
  for (const { cargoName, cargoVersion, npmName, npmVersion } of results) {
    console.log(`  ${cargoName} ${cargoVersion} vs ${npmName} ${npmVersion}`);
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main();
}
