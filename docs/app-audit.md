# App review — 12 October 2026

Scope: customer, agent, admin and public landing UI text, behaviour and responsive layout. Native Android installation, device push delivery and Play Store App Links are outside this repository; the app developer handles them.

## Fixes

- Removed demo account/OTP hints and developer-facing login/signup errors from user screens.
- Standardised Aadhaar spelling across agent onboarding, admin KYC views and validation messages; API field names remain compatible.
- Clarified notification, service-completion, earnings-history, support-menu, empty-slot and referral-history text.
- Corrected the default service FAQ: Express Wash does not include interior cleaning.
- Enabled the existing customer Google Play download link on the public landing page.
- Support and deactivated-account screens now use the published contact configuration rather than a separate hardcoded street address. Removed unsupported response-time and refund guarantees from the support page; linked the refund policy.
- Added safe-area clearance and viewport bounds to job offers, account recovery, service notices, photo viewers, address dialogs, booking recovery, admin detail dialogs, device-switch and release-job dialogs. Long dialog content can scroll instead of extending outside short screens.
- Increased plan-detail action clearance and allowed long plan names/buttons to wrap.
- Updated outdated test expectations and granted location permission in the customer-to-agent review test.
- Made the separate frontend OTP suite use dedicated test ports, mocked integrations and freshly created test accounts.

## Contact configuration to review

The live public contact configuration still publishes `+91 98765 43210` and `Bengaluru, Karnataka, India`. These match the bundled sample defaults. No verified replacement was provided, so the review does not invent a phone number or office address. Update these values in Admin > Content > Contact if they are placeholders.

## Validation

All available configured suites were executed, including the separate frontend OTP suite. Final consolidated results after rerunning the failed checks:

| Suite | Passed | Skipped |
| --- | ---: | ---: |
| Unit | 30 | 0 |
| API | 455 | 0 |
| Landing E2E | 16 | 0 |
| Customer E2E | 122 | 0 |
| Agent E2E | 129 | 0 |
| Admin E2E | 114 | 1 |
| Separate frontend OTP E2E | 2 | 0 |
| **Total** | **868** | **1** |

The Google Maps zone-drawing test skipped because the map SDK was unavailable in the local environment. It remains a real-device/integration check; it was not counted as passing.

The final full run initially recorded 833 passes, 33 failures and 1 skip. Many failures reported 15-minute elapsed times for 30-second tests, including browser setup; these indicate the test process was suspended. A new recovery mock was also corrected to match the backend's ACCOUNT_DEACTIVATED error code. After preventing idle sleep, all 33 failed checks passed on a clean local rerun (1.2 minutes). No outstanding test failures remain.

Frontend and backend typechecks, frontend tooling typecheck, both production builds and git diff whitespace checks passed. Both production dependency audits reported zero known vulnerabilities. Vite still reports the existing large admin bundle warning; builds complete successfully.

Logs for this session:
- `/tmp/nexclean-app-audit-final-suite.log` — full 867-check run
- `/tmp/nexclean-app-audit-rerun.log` — 33-check rerun
- `/tmp/nexclean-app-audit-otp-suite.log` — separate OTP tests
- `tests/playwright-report/index.html` — latest browser report

 Tests use a temporary MongoDB under `/tmp`, local test ports 4400/5190 and disabled payment, push, SMS, email and Redis integrations. No live accounts or bookings are used.
