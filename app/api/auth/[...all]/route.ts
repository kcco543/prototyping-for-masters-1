/**
 * Better Auth's web address: every request to /api/auth/... lands here.
 * (The `[...all]` folder name means "any path after /api/auth/".)
 *
 * Used by the Inspiration library prototype
 * (app/prototypes/inspiration-library). The sign in, sign up and sign out
 * buttons send their requests here, for example
 * POST /api/auth/sign-in/email, and Better Auth answers them: it checks the
 * password, creates the session and sets the cookie.
 *
 * GET /api/auth/ok answers {"ok":true} when everything is set up.
 *
 * Docs: https://better-auth.com/docs/integrations/next
 */

import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "../../../prototypes/inspiration-library/lib/auth";
import { checkSettings } from "../../../prototypes/inspiration-library/lib/settings";

export const { GET, POST } = toNextJsHandler(async (request) => {
  // Not set up yet? Say so plainly instead of crashing.
  const settings = checkSettings();
  if (!settings.ok) {
    return Response.json(
      {
        error: "Better Auth isn't set up yet.",
        missingSettings: settings.missing,
        invalidSettings: settings.invalid,
        help: "See app/prototypes/inspiration-library/README.md",
      },
      { status: 503 },
    );
  }
  return getAuth().handler(request);
});
