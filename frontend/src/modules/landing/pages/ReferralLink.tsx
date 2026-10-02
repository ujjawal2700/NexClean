import { Navigate, useParams, useSearchParams } from "react-router-dom";

/**
 * Landing point for a shared referral invite — https://nexclean.in/referral?code=CODE
 * (or /referral/CODE). With the app installed, Android/iOS open the app at this
 * URL instead (see public/.well-known); everywhere else it lands here and goes
 * straight to customer sign-up, where the code is filled in and verified.
 */
export function ReferralLink() {
  const [params] = useSearchParams();
  const { code: pathCode } = useParams();
  const code = (params.get("code") ?? params.get("ref") ?? pathCode ?? "").trim().toUpperCase();
  return <Navigate to={code ? `/app/signup?ref=${encodeURIComponent(code)}` : "/app/signup"} replace />;
}
