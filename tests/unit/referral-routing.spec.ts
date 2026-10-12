import { test, expect } from "@playwright/test";
import { customerPlayStoreUrl, referralAndroidIntentUrl, referralInviteUrl } from "../../frontend/src/shared/lib/site";

test("Android invite targets the customer app and preserves the install referral", () => {
  const code = "AISHA42";
  const intent = referralAndroidIntentUrl(code);
  expect(intent).toContain("intent://nexclean.in/referral?code=AISHA42#Intent;scheme=https;package=com.nexclean.customer;");
  const fallback = intent.match(/S\.browser_fallback_url=([^;]+);end$/)?.[1];
  expect(fallback).toBeTruthy();
  const store = new URL(decodeURIComponent(fallback!));
  expect(store.origin).toBe("https://play.google.com");
  expect(store.pathname).toBe("/store/apps/details");
  expect(store.searchParams.get("id")).toBe("com.nexclean.customer");
  const referrer = new URLSearchParams(store.searchParams.get("referrer")!);
  expect(referrer.get("ref")).toBe(code);
  expect(referrer.get("code")).toBe(code);
  expect(referrer.get("deep_link")).toBe(referralInviteUrl(code));
});

test("referral codes cannot inject intent fields and survive nested URL encoding", () => {
  const code = "CODE&x=1;#Intent;package=other;end";
  expect(referralAndroidIntentUrl(code).split("#Intent;")).toHaveLength(2);
  const store = new URL(customerPlayStoreUrl(code));
  const referrer = new URLSearchParams(store.searchParams.get("referrer")!);
  expect(referrer.get("ref")).toBe(code);
  expect(new URL(referrer.get("deep_link")!).searchParams.get("code")).toBe(code);
});

test("an invite without a code still links to the correct store listing", () => {
  const store = new URL(customerPlayStoreUrl(""));
  expect(store.searchParams.get("id")).toBe("com.nexclean.customer");
  expect(store.searchParams.has("referrer")).toBe(false);
});
