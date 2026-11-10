export function friendlyAuthError(error) {
  const code = String((error && (error.code || error.status)) || "");
  const message = String((error && error.message) || "");
  const haystack = `${code} ${message}`;
  if (/EMAIL_NOT_VERIFIED|email.{0,24}verif/i.test(haystack)) {
    return "Check your email and confirm your address, then sign in.";
  }
  if (/INVALID_EMAIL_OR_PASSWORD|invalid email or password|invalid credentials/i.test(haystack)) {
    return "That email or password is incorrect.";
  }
  if (/USER_ALREADY_EXISTS|already exists|already registered/i.test(haystack)) {
    return "An account with this email already exists.";
  }
  if (/INVALID_ORIGIN|MISSING_ORIGIN|MISSING_OR_NULL_ORIGIN/i.test(haystack)) {
    return "This site is not allowed to sign in yet.";
  }
  if (/PASSWORD_TOO_SHORT|password.{0,24}short/i.test(haystack)) {
    return "Use at least 8 characters.";
  }
  if (error && error.name === "TypeError" || /Failed to fetch|NetworkError|Load failed/i.test(haystack)) {
    return "Couldn't reach the account service. Check your connection and try again.";
  }
  if (/NOT_CONFIGURED|unavailable/i.test(haystack)) {
    return "Account services are unavailable right now.";
  }
  return "Something went wrong. Try again.";
}

export function userFromSession(result) {
  const data = result && result.data;
  const user = data && (data.user || (data.session && data.session.user));
  if (!user || !user.id) return null;
  return {
    id: String(user.id),
    email: String(user.email || ""),
    name: String(user.name || "")
  };
}

export function interpretSignUp(result, sessionResult) {
  if (result && result.error) {
    const error = new Error(friendlyAuthError(result.error));
    error.code = result.error.code || "";
    return { error };
  }
  const user = userFromSession(sessionResult);
  if (user) return { user };
  return { verificationRequired: true };
}

export function interpretSignIn(result, sessionResult) {
  if (result && result.error) {
    const error = new Error(friendlyAuthError(result.error));
    error.code = result.error.code || "";
    return { error };
  }
  const user = userFromSession(sessionResult);
  if (user) return { user };
  const error = new Error("Check your email and confirm your address, then sign in.");
  error.code = "EMAIL_NOT_VERIFIED";
  return { error };
}
