import assert from "node:assert/strict";
import test from "node:test";
import { checkTauriVersions } from "./check-tauri-versions.mjs";

const versionPairs = [
  ["tauri", "@tauri-apps/api"],
  ["tauri-plugin-dialog", "@tauri-apps/plugin-dialog"],
  ["tauri-plugin-fs", "@tauri-apps/plugin-fs"],
  ["tauri-plugin-notification", "@tauri-apps/plugin-notification"],
  ["tauri-plugin-opener", "@tauri-apps/plugin-opener"],
];

function makeLocks(cargoOverrides = {}, npmOverrides = {}) {
  const cargoLock = versionPairs
    .map(
      ([cargoName], index) =>
        `[[package]]\nname = "${cargoName}"\nversion = "${cargoOverrides[cargoName] ?? `2.${index + 1}.4`}"`,
    )
    .join("\n\n");
  const packages = Object.fromEntries(
    versionPairs.map(([, npmName], index) => [
      `node_modules/${npmName}`,
      { version: npmOverrides[npmName] ?? `2.${index + 1}.9` },
    ]),
  );
  return { cargoLock, npmLock: { packages } };
}

test("accepts different patch versions in the same major/minor", () => {
  const { cargoLock, npmLock } = makeLocks();

  const results = checkTauriVersions(npmLock, cargoLock);

  assert.equal(results.length, versionPairs.length);
  assert.ok(results.every(({ matches }) => matches));
});

test("reports a major/minor mismatch for the affected pair", () => {
  const { cargoLock, npmLock } = makeLocks(
    {},
    { "@tauri-apps/plugin-fs": "2.5.0" },
  );

  const mismatches = checkTauriVersions(npmLock, cargoLock).filter(
    ({ matches }) => !matches,
  );

  assert.deepEqual(
    mismatches.map(({ cargoName, npmName }) => [cargoName, npmName]),
    [["tauri-plugin-fs", "@tauri-apps/plugin-fs"]],
  );
});

test("fails when a Tauri package is missing from a lockfile", () => {
  const { cargoLock, npmLock } = makeLocks();
  delete npmLock.packages["node_modules/@tauri-apps/plugin-fs"];

  assert.throws(
    () => checkTauriVersions(npmLock, cargoLock),
    /Could not find @tauri-apps\/plugin-fs in package-lock\.json/,
  );
});
