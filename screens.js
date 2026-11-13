// screens.js — shows ONE screen at a time, and draws the icons.
//
// Each screen is a <section class="screen" data-screen="name"> in index.html.
// The name of the current screen is kept in the address bar after a "#"
// (for example ".../#results"). That way:
//   - links like <a href="#how"> open a screen without any extra code
//   - the phone's Back button goes back to the previous screen

// ---------- 1. Icons ----------
// Simple line icons, drawn with SVG (a format for drawing shapes with code).
// In index.html, <span data-icon="camera"></span> gets replaced by the camera icon.
const ICON_PATHS = {
  leaf:         '<path d="M19.5 4.5C13 4.4 7.2 6.6 5 11.2c-1.5 3.2.4 6.9 3.9 7.3 5.7.6 9.7-6.2 10.6-14Z"/><path d="M4 21c2.3-4.9 5.8-8 10.8-10.4"/>',
  camera:       '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z"/><circle cx="12" cy="13" r="3"/>',
  image:        '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
  sun:          '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  frame:        '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/>',
  info:         '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
  chevronLeft:  '<path d="m15 18-6-6 6-6"/>',
  chevronRight: '<path d="m9 18 6-6-6-6"/>',
  alert:        '<path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3Z"/><path d="M12 9v4M12 17h.01"/>',
  eye:          '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  check:        '<path d="M20 6 9 17l-5-5"/>',
  checkCircle:  '<circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
  bookmark:     '<path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2Z"/>',
  mail:         '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/>',
  lock:         '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  external:     '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  trash:        '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
  searchX:      '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3M8.5 8.5l5 5M13.5 8.5l-5 5"/>'
};

// Turn an icon name into SVG code
function icon(name) {
  return '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" ' +
         'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICON_PATHS[name] + '</svg>';
}

// Fill every <… data-icon="name"> on the page with its icon
for (const el of document.querySelectorAll("[data-icon]")) {
  el.innerHTML = icon(el.dataset.icon);
}


// ---------- 2. Switching screens ----------
const screens = document.querySelectorAll(".screen");

// Show the screen called "name" and hide all the others
function showScreen(name) {
  for (const screen of screens) {
    screen.hidden = screen.dataset.screen !== name;
  }
  window.scrollTo(0, 0); // start each screen at the top
}

// Go to a screen by changing the address bar. "replace" = don't add a Back
// step (used for Scanning → Results, so Back doesn't return to the scanner).
function go(name, replace) {
  if (location.hash === "#" + name) {
    route(); // already there (e.g. after logging in): just refresh it
  } else if (replace) {
    location.replace("#" + name);
  } else {
    location.hash = name;
  }
}

// Decide which screen to show for the current address. Some screens only
// make sense at certain times; otherwise we fall back to Home.
// (scanInProgress, hasResults, hasError live in app.js; supabaseClient and
//  currentUser live in auth.js.)
function route() {
  let name = location.hash.slice(1) || "home";
  const allowed = {
    home:     true,
    how:      true,
    sources:  true,
    scanning: scanInProgress,
    results:  hasResults,
    error:    hasError,
    login:    !!supabaseClient && !currentUser,
    saved:    !!currentUser
  };
  if (!allowed[name]) {
    name = "home";
    // Fix the address bar too, without adding a Back step
    history.replaceState(null, "", location.pathname + location.search + "#home");
  }
  showScreen(name);
}

// Run route() whenever the address changes (a link was clicked, or Back pressed)…
window.addEventListener("hashchange", route);
// …and once when the page first opens (after all the other scripts have loaded)
window.addEventListener("DOMContentLoaded", route);
