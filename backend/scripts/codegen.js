// Runs CEF's registry codegen by importing its exported function directly.
//
// Why not the documented `cef-gen-handlers` CLI: npm exposes bins as symlinks
// in node_modules/.bin, and the script's isDirectExecution guard compares
// path.resolve(process.argv[1]) — which never follows symlinks — against the
// loader-resolved __filename. Through the symlink the paths differ, so it
// concludes "imported, not executed" and exits 0 without writing anything
// (D13). Calling the exported function skips the broken guard.
//
// Internal path, not public API — verified against commoneventframework
// 1.0.6; re-verify on any upgrade (same policy as the typeorm CLI internals,
// spec 4.1 §4).
const fs = require("fs");
const {
  generateHandlerRegistry,
} = require("commoneventframework/dist/script/generateHandlerRegistry");

const ROOT_YAML = "src/root.yaml";
const OUT_FILE = "src/generated/HandlerRegistry.ts";

generateHandlerRegistry({ rootYaml: ROOT_YAML, outFile: OUT_FILE });

// Postcondition check — success must be read off the effect, never the exit
// code: the bug this file works around was a zero-exit no-op. Every ref
// declared in root.yaml must appear in the freshly generated registry.
const refs = [
  ...fs
    .readFileSync(ROOT_YAML, "utf8")
    .matchAll(/x-(?:handler|inputParser):\s*(\S+)/g),
].map((match) => match[1]);
const registry = fs.readFileSync(OUT_FILE, "utf8");
const missing = refs.filter((ref) => !registry.includes(`"${ref}"`));

if (missing.length > 0) {
  console.error(`[codegen] registry is missing ${missing.length} ref(s):`, missing);
  process.exit(1);
}
console.log(`[codegen] verified: all ${refs.length} root.yaml refs are registered`);
