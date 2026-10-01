import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";

const root = new URL("../../", import.meta.url);
const nativeRequire = createRequire(import.meta.url);

export function sourceModules(overrides = {}, globals = {}) {
  const cache = new Map();
  function load(name) {
    if (Object.hasOwn(overrides, name)) return overrides[name];
    if (name.startsWith("node:")) return nativeRequire(name);
    if (!name.startsWith("@/")) throw new Error(`Unexpected dependency: ${name}`);
    if (cache.has(name)) return cache.get(name);
    const result = {};
    cache.set(name, result);
    const source = readFileSync(new URL(`${name.slice(2)}.ts`, root), "utf8");
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInNewContext(code, {
      exports: result, require: load,
      Request, Response, URL, Buffer, Map, Set, TextDecoder, AbortSignal, AbortController,
      SyntaxError, Error, setTimeout, clearTimeout, console,
      process: { env: {} }, ...globals,
    });
    return result;
  }
  return load;
}
