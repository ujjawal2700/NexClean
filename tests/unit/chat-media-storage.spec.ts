import { test, expect } from "@playwright/test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

test("chat storage forces WebP for native WebP and legacy JPEG uploads", () => {
  const script = `
    const assert = require('node:assert/strict');
    const cloudinary = require('cloudinary').v2;
    const calls = [];
    cloudinary.uploader.upload = async (data, options) => { calls.push({ data, options }); return { secure_url: 'https://example.test/photo.webp' }; };
    const { uploadImage } = require('./src/shared/utils/cloudinary.ts');
    Promise.all(['data:image/webp;base64,test', 'data:image/jpeg;base64,test'].map(data => uploadImage(data, { folder: 'nexclean/support/test' }))).then(urls => {
      assert.equal(calls.length, 2);
      for (const call of calls) {
        assert.equal(call.options.format, 'webp');
        assert.equal(call.options.resource_type, 'image');
        assert.equal(call.options.folder, 'nexclean/support/test');
      }
      assert.ok(urls.every(url => url.endsWith('.webp')));
    }).catch(error => { console.error(error); process.exitCode = 1; });
  `;
  const result = spawnSync(process.execPath, ["--import", "tsx", "-e", script], {
    cwd: fileURLToPath(new URL("../../backend/", import.meta.url)),
    env: { ...process.env, NODE_ENV: "test", CLOUDINARY_CLOUD_NAME: "test", CLOUDINARY_API_KEY: "test", CLOUDINARY_API_SECRET: "test" },
    encoding: "utf8", timeout: 10000,
  });
  expect(result.status, result.stderr).toBe(0);
});
