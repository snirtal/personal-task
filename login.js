(function () {
  const form = document.getElementById("login-form");
  const emailInput = document.getElementById("login-email");
  const passwordInput = document.getElementById("login-password");
  const toggle = document.getElementById("login-password-toggle");
  const errorEl = document.getElementById("login-error");
  const submit = document.getElementById("login-submit");

  function clearSecrets() {
    passwordInput.value = "";
  }

  function setPasswordVisible(visible) {
    passwordInput.type = visible ? "text" : "password";
    toggle.textContent = visible ? "Hide" : "Show";
    toggle.setAttribute("aria-label", visible ? "Hide password" : "Show password");
    toggle.setAttribute("aria-pressed", String(visible));
  }

  window.LoginScreen = {
    show() {
      errorEl.textContent = "";
      clearSecrets();
      setPasswordVisible(false);
      submit.disabled = false;
      submit.textContent = "Sign In";
      window.showScreen("login");
      emailInput.focus();
    }
  };

  toggle.addEventListener("click", () => {
    setPasswordVisible(passwordInput.type === "password");
  });

  document.getElementById("login-to-signup").addEventListener("click", () => {
    clearSecrets();
    if (window.SignupScreen.show) window.SignupScreen.show();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorEl.textContent = "";
    const email = emailInput.value.trim();
    const password = passwordInput.value;
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
      errorEl.textContent = "Enter your password.";
      passwordInput.focus();
      return;
    }
    submit.disabled = true;
    submit.textContent = "Signing in…";
    try {
      const result = await window.AuthApi.signIn({ email, password });
      await window.PersonalTask.enter(result.user);
    } catch (error) {
      errorEl.textContent = error && error.message
        ? error.message
        : "Sign-in isn't available right now.";
      submit.disabled = false;
      submit.textContent = "Sign In";
    } finally {
      clearSecrets();
    }
  });
})();
