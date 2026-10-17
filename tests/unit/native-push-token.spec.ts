import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import vm from "node:vm";
import ts from "../../frontend/node_modules/typescript/lib/typescript.js";

function pushModule(runtimeConfig: () => Promise<unknown>) {
  const values = new Map<string, string>();
  const localStorage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
  const window: any = { dispatchEvent() {} };
  const exports: any = {};
  const code = ts.transpileModule(readFileSync(new URL("../../frontend/src/shared/lib/push.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, {
    exports, window, localStorage, crypto: { randomUUID }, Event, console,
    require: () => ({ getPublicRuntimeConfig: runtimeConfig }),
  });
  exports.installNativePushBridge(async () => {});
  return { push: exports, window, localStorage };
}

test("a saved native token is re-used on sign-in without browser push setup", async () => {
  const { push, window } = pushModule(async () => { throw new Error("Browser config must not be needed"); });
  await window.registerNativePushToken("native-phone-token-123");
  expect(await push.getPushToken()).toBe("native-phone-token-123");
});

test("a native token arriving during config loading cannot be overwritten by a placeholder", async () => {
  let resolveConfig!: (value: unknown) => void;
  const config = new Promise((resolve) => { resolveConfig = resolve; });
  const { push, window, localStorage } = pushModule(() => config);
  const pending = push.getPushToken();
  await window.registerNativePushToken("native-phone-token-456");
  resolveConfig({ firebase: null });
  expect(await pending).toBe("native-phone-token-456");
  expect(localStorage.getItem("nexclean-device-token")).toBe("native-phone-token-456");
});
