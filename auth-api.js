import { friendlyAuthError, interpretSignIn, interpretSignUp, userFromSession } from "./lib/auth-result.js";
import { publicConfig } from "./lib/public-config.js";

function showScreen(name) {
  document.getElementById("screen-boot").hidden = name !== "boot";
  document.getElementById("screen-login").hidden = name !== "login";
  document.getElementById("screen-signup").hidden = name !== "signup";
  document.getElementById("journal").hidden = name !== "journal";
  document.body.classList.remove("drawer-open");
}

let clientPromise = null;

function rejectConfig(error) {
  const wrapped = new Error(friendlyAuthError({ message: error && error.message, code: "NOT_CONFIGURED", name: error && error.name }));
  wrapped.code = error && error.name === "TypeError" ? "NETWORK" : "NOT_CONFIGURED";
  return wrapped;
}

async function connect() {
  let response;
  try {
    response = await fetch("/api/config", { headers: { Accept: "application/json" } });
  } catch (error) {
    throw rejectConfig(error);
  }
  if (!response.ok) throw rejectConfig({ message: "Account services are unavailable right now." });
  let body;
  try {
    body = await response.json();
  } catch (error) {
    throw rejectConfig(error);
  }
  const config = publicConfig({
    VITE_NEON_AUTH_URL: body && body.authUrl,
    NEON_DATA_API_URL: body && body.dataApiUrl
  });
  if (!config) throw rejectConfig({ message: "Account services are unavailable right now." });
  const sdk = await import("./vendor/neon-browser.js");
  return sdk.createClient({
    auth: { url: config.authUrl },
    dataApi: { url: config.dataApiUrl }
  });
}

function client() {
  if (!clientPromise) {
    clientPromise = connect().catch((error) => {
      clientPromise = null;
      throw error;
    });
  }
  return clientPromise;
}

async function currentSession() {
  try {
    const neon = await client();
    const session = await neon.auth.getSession();
    if (session && session.error) {
      const error = new Error(friendlyAuthError(session.error));
      error.code = session.error.code || "";
      throw error;
    }
    return session;
  } catch (error) {
    if (error && error.code) throw error;
    const wrapped = new Error(friendlyAuthError(error));
    wrapped.code = error && error.name === "TypeError" ? "NETWORK" : "";
    throw wrapped;
  }
}
function throwResult(result) {
  const error = new Error(result.error.message);
  error.code = result.error.code || "";
  throw error;
}

window.showScreen = showScreen;

window.AuthApi = {
  client,
  async restore() {
    return userFromSession(await currentSession());
  },
  async signIn({ email, password }) {
    const neon = await client();
    const result = await neon.auth.signIn.email({ email, password });
    const session = result && result.error ? null : await currentSession();
    const outcome = interpretSignIn(result, session);
    if (outcome.error) throwResult(outcome);
    return outcome;
  },
  async signUp({ name, email, password }) {
    const neon = await client();
    const result = await neon.auth.signUp.email({ name, email, password });
    const session = result && result.error ? null : await currentSession();
    const outcome = interpretSignUp(result, session);
    if (outcome.error) throwResult(outcome);
    return outcome;
  },
  async signOut() {
    const neon = await client();
    const result = await neon.auth.signOut();
    if (result && result.error) throwResult({ error: { message: friendlyAuthError(result.error), code: result.error.code || "" } });
  }
};
