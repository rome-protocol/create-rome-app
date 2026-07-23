// Regression: `npx github:rome-protocol/create-rome-app` installs the package under
// .npm/_npx/<hash>/node_modules/create-rome-app — a path that CONTAINS node_modules.
// The copy filter must therefore test paths RELATIVE to template/, never the absolute
// source path, or it skips the whole template and scaffolds nothing.
//
// Run: node --test test/
import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");

function scaffoldVia(installDir, appName, cwd) {
  // Mimic an install: bin/ + template/ under installDir, run the bin from `cwd`.
  cpSync(join(repo, "bin"), join(installDir, "bin"), { recursive: true });
  cpSync(join(repo, "template"), join(installDir, "template"), {
    recursive: true,
    filter: (src) => !/node_modules|dist/.test(src.slice(repo.length)),
  });
  execFileSync(process.execPath, [join(installDir, "bin", "create-rome-app.mjs"), appName], { cwd, stdio: "pipe" });
}

test("scaffolds when installed under a node_modules path (the npx layout)", () => {
  const base = mkdtempSync(join(tmpdir(), "cra-npx-"));
  try {
    // THE regression shape: .../node_modules/create-rome-app/{bin,template}
    const install = join(base, "cache", "node_modules", "create-rome-app");
    mkdirSync(install, { recursive: true });
    const work = join(base, "work");
    mkdirSync(work);

    scaffoldVia(install, "my-app", work);

    const app = join(work, "my-app");
    assert.ok(existsSync(join(app, "package.json")), "package.json must be scaffolded");
    assert.ok(existsSync(join(app, ".env")), ".env must be seeded from .env.example");
    assert.ok(existsSync(join(app, "scripts", "demo.ts")), "scripts must be copied");
    const pkg = JSON.parse(readFileSync(join(app, "package.json"), "utf8"));
    assert.equal(pkg.name, "my-app");
    // install artifacts must still be excluded
    assert.ok(!existsSync(join(app, "node_modules")), "template node_modules must not copy");
    // npm pack STRIPS dotted .gitignore from git installs, so the template ships a
    // dotless `gitignore` and the bin renames it on copy. Without this, a scaffolded
    // app (whose .env holds PRIVATE KEYS) has no ignore file — `git init && push`
    // would stage the keys.
    const gi = join(app, ".gitignore");
    assert.ok(existsSync(gi), ".gitignore must exist in the scaffolded app");
    const giText = readFileSync(gi, "utf8");
    assert.match(giText, /^\.env$/m, ".gitignore must ignore .env (it holds keys)");
    assert.match(giText, /^node_modules$/m, ".gitignore must ignore node_modules");
    assert.ok(!existsSync(join(app, "gitignore")), "no stray dotless gitignore may remain");
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test("still refuses to scaffold over an existing directory", () => {
  const base = mkdtempSync(join(tmpdir(), "cra-exists-"));
  try {
    const install = join(base, "node_modules", "create-rome-app");
    mkdirSync(install, { recursive: true });
    const work = join(base, "work");
    mkdirSync(join(work, "taken"), { recursive: true });
    assert.throws(() => scaffoldVia(install, "taken", work), /already exists/);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});
