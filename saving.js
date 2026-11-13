// saving.js — SAVE scans (with their photos) and show "My saved scans".
// Only works when someone is logged in (see auth.js).
//
// Where things are stored in Supabase (set up by supabase-setup.sql):
//   - the photo  → Storage bucket "scan-photos", in a folder named after the user
//   - the result → Database table "scans" (text read, plastics found, photo location)

const PHOTO_BUCKET = "scan-photos";

// ---------- 1. Grab the parts of the page we need ----------
const saveButton     = document.getElementById("save-button");
const saveButtonText = document.getElementById("save-button-text");
const saveMessage    = document.getElementById("save-message");
const savedList      = document.getElementById("saved-list");
const savedEmail     = document.getElementById("saved-email");

// True when someone pressed "Save scan" while logged out: we send them to
// log in first, then come back and finish saving.
let saveAfterLogin = false;

// ---------- 2. The "Save scan" button on the Results screen ----------
// app.js calls this after every successful scan.
function showSaveArea() {
  saveButton.hidden = !supabaseClient; // no accounts set up → no saving
  saveButton.disabled = false;
  saveButtonText.textContent = "Save scan";
  saveMessage.hidden = true;
}

// Show a green (success) or red (error) message under the buttons.
// "html" is only ever our own fixed text, never text from a photo.
function showSaveMessage(html, isError) {
  saveMessage.innerHTML = html;
  saveMessage.className = isError ? "notice error" : "notice";
  saveMessage.hidden = false;
}

// Make a smaller JPEG copy of the photo before uploading, so saving is fast
// and we stay well inside Supabase's free storage space.
async function makeSmallJpeg(file) {
  const MAX_SIZE = 1200; // pixels on the longest side
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIZE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  // toBlob turns the canvas into an image file; 0.8 = good quality, small size
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.8));
}

// "Save scan" pressed
saveButton.addEventListener("click", () => {
  if (!currentUser) {
    // Not logged in: log in first, then auth.js calls afterLogin() below
    saveAfterLogin = true;
    go("login");
    return;
  }
  saveLastScan();
});

// Called by auth.js right after someone logs in
function afterLogin() {
  if (saveAfterLogin && lastScan) {
    saveAfterLogin = false;
    go("results");
    saveLastScan();
  } else {
    go("home");
  }
}

// SAVE: upload the photo, then add a row to the scans table
async function saveLastScan() {
  if (!currentUser || !lastScan) return;
  saveButton.disabled = true;
  saveButtonText.textContent = "Saving…";

  try {
    // a) Upload the photo into the user's own folder, named by the current time
    const photoPath = `${currentUser.id}/${Date.now()}.jpg`;
    const photo = await makeSmallJpeg(lastScan.file);
    const upload = await supabaseClient.storage
      .from(PHOTO_BUCKET)
      .upload(photoPath, photo, { contentType: "image/jpeg" });
    if (upload.error) throw upload.error;

    // b) Save the results. We only keep what we need to show them again later.
    const found = lastScan.found.map((item) => ({
      name: item.polymer.name,
      level: item.polymer.level,
      foundAs: item.foundAs
    }));
    const insert = await supabaseClient.from("scans").insert({
      scanned_text: lastScan.text,
      found: found,
      photo_path: photoPath
      // user_id and created_at are filled in automatically by the database
    });
    if (insert.error) throw insert.error;

    lastScan = null; // saved — don't save the same scan twice
    saveButtonText.textContent = "Saved";
    showSaveMessage('Saved! <a href="#saved">See my saved scans</a>', false);
    refreshSavedScans();
  } catch (error) {
    console.error(error);
    saveButton.disabled = false;
    saveButtonText.textContent = "Save scan";
    // error.message comes from Supabase, so we add it as plain text
    showSaveMessage("Couldn't save: ", true);
    saveMessage.append(error.message);
  }
}

// ---------- 3. "My saved scans" ----------
// Called by auth.js whenever someone logs in or out, and after each save.
async function refreshSavedScans() {
  savedList.innerHTML = "";
  if (!supabaseClient || !currentUser) return;
  savedEmail.textContent = "Signed in as " + currentUser.email;

  // Get this user's scans, newest first. (The security rules make sure
  // Supabase only ever returns the logged-in user's own scans.)
  const { data: scans, error } = await supabaseClient
    .from("scans")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    savedList.innerHTML = '<li class="card empty-card"><p>Couldn\'t load your saved scans. Please try again later.</p></li>';
    return;
  }
  if (scans.length === 0) {
    savedList.innerHTML = '<li class="card empty-card">' + icon("bookmark") +
      "<p><strong>No saved scans yet.</strong><br>Scan a label and press “Save scan”.</p></li>";
    return;
  }

  // Photos are private, so we ask Supabase for temporary links (valid 1 hour)
  const paths = scans.map((scan) => scan.photo_path).filter(Boolean);
  const photoLinks = {};
  if (paths.length) {
    const { data: links } = await supabaseClient.storage
      .from(PHOTO_BUCKET)
      .createSignedUrls(paths, 3600);
    for (const link of links || []) {
      if (link.signedUrl) photoLinks[link.path] = link.signedUrl;
    }
  }

  for (const scan of scans) {
    savedList.appendChild(makeSavedScanItem(scan, photoLinks[scan.photo_path]));
  }
}

// Build one row of the "My saved scans" list
function makeSavedScanItem(scan, photoUrl) {
  const item = document.createElement("li");
  item.className = "card saved-item";

  // Tapping the row reopens its results (a <button> so keyboards can use it too)
  const open = document.createElement("button");
  open.className = "saved-open";
  open.setAttribute("aria-label", "Open this scan");

  const img = document.createElement("img");
  img.className = "saved-thumb";
  img.alt = "";
  if (photoUrl) img.src = photoUrl;

  const info = document.createElement("div");
  info.className = "saved-info";

  const date = document.createElement("span");
  date.className = "saved-date";
  date.textContent = new Date(scan.created_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });

  // Verdict badge, e.g. "2 microplastics" (red) or "All clear" (green)
  const highCount = scan.found.filter((f) => f.level === "high").length;
  const watchCount = scan.found.length - highCount;
  const verdict = document.createElement("span");
  if (scan.found.length === 0) {
    verdict.className = "badge good";
    verdict.innerHTML = icon("checkCircle") + "All clear";
  } else if (highCount) {
    verdict.className = "badge high";
    verdict.innerHTML = icon("alert") + (highCount === 1 ? "1 microplastic" : highCount + " microplastics");
  } else {
    verdict.className = "badge watch";
    verdict.innerHTML = icon("eye") + watchCount + " watch";
  }

  const names = document.createElement("span");
  names.className = "saved-names";
  names.textContent = scan.found.map((f) => f.name).join(", ");

  info.append(date, verdict, names);
  open.append(img, info);
  open.addEventListener("click", () => reopenScan(scan, photoUrl));

  // Delete button: removes the photo and the row
  const deleteButton = document.createElement("button");
  deleteButton.className = "icon-button danger";
  deleteButton.setAttribute("aria-label", "Delete this scan");
  deleteButton.innerHTML = icon("trash");
  deleteButton.addEventListener("click", async () => {
    if (!confirm("Delete this saved scan? This can't be undone.")) return;
    deleteButton.disabled = true;
    if (scan.photo_path) {
      await supabaseClient.storage.from(PHOTO_BUCKET).remove([scan.photo_path]);
    }
    const { error } = await supabaseClient.from("scans").delete().eq("id", scan.id);
    if (error) {
      alert("Couldn't delete: " + error.message);
      deleteButton.disabled = false;
    } else {
      item.remove();
      if (!savedList.children.length) refreshSavedScans(); // show the "no scans yet" note
    }
  });

  item.append(open, deleteButton);
  return item;
}

// Show a saved scan on the Results screen again
function reopenScan(scan, photoUrl) {
  // Saved rows only store name, level and "found as"; look up the rest
  // (explanation and source) from today's watch-list in polymers.js.
  const found = scan.found.map((f) => ({
    polymer: POLYMERS.find((p) => p.name === f.name) || { name: f.name, level: f.level, why: "", source: "" },
    foundAs: f.foundAs
  }));
  showResults(found, scan.scanned_text || "", photoUrl || "");
  lastScan = null;
  saveButton.hidden = false;
  saveButton.disabled = true;
  saveButtonText.textContent = "Saved";
  saveMessage.hidden = true;
  go("results");
}
