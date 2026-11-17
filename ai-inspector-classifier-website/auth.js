// auth.js — talks to Amazon Cognito directly (no hosted login page, no libraries).
// Used by both login.html and index.html.
//
// Cognito setup (one time):
//   App client -> Edit -> Authentication flows -> turn on
//   "Sign in with username and password: ALLOW_USER_PASSWORD_AUTH"
//   (ALLOW_REFRESH_TOKEN_AUTH should also stay on.)

const COGNITO_REGION = "us-east-2";
const COGNITO_CLIENT_ID = "166c30gujgvm8hgqld9pdu5nc";

const Auth = (() => {
  const ENDPOINT = `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/`;
  const STORE = sessionStorage; // cleared when the tab closes; survives refresh

  // ---------- low-level Cognito call ----------
  async function cognito(action, body) {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-amz-json-1.1",
        "X-Amz-Target": `AWSCognitoIdentityProviderService.${action}`,
      },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const type = String(data.__type || "Error").split("#").pop();
      const err = new Error(data.message || data.Message || "Request failed");
      err.code = type;
      throw err;
    }
    return data;
  }

  // ---------- tokens ----------
  function decodeJwt(token) {
    try {
      const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      return JSON.parse(decodeURIComponent(escape(atob(payload))));
    } catch {
      return null;
    }
  }

  function saveTokens(result) {
    STORE.setItem("id_token", result.IdToken);
    STORE.setItem("access_token", result.AccessToken);
    if (result.RefreshToken) STORE.setItem("refresh_token", result.RefreshToken);
  }

  function clearTokens() {
    ["id_token", "access_token", "refresh_token"].forEach((k) => STORE.removeItem(k));
  }

  function getIdToken() {
    return STORE.getItem("id_token");
  }

  function getUser() {
    const token = getIdToken();
    return token ? decodeJwt(token) : null;
  }

  // Logged in = ID token that won't expire in the next 60 seconds.
  function isLoggedIn() {
    const claims = getUser();
    return !!claims && claims.exp * 1000 > Date.now() + 60_000;
  }

  // Returns a valid ID token, refreshing it silently if it expired. null = must log in.
  async function getValidIdToken() {
    if (isLoggedIn()) return getIdToken();

    const refreshToken = STORE.getItem("refresh_token");
    if (!refreshToken) return null;

    try {
      const data = await cognito("InitiateAuth", {
        AuthFlow: "REFRESH_TOKEN_AUTH",
        ClientId: COGNITO_CLIENT_ID,
        AuthParameters: { REFRESH_TOKEN: refreshToken },
      });
      saveTokens(data.AuthenticationResult);
      return getIdToken();
    } catch (error) {
      console.warn("Token refresh failed:", error);
      clearTokens();
      return null;
    }
  }

  // ---------- sign in ----------
  // Returns { done: true } or { challenge: "NEW_PASSWORD_REQUIRED", session }.
  async function signIn(email, password) {
    const data = await cognito("InitiateAuth", {
      AuthFlow: "USER_PASSWORD_AUTH",
      ClientId: COGNITO_CLIENT_ID,
      AuthParameters: { USERNAME: email, PASSWORD: password },
    });

    if (data.AuthenticationResult) {
      saveTokens(data.AuthenticationResult);
      return { done: true };
    }
    return { challenge: data.ChallengeName, session: data.Session };
  }

  // First sign-in with a temporary password: user must choose a new one.
  async function completeNewPassword(email, newPassword, session) {
    const data = await cognito("RespondToAuthChallenge", {
      ChallengeName: "NEW_PASSWORD_REQUIRED",
      ClientId: COGNITO_CLIENT_ID,
      Session: session,
      ChallengeResponses: { USERNAME: email, NEW_PASSWORD: newPassword },
    });
    if (!data.AuthenticationResult) throw new Error("Could not complete sign-in.");
    saveTokens(data.AuthenticationResult);
  }

  // ---------- sign up ----------
  // Requires self-registration to be turned on in the user pool.
  function signUp(name, email, password) {
    return cognito("SignUp", {
      ClientId: COGNITO_CLIENT_ID,
      Username: email,
      Password: password,
      UserAttributes: [
        { Name: "email", Value: email },
        { Name: "name", Value: name },
      ],
    });
  }

  function confirmSignUp(email, code) {
    return cognito("ConfirmSignUp", {
      ClientId: COGNITO_CLIENT_ID,
      Username: email,
      ConfirmationCode: code,
    });
  }

  function resendSignUpCode(email) {
    return cognito("ResendConfirmationCode", { ClientId: COGNITO_CLIENT_ID, Username: email });
  }

  // ---------- forgot password ----------
  function forgotPassword(email) {
    return cognito("ForgotPassword", { ClientId: COGNITO_CLIENT_ID, Username: email });
  }

  function confirmForgotPassword(email, code, newPassword) {
    return cognito("ConfirmForgotPassword", {
      ClientId: COGNITO_CLIENT_ID,
      Username: email,
      ConfirmationCode: code,
      Password: newPassword,
    });
  }

  // ---------- page guards ----------
  function login() {
    window.location.replace("login.html");
  }

  async function logout() {
    const accessToken = STORE.getItem("access_token");
    clearTokens();
    if (accessToken) {
      // Best effort: also end the session on Cognito's side.
      try {
        await cognito("GlobalSignOut", { AccessToken: accessToken });
      } catch {
        /* ignore */
      }
    }
    login();
  }

  // For index.html: resolves with the user, or sends them to login.html.
  async function requireLogin() {
    const token = await getValidIdToken();
    if (!token) {
      login();
      return new Promise(() => {}); // page is navigating away
    }
    return getUser();
  }

  return {
    signIn,
    signUp,
    confirmSignUp,
    resendSignUpCode,
    completeNewPassword,
    forgotPassword,
    confirmForgotPassword,
    requireLogin,
    getValidIdToken,
    getIdToken,
    getUser,
    isLoggedIn,
    login,
    logout,
  };
})();
