import { describe, expect, it } from "vitest"
import appIconRaw from "../app-icon.svg?raw"
import indexHtmlRaw from "../index.html?raw"
import packageJsonRaw from "../package.json?raw"
import readmeRaw from "../README.md?raw"
import packageLinuxRaw from "../scripts/package_linux.sh?raw"
import buildRsRaw from "../src-tauri/build.rs?raw"
import defaultCapRaw from "../src-tauri/capabilities/default.json?raw"
import cargoTomlRaw from "../src-tauri/Cargo.toml?raw"
import rustfmtRaw from "../src-tauri/rustfmt.toml?raw"
import databaseRsRaw from "../src-tauri/src/database.rs?raw"
import errorRsRaw from "../src-tauri/src/error.rs?raw"
import libRsRaw from "../src-tauri/src/lib.rs?raw"
import mainRsRaw from "../src-tauri/src/main.rs?raw"
import platformModRsRaw from "../src-tauri/src/platform/mod.rs?raw"
import tauriConfRaw from "../src-tauri/tauri.conf.json?raw"
import contractTestsRsRaw from "../src-tauri/tests/contract_tests.rs?raw"
import kitTestsRsRaw from "../src-tauri/tests/kit_tests.rs?raw"
import apiTsRaw from "../src/api.ts?raw"
import errorsTsRaw from "../src/errors.ts?raw"
import mainTsRaw from "../src/main.ts?raw"
import storeTsRaw from "../src/store.ts?raw"
import styleCssRaw from "../src/style.css?url"
import uiTsRaw from "../src/ui.ts?raw"
import tsconfigRaw from "../tsconfig.json?raw"
import viteConfigRaw from "../vite.config.ts?raw"
import contractTestRaw from "./contract.test.ts?raw"
import kitTestRaw from "./kit.test.ts?raw"
import storeTestRaw from "./store.test.ts?raw"
import uiTestRaw from "./ui.test.ts?raw"

const foundationFiles: Record<string, string> = {
  "package.json": packageJsonRaw,
  "src/main.ts": mainTsRaw,
  "src/style.css": styleCssRaw,
  "tests/contract.test.ts": contractTestRaw,
  "src-tauri/Cargo.toml": cargoTomlRaw,
  "src-tauri/src/main.rs": mainRsRaw,
  "src-tauri/src/lib.rs": libRsRaw,
  "src-tauri/src/platform/mod.rs": platformModRsRaw,
  "src-tauri/tests/contract_tests.rs": contractTestsRsRaw,
  "src-tauri/tauri.conf.json": tauriConfRaw,
  "src-tauri/capabilities/default.json": defaultCapRaw,
  "app-icon.svg": appIconRaw,
  "README.md": readmeRaw,
  "tsconfig.json": tsconfigRaw,
  "vite.config.ts": viteConfigRaw,
  "index.html": indexHtmlRaw,
  "src/api.ts": apiTsRaw,
  "src/errors.ts": errorsTsRaw,
  "src/ui.ts": uiTsRaw,
  "src/store.ts": storeTsRaw,
  "tests/store.test.ts": storeTestRaw,
  "tests/kit.test.ts": kitTestRaw,
  "tests/ui.test.ts": uiTestRaw,
  "scripts/package_linux.sh": packageLinuxRaw,
  "src-tauri/build.rs": buildRsRaw,
  "src-tauri/rustfmt.toml": rustfmtRaw,
  "src-tauri/src/error.rs": errorRsRaw,
  "src-tauri/src/database.rs": databaseRsRaw,
  "src-tauri/tests/kit_tests.rs": kitTestsRsRaw,
}

describe("foundation contract", () => {
  it("keeps every foundation file at its exact listed path", () => {
    const cssFiles = import.meta.glob("../src/style.css")
    expect(Object.keys(cssFiles)).toContain("../src/style.css")
    for (const [path, content] of Object.entries(foundationFiles)) {
      expect(typeof content, `${path} should be loaded`).toBe("string")
      if (path !== "src/style.css") {
        expect(content.length, `${path} should be non-empty`).toBeGreaterThan(0)
      }
    }
  })

  it("locks the identity com.scratch.pad and product name Scratch Pad", () => {
    const tauriConf = JSON.parse(tauriConfRaw) as {
      productName: string
      identifier: string
    }
    expect(tauriConf.identifier).toBe("com.scratch.pad")
    expect(tauriConf.productName).toBe("Scratch Pad")

    const pkg = JSON.parse(packageJsonRaw) as {
      name: string
      dependencies: Record<string, string>
      devDependencies: Record<string, string>
    }
    expect(pkg.name).toBe("scratch-pad")
    expect(pkg.dependencies["@tauri-apps/api"]).toBeDefined()
    expect(pkg.devDependencies["vitest"]).toBeDefined()
    expect(pkg.dependencies["electron"]).toBeUndefined()
    expect(pkg.devDependencies["electron"]).toBeUndefined()
  })

  it("uses tauri::Builder as the implementation marker", () => {
    expect(libRsRaw).toContain("tauri::Builder")
  })
})
