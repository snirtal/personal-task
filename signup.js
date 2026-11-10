(function () {
  const form = document.getElementById("signup-form");
  const nameInput = document.getElementById("signup-name");
  const emailInput = document.getElementById("signup-email");
  const passwordInput = document.getElementById("signup-password");
  const confirmInput = document.getElementById("signup-confirm");
  const passwordToggle = document.getElementById("signup-password-toggle");
  const confirmToggle = document.getElementById("signup-confirm-toggle");
  const errorEl = document.getElementById("signup-error");
  const submit = document.getElementById("signup-submit");

  function clearSecrets() {
    passwordInput.value = "";
    confirmInput.value = "";
  }

  function bindToggle(button, input) {
    button.addEventListener("click", () => {
      const visible = input.type === "password";
      input.type = visible ? "text" : "password";
      button.textContent = visible ? "Hide" : "Show";
      button.setAttribute("aria-label", visible ? "Hide password" : "Show password");
      button.setAttribute("aria-pressed", String(visible));
    });
  }

  window.SignupScreen = {
    show() {
      errorEl.textContent = "";
      clearSecrets();
      passwordInput.type = "password";
      confirmInput.type = "password";
      passwordToggle.textContent = "Show";
      confirmToggle.textContent = "Show";
      passwordToggle.setAttribute("aria-pressed", "false");
      confirmToggle.setAttribute("aria-pressed", "false");
      submit.disabled = false;
      submit.textContent = "Create Account";
      window.showScreen("signup");
      nameInput.focus();
    }
  };

  bindToggle(passwordToggle, passwordInput);
  bindToggle(confirmToggle, confirmInput);

  document.getElementById("signup-to-login").addEventListener("click", () => {
    clearSecrets();
    if (window.LoginScreen) window.LoginScreen.show();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorEl.textContent = "";
    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const confirm = confirmInput.value;
    if (!name) {
      errorEl.textContent = "Enter your full name.";
      nameInput.focus();
      return;
    }
    if (!email) {
      errorEl.textContent = "Enter your email address.";
      emailInput.focus();
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errorEl.textContent = "Enter a valid email address.";
      emailInput.focus();
      return;
    }
    if (!password) {
      errorEl.textContent = "Enter a password.";
      passwordInput.focus();
      return;
    }
    if (password.length < 8) {
      errorEl.textContent = "Use at least 8 characters.";
      passwordInput.focus();
      return;
    }
    if (password !== confirm) {
      errorEl.textContent = "Passwords don't match.";
      confirmInput.focus();
      return;
    }
    submit.disabled = true;
    submit.textContent = "Creating account…";
    try {
      const result = await window.AuthApi.signUp({ name, email, password });
      if (result.verificationRequired) {
        errorEl.textContent = "Check your email and confirm your address, then sign in.";
        submit.disabled = false;
        submit.textContent = "Create Account";
        return;
      }
      await window.PersonalTask.enter(result.user);
    } catch (error) {
      errorEl.textContent = error && error.message
        ? error.message
        : "Sign-up isn't available right now.";
      submit.disabled = false;
      submit.textContent = "Create Account";
    } finally {
      clearSecrets();
    }
  });
})();
