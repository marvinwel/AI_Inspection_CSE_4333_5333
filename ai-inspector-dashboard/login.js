// login.js — drives the views on login.html.

const views = [
  "signInForm",
  "signUpForm",
  "confirmForm",
  "newPasswordForm",
  "forgotForm",
  "resetForm",
];
const TAB_VIEWS = ["signInForm", "signUpForm"]; // views that show the Sign in | Sign up tabs
let pendingEmail = "";
let pendingSession = "";
let pendingPassword = ""; // kept in memory only, to sign in right after email confirmation

// Already signed in? Go straight to the dashboard.
Auth.getValidIdToken().then((token) => {
  if (token) window.location.replace("index.html");
});

function show(id) {
  views.forEach((v) => (document.getElementById(v).hidden = v !== id));

  // Tabs are only shown on Sign in / Sign up; highlight the active one.
  document.getElementById("tabs").hidden = !TAB_VIEWS.includes(id);
  document.querySelectorAll(".tab").forEach((tab) => {
    const active = tab.dataset.tab === id;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  });
  document.title = `${id === "signUpForm" ? "Sign up" : "Sign in"} · AI Inspector`;

  const form = document.getElementById(id);
  setMessage(form, "");
  const first = form.querySelector("input");
  if (first) first.focus();
}

function setMessage(form, text, type = "error") {
  const el = form.querySelector(".message");
  el.textContent = text;
  el.className = `message ${type}`;
}

function setBusy(form, busy, label) {
  const btn = form.querySelector(".btn");
  if (!btn.dataset.label) btn.dataset.label = btn.textContent;
  btn.disabled = busy;
  btn.textContent = busy ? label : btn.dataset.label;
}

// Turn Cognito error codes into friendly text.
function friendlyError(error) {
  switch (error.code) {
    case "NotAuthorizedException":
    case "UserNotFoundException":
      return "Incorrect email or password.";
    case "UserNotConfirmedException":
      return "This account isn't confirmed yet. Check your email for the code.";
    case "UsernameExistsException":
      return "An account with this email already exists. Try signing in.";
    case "NotAuthorizedException_SignUpDisabled":
      return "Sign up is turned off. Ask an admin to enable self-registration.";
    case "InvalidParameterException_Email":
      return "Enter a valid email address.";
    case "PasswordResetRequiredException":
      return "You need to reset your password. Use “Forgot your password?”.";
    case "InvalidPasswordException":
      return error.message.replace(/^Password does not conform to policy: /, "");
    case "CodeMismatchException":
      return "That code is incorrect.";
    case "ExpiredCodeException":
      return "That code has expired. Request a new one.";
    case "LimitExceededException":
    case "TooManyRequestsException":
      return "Too many attempts. Please wait a few minutes and try again.";
    case "InvalidParameterException":
      if (/USER_PASSWORD_AUTH/.test(error.message)) {
        return "Password sign-in isn't enabled on the Cognito app client (ALLOW_USER_PASSWORD_AUTH).";
      }
      return error.message;
    default:
      return error.message || "Something went wrong. Please try again.";
  }
}

// Sign in | Sign up tabs
document.querySelectorAll(".tab").forEach((tab) =>
  tab.addEventListener("click", () => {
    if (tab.dataset.tab === "signUpForm") {
      document.getElementById("signUpEmail").value ||= document.getElementById("email").value;
    } else {
      document.getElementById("email").value ||= document.getElementById("signUpEmail").value;
    }
    show(tab.dataset.tab);
  })
);

// Open straight on the Sign up tab with login.html#signup
if (window.location.hash === "#signup") show("signUpForm");
window.addEventListener("hashchange", () => {
  if (window.location.hash === "#signup") show("signUpForm");
});

// Links like <a data-go="forgotForm">
document.querySelectorAll("[data-go]").forEach((link) =>
  link.addEventListener("click", (event) => {
    event.preventDefault();
    if (link.dataset.go === "forgotForm") {
      document.getElementById("forgotEmail").value = document.getElementById("email").value;
    }
    show(link.dataset.go);
  })
);

// --- Sign in ---
document.getElementById("signInForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const email = form.email.value.trim();
  const password = form.password.value;

  if (!email || !password) return setMessage(form, "Enter your email and password.");

  setBusy(form, true, "Signing in…");
  try {
    const result = await Auth.signIn(email, password);
    if (result.done) {
      window.location.replace("index.html");
    } else if (result.challenge === "NEW_PASSWORD_REQUIRED") {
      pendingEmail = email;
      pendingSession = result.session;
      show("newPasswordForm");
    } else {
      setMessage(form, `Unsupported sign-in step: ${result.challenge}`);
    }
  } catch (error) {
    if (error.code === "UserNotConfirmedException") {
      // Signed up but never entered the email code: send a fresh one and ask for it.
      pendingEmail = email;
      pendingPassword = password;
      try {
        await Auth.resendSignUpCode(email);
      } catch {
        /* the confirm screen has a Resend link */
      }
      openConfirm("Your account isn't verified yet. We sent you a new code.");
    } else {
      setMessage(form, friendlyError(error));
    }
  } finally {
    setBusy(form, false);
  }
});

// --- Sign up ---
document.getElementById("signUpForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const name = document.getElementById("signUpName").value.trim();
  const email = document.getElementById("signUpEmail").value.trim();
  const pw1 = document.getElementById("signUpPassword").value;
  const pw2 = document.getElementById("signUpPassword2").value;

  if (!name || !email || !pw1) return setMessage(form, "Fill in all fields.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setMessage(form, "Enter a valid email address.");
  if (pw1 !== pw2) return setMessage(form, "Passwords don't match.");

  setBusy(form, true, "Creating account…");
  try {
    const result = await Auth.signUp(name, email, pw1);
    pendingEmail = email;
    pendingPassword = pw1;

    if (result.UserConfirmed) {
      await finishSignUp(); // pool auto-confirms users: sign straight in
    } else {
      openConfirm();
    }
  } catch (error) {
    if (error.code === "NotAuthorizedException" && /sign ?up/i.test(error.message)) {
      setMessage(form, friendlyError({ code: "NotAuthorizedException_SignUpDisabled" }));
    } else if (error.code === "InvalidParameterException" && /email/i.test(error.message)) {
      setMessage(form, friendlyError({ code: "InvalidParameterException_Email" }));
    } else {
      setMessage(form, friendlyError(error));
    }
  } finally {
    setBusy(form, false);
  }
});

function openConfirm(note) {
  document.getElementById("confirmEmail").textContent = pendingEmail;
  document.getElementById("confirmCode").value = "";
  show("confirmForm");
  if (note) setMessage(document.getElementById("confirmForm"), note, "success");
}

// After the email is verified, sign in with the password they just chose.
async function finishSignUp() {
  try {
    const result = await Auth.signIn(pendingEmail, pendingPassword);
    pendingPassword = "";
    if (result.done) return window.location.replace("index.html");
  } catch {
    /* fall through to the sign-in screen */
  }
  pendingPassword = "";
  show("signInForm");
  document.getElementById("email").value = pendingEmail;
  setMessage(document.getElementById("signInForm"), "Account verified. Please sign in.", "success");
  document.getElementById("password").focus();
}

// --- Sign up: confirm email code ---
document.getElementById("confirmForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const code = document.getElementById("confirmCode").value.trim();
  if (!code) return setMessage(form, "Enter the code from your email.");

  setBusy(form, true, "Verifying…");
  try {
    await Auth.confirmSignUp(pendingEmail, code);
    await finishSignUp();
  } catch (error) {
    if (error.code === "NotAuthorizedException" && /already confirmed/i.test(error.message)) {
      await finishSignUp();
    } else {
      setMessage(form, friendlyError(error));
    }
  } finally {
    setBusy(form, false);
  }
});

document.getElementById("resendCode").addEventListener("click", async (event) => {
  event.preventDefault();
  const form = document.getElementById("confirmForm");
  try {
    await Auth.resendSignUpCode(pendingEmail);
    setMessage(form, `New code sent to ${pendingEmail}.`, "success");
  } catch (error) {
    setMessage(form, friendlyError(error));
  }
});

// --- First sign-in: new password ---
document.getElementById("newPasswordForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const pw1 = document.getElementById("newPassword").value;
  const pw2 = document.getElementById("newPassword2").value;

  if (!pw1) return setMessage(form, "Enter a new password.");
  if (pw1 !== pw2) return setMessage(form, "Passwords don't match.");

  setBusy(form, true, "Saving…");
  try {
    await Auth.completeNewPassword(pendingEmail, pw1, pendingSession);
    window.location.replace("index.html");
  } catch (error) {
    if (error.code === "NotAuthorizedException") {
      setMessage(form, "This step timed out. Go back and sign in again.");
    } else {
      setMessage(form, friendlyError(error));
    }
  } finally {
    setBusy(form, false);
  }
});

// --- Forgot password: send code ---
document.getElementById("forgotForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const email = document.getElementById("forgotEmail").value.trim();
  if (!email) return setMessage(form, "Enter your email address.");

  setBusy(form, true, "Sending…");
  try {
    await Auth.forgotPassword(email);
    pendingEmail = email;
    show("resetForm");
    setMessage(document.getElementById("resetForm"), `Code sent to ${email}.`, "success");
  } catch (error) {
    setMessage(form, friendlyError(error));
  } finally {
    setBusy(form, false);
  }
});

// --- Forgot password: code + new password ---
document.getElementById("resetForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const code = document.getElementById("resetCode").value.trim();
  const password = document.getElementById("resetPassword").value;
  if (!code || !password) return setMessage(form, "Enter the code and a new password.");

  setBusy(form, true, "Resetting…");
  try {
    await Auth.confirmForgotPassword(pendingEmail, code, password);
    show("signInForm");
    document.getElementById("email").value = pendingEmail;
    setMessage(
      document.getElementById("signInForm"),
      "Password reset. Sign in with your new password.",
      "success"
    );
    document.getElementById("password").focus();
  } catch (error) {
    setMessage(form, friendlyError(error));
  } finally {
    setBusy(form, false);
  }
});
