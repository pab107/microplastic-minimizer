// auth.js — optional ACCOUNTS: sign up, log in, log out.
// Supabase does the hard parts for us: it stores accounts, checks passwords
// safely, and remembers who is logged in (even after closing the browser).

// ---------- 1. Connect to our Supabase project ----------
// supabaseClient is our "phone line" to Supabase. currentUser is the person
// logged in right now (or null if nobody is). Step 3 (saving) will use both.
let supabaseClient = null;
let currentUser = null;

// Only connect if supabase-config.js has been filled in.
const supabaseIsSetUp =
  SUPABASE_URL.startsWith("https://") && !SUPABASE_KEY.startsWith("PASTE");

if (!supabaseIsSetUp) {
  console.info("Supabase is not set up yet — fill in supabase-config.js to turn on accounts.");
} else {
  // "supabase" comes from the Supabase library loaded in index.html
  supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  setUpAccounts();
}

// ---------- 2. Everything account-related ----------
function setUpAccounts() {
  // Grab the parts of the page we need
  const accountBar      = document.getElementById("account-bar");
  const accountEmail    = document.getElementById("account-email");
  const loginOpenButton = document.getElementById("login-open-button");
  const logoutButton    = document.getElementById("logout-button");
  const authCard        = document.getElementById("auth-card");
  const authForm        = document.getElementById("auth-form");
  const emailInput      = document.getElementById("auth-email");
  const passwordInput   = document.getElementById("auth-password");
  const signupButton    = document.getElementById("signup-button");
  const cancelButton    = document.getElementById("auth-cancel-button");
  const authMessage     = document.getElementById("auth-message");

  accountBar.hidden = false; // Supabase is set up, so show the account bar

  // Show a green (success) or red (error) message under the form
  function showMessage(text, isError) {
    authMessage.textContent = text;
    authMessage.className = isError ? "auth-message error" : "auth-message";
    authMessage.hidden = false;
  }

  // Grey out the buttons while we wait for Supabase, so nobody double-clicks
  function setBusy(busy) {
    for (const button of authForm.querySelectorAll("button")) button.disabled = busy;
  }

  // Turn Supabase's technical error messages into plain English
  function friendlyError(error) {
    const message = error.message || "";
    if (message.includes("Invalid login credentials")) return "Wrong email or password.";
    if (message.includes("Email not confirmed")) return "Please confirm your email first — check your inbox for a link from Supabase.";
    if (message.includes("already registered")) return "An account with this email already exists. Try logging in.";
    if (message.includes("rate limit")) return "Too many attempts. Please wait a few minutes and try again.";
    if (message.includes("Failed to fetch")) return "Couldn't reach Supabase. Check your internet connection, and that the address in supabase-config.js is right.";
    return "Something went wrong: " + message;
  }

  // Update the header to match who is logged in
  function updateAccountBar(user) {
    currentUser = user;
    if (user) {
      accountEmail.textContent = user.email;
      loginOpenButton.hidden = true;
      logoutButton.hidden = false;
      authCard.hidden = true;
    } else {
      accountEmail.textContent = "";
      loginOpenButton.hidden = false;
      logoutButton.hidden = true;
    }
    // Tell saving.js too: show/hide "My saved scans" and the Save button
    refreshSavedScans();
    showSaveArea();
  }

  // Supabase tells us whenever someone logs in or out — including right when
  // the page loads, if they were already logged in from last time.
  supabaseClient.auth.onAuthStateChange((event, session) => {
    updateAccountBar(session ? session.user : null);
  });

  // "Log in" in the header: show the login form
  loginOpenButton.addEventListener("click", () => {
    authCard.hidden = false;
    authMessage.hidden = true;
    emailInput.focus();
  });

  // "Cancel": hide the form again
  cancelButton.addEventListener("click", () => {
    authCard.hidden = true;
  });

  // LOG IN (the form's main button, or pressing Enter)
  authForm.addEventListener("submit", async (event) => {
    event.preventDefault(); // stop the browser from reloading the page
    setBusy(true);
    const { error } = await supabaseClient.auth.signInWithPassword({
      email: emailInput.value.trim(),
      password: passwordInput.value
    });
    setBusy(false);
    if (error) {
      showMessage(friendlyError(error), true);
    } else {
      authForm.reset(); // clear the boxes; onAuthStateChange updates the header
    }
  });

  // CREATE ACCOUNT
  signupButton.addEventListener("click", async () => {
    // Use the browser's built-in checks (valid email, 6+ character password)
    if (!authForm.reportValidity()) return;
    setBusy(true);
    const { data, error } = await supabaseClient.auth.signUp({
      email: emailInput.value.trim(),
      password: passwordInput.value,
      // After clicking the confirmation email, come back to this page
      options: { emailRedirectTo: window.location.origin + window.location.pathname }
    });
    setBusy(false);
    if (error) {
      showMessage(friendlyError(error), true);
    } else if (!data.session) {
      // Supabase requires email confirmation: no login until they click the link
      showMessage("Account created! Check your email and click the confirmation link, then log in here.", false);
      authForm.reset();
    } else {
      // Email confirmation is turned off, so they're logged in straight away
      authForm.reset();
    }
  });

  // LOG OUT
  logoutButton.addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
  });
}
