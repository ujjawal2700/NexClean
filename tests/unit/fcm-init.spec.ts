import { test, expect } from "@playwright/test";
import { generateKeyPairSync } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

test("Firebase Admin modular API initializes the app's push service without network calls", () => {
  const { privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
  const credential = Buffer.from(JSON.stringify({
    type: "service_account", project_id: "nexclean-offline-test",
    private_key: privateKey, client_email: "test@nexclean-offline-test.iam.gserviceaccount.com",
  })).toString("base64");
  const result = spawnSync(process.execPath, ["--import", "tsx", "-e", 'require("./src/shared/services/fcm.ts").initFcm()'], {
    cwd: fileURLToPath(new URL("../../backend/", import.meta.url)),
    env: { ...process.env, NODE_ENV: "test", FIREBASE_SERVICE_ACCOUNT_BASE64: credential },
    encoding: "utf8", timeout: 10_000,
  });
  expect(result.status, result.stderr).toBe(0);
  expect(result.stdout).toContain("Firebase Cloud Messaging initialized for project: nexclean-offline-test");
  expect(result.stderr).not.toContain("FCM init failed");
});
