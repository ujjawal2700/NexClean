import { test, expect, type Page } from "@playwright/test";
import { loginCustomerUI } from "../../fixtures/ui-helpers";

/**
 * "Use my current location" — the one-tap path through address entry.
 *
 * Both halves are pinned here because they fail independently and for
 * different reasons: the parser turns Google's `address_components` into form
 * fields, and the fallback keeps the GPS pin when that lookup is refused. The
 * second is not a hypothetical — a Maps key that is missing, unbilled or
 * referrer-blocked produces exactly it, and the pin surviving is what keeps the
 * booking dispatchable.
 */

const GPS = { latitude: 28.4692, longitude: 77.0729 };

test.use({ permissions: ["geolocation"], geolocation: GPS });

/**
 * A stand-in Maps API. The real key cannot be relied on in a test run — it may
 * be absent, rejected, or rate-limited — and a spec that only passes with live
 * billing is a spec that gets deleted. `status` decides whether the geocoder
 * answers or refuses, which is the only difference between the two tests.
 */
function mapsStub(status: "OK" | "REQUEST_DENIED"): string {
  return `
    class MVCObject {
      constructor() { this._l = {}; }
      addListener(ev, fn) { (this._l[ev] ??= []).push(fn); return { remove() {} }; }
      _fire(ev) { (this._l[ev] ?? []).forEach((f) => f()); }
    }
    class LatLng {
      constructor(a, b) { this._a = typeof a === "object" ? a.lat : a; this._b = typeof a === "object" ? a.lng : b; }
      lat() { return this._a; } lng() { return this._b; }
    }
    class FakeMap extends MVCObject {
      constructor(el, o) {
        super(); this.c = o.center; this.z = o.zoom ?? 15;
        el.innerHTML = '<div data-fake-map="1" style="width:100%;height:100%"></div>';
        setTimeout(() => this._fire("idle"), 30);
      }
      setCenter(c) { this.c = c; setTimeout(() => this._fire("idle"), 10); }
      panTo(c) { this.c = c; setTimeout(() => this._fire("idle"), 10); }
      setZoom(z) { this.z = z; }
      getZoom() { return this.z; }
      getCenter() { return new LatLng(this.c); }
      getBounds() { return { contains: () => true }; }
      fitBounds() {}
      get(k) { return this[k]; }
      set(k, v) { this[k] = v; }
    }
    window.google = { maps: {
      Map: FakeMap, MVCObject, LatLng,
      Marker: class extends MVCObject { setPosition(){} setIcon(){} setMap(){} },
      Polyline: class extends MVCObject { setPath(){} setMap(){} },
      Circle: class extends MVCObject { setRadius(){} setOptions(){} setMap(){} },
      OverlayView: class { setMap(){} getPanes(){return{floatPane:document.body};}
        getProjection(){return{fromLatLngToDivPixel:()=>({x:0,y:0})};} },
      DirectionsService: class { route(_r, cb) { cb(null, "ZERO_RESULTS"); } },
      LatLngBounds: class { extend(){return this;} contains(){return true;} },
      Size: function(){}, Point: function(){},
      TravelMode: { DRIVING: "DRIVING" }, SymbolPath: { CIRCLE: 0 },
      places: { Autocomplete: function () {
        this.addListener = () => {}; this.setBounds = () => {}; this.setOptions = () => {};
      } },
      Geocoder: function () {
        this.geocode = (_req, cb) => {
          if ("${status}" !== "OK") return cb([], "REQUEST_DENIED");
          cb([{
            types: ["street_address"],
            formatted_address: "Flat 402, Green Valley Heights, Golf Course Road, Gurugram, Haryana 122002, India",
            address_components: [
              { long_name: "402", short_name: "402", types: ["subpremise"] },
              { long_name: "17", short_name: "17", types: ["street_number"] },
              { long_name: "Green Valley Heights", short_name: "Green Valley Heights", types: ["premise"] },
              { long_name: "Golf Course Road", short_name: "Golf Course Rd", types: ["route"] },
              { long_name: "Gurugram", short_name: "Gurugram", types: ["locality"] },
              { long_name: "122002", short_name: "122002", types: ["postal_code"] },
            ],
          }], "OK");
        };
      },
    } };
  `;
}

async function openAddAddress(page: Page, status: "OK" | "REQUEST_DENIED") {
  // Block the real script and stand the stub up before any app code runs.
  await page.route("https://maps.googleapis.com/**", (r) => r.fulfill({ status: 200, body: "" }));
  await page.addInitScript(mapsStub(status));
  await loginCustomerUI(page);
  await page.goto("/app/profile/addresses");
  await page.getByRole("button", { name: /Add.*address|New address/i }).first().click();
  await expect(page.getByTestId("use-current-location")).toBeVisible({ timeout: 15_000 });
}

test.describe("Address autofill from current location", () => {
  test("one tap moves the pin and fills every address field, overwriting stale input", async ({ page }) => {
    await openAddAddress(page, "OK");

    // Half-typed rubbish is the realistic starting state — someone begins
    // typing, gives up, and reaches for the button.
    await page.getByTestId("input-house-no").fill("WRONG-HOUSE");
    await page.getByTestId("input-society").fill("WRONG SOCIETY");
    await page.getByTestId("input-city").fill("WRONGCITY");
    await page.getByTestId("input-pincode").fill("999999");

    await page.getByTestId("use-current-location").click();

    await expect(page.getByTestId("autofill-success")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("input-house-no")).toHaveValue("402, 17");
    await expect(page.getByTestId("input-society")).toHaveValue("Green Valley Heights");
    await expect(page.getByTestId("input-landmark")).toHaveValue("Golf Course Road");
    await expect(page.getByTestId("input-city")).toHaveValue("Gurugram");
    await expect(page.getByTestId("input-pincode")).toHaveValue("122002");

    // The pin is what the cleaner actually navigates to, so it must be the
    // device's position — not wherever the map happened to open.
    await expect(page.getByTestId("address-pinned-coords")).toContainText("28.46920");
    await expect(page.getByTestId("address-pinned-coords")).toContainText("77.07290");

    // And the whole thing is saveable without another keystroke.
    await expect(page.getByTestId("save-address-btn")).toBeEnabled();
  });

  test("a refused geocode still keeps the GPS pin and says what to do", async ({ page }) => {
    await openAddAddress(page, "REQUEST_DENIED");

    await page.getByTestId("use-current-location").click();

    await expect(page.getByTestId("locate-error")).toContainText(/address lookup is unavailable/i, {
      timeout: 15_000,
    });
    // Losing the pin as well would leave the booking with no coordinates at
    // all, which drops it out of nearest-cleaner dispatch entirely.
    await expect(page.getByTestId("address-pinned-coords")).toContainText("28.46920");
    await expect(page.getByTestId("input-house-no")).toBeEditable();
  });
});
