// auth.js — optional ACCOUNTS: sign up, log in, log out.
// Supabase does the hard parts for us: it stores accounts, checks passwords
// safely, and remembers who is logged in (even after closing the browser).

// ---------- 1. Connect to our Supabase project ----------
// supabaseClient is our "phone line" to Supabase. currentUser is the person
// logged in right now (or null if nobody is). saving.js uses both.
let supabaseClient = null;
let currentUser = null;

// Only connect if supabase-config.js has been filled in.
const supabaseIsSetUp =
  SUPABASE_URL.startsWith("https://") && !SUPABASE_KEY.startsWith("PASTE");

if (!supabaseIsSetUp) {
  console.info("Supabase is not set up yet — fill in supabase-config.js to turn on accounts.");
} else {
  // "supabase" comes from the Supabase library loaded in index.html.
  // The "lock" setting: by default Supabase uses a browser "lock" so two tabs
  // don't refresh the login at the same time. On phones that lock can get
  // stuck after the browser goes to the background (e.g. while the camera app
  // is open), and then every request waits forever. Our app is used in one
  // tab, so we replace the lock with one that simply runs the task right away.
  supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { lock: (name, acquireTimeout, task) => task() }
  });
  setUpAccounts();
}

// ---------- 2. Everything account-related ----------
function setUpAccounts() {
  // Grab the parts of the page we need
  const accountBar      = document.getElementById("account-bar");
  const loginOpenButton = document.getElementById("login-open-button");
  const myScansButton   = document.getElementById("my-scans-button");
  const logoutButton    = document.getElementById("logout-button");
  const authForm        = document.getElementById("auth-form");
  const emailInput      = document.getElementById("auth-email");
  const passwordInput   = document.getElementById("auth-password");
  const submitButton    = document.getElementById("auth-submit");
  const switchButton    = document.getElementById("auth-switch");
  const barTitle        = document.getElementById("auth-bar-title");
  const heading         = document.getElementById("auth-heading");
  const subheading      = document.getElementById("auth-subheading");
  const authMessage     = document.getElementById("auth-message");

  accountBar.hidden = false; // Supabase is set up, so show the account links

  // The login screen has two modes: "login" and "signup" (create account).
  // The switch link under the form flips between them.
  let mode = "login";
  function setMode(newMode) {
    mode = newMode;
    const signup = mode === "signup";
    barTitle.textContent      = signup ? "Create account" : "Log in";
    heading.textContent       = signup ? "Create your account" : "Welcome back";
    subheading.textContent    = signup ? "Save your scans and see them on any device." : "Log in to see your saved product scans.";
    submitButton.textContent  = signup ? "Create account" : "Log in";
    switchButton.textContent  = signup ? "Already have an account? Log in" : "New here? Create account";
    passwordInput.autocomplete = signup ? "new-password" : "current-password";
    authMessage.hidden = true;
  }
  switchButton.addEventListener("click", () => setMode(mode === "login" ? "signup" : "login"));

  // Show a green (success) or red (error) message under the form
  function showMessage(text, isError) {
    authMessage.textContent = text;
    authMessage.className = isError ? "notice error" : "notice";
    authMessage.hidden = false;
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

  // Update the Home screen's links to match who is logged in
  function updateAccountBar(user) {
    currentUser = user;
    loginOpenButton.hidden = !!user;
    myScansButton.hidden = !user;
    logoutButton.hidden = !user;
    // Tell saving.js too, then re-check the current screen
    // (e.g. "My saved scans" only makes sense when logged in)
    refreshSavedScans();
    route();
  }

  // Supabase tells us whenever someone logs in or out — including right when
  // the page loads, if they were already logged in from last time.
  supabaseClient.auth.onAuthStateChange((event, session) => {
    updateAccountBar(session ? session.user : null);
  });

  // The form's button (or pressing Enter): log in OR create an account
  authForm.addEventListener("submit", async (event) => {
    event.preventDefault(); // stop the browser from reloading the page
    submitButton.disabled = true;
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (mode === "login") {
      // LOG IN
      const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
      submitButton.disabled = false;
      if (error) {
        showMessage(friendlyError(error), true);
        return;
      }
      authForm.reset();
      afterLogin(); // saving.js: finish a pending save, or go Home
    } else {
      // CREATE ACCOUNT
      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        // After clicking the confirmation email, come back to this page
        options: { emailRedirectTo: window.location.origin + window.location.pathname }
      });
      submitButton.disabled = false;
      if (error) {
        showMessage(friendlyError(error), true);
      } else if (!data.session) {
        // Supabase requires email confirmation: no login until they click the link
        authForm.reset();
        setMode("login");
        showMessage("Account created! Check your email and click the confirmation link, then log in here.", false);
      } else {
        // Email confirmation is turned off, so they're logged in straight away
        authForm.reset();
        afterLogin();
      }
    }
  });

  // LOG OUT
  logoutButton.addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    go("home");
  });
}
