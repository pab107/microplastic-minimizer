// saving.js — SAVE scans (with their photos) and show "My saved scans".
// Only works when someone is logged in (see auth.js).
//
// Where things are stored in Supabase (set up by supabase-setup.sql):
//   - the photo  → Storage bucket "scan-photos", in a folder named after the user
//   - the result → Database table "scans" (text read, plastics found, photo location)

const PHOTO_BUCKET = "scan-photos";

// ---------- 1. Grab the parts of the page we need ----------
const saveArea        = document.getElementById("save-area");
const saveButton      = document.getElementById("save-button");
const saveLoginButton = document.getElementById("save-login-button");
const saveMessage     = document.getElementById("save-message");
const savedCard       = document.getElementById("saved-card");
const savedList       = document.getElementById("saved-list");

// ---------- 2. The "Save this scan" area under the results ----------
// app.js calls this after every successful scan. Logged in → show the Save
// button. Logged out → invite them to log in (only if accounts are set up).
function showSaveArea() {
  if (!supabaseClient || !lastScan) {
    saveArea.hidden = true;
    return;
  }
  saveArea.hidden = false;
  saveMessage.hidden = true;
  saveButton.hidden = !currentUser;
  saveButton.disabled = false;
  saveButton.textContent = "💾 Save this scan";
  saveLoginButton.hidden = !!currentUser;
}

function hideSaveArea() {
  saveArea.hidden = true;
}

function showSaveMessage(text, isError) {
  saveMessage.textContent = text;
  saveMessage.className = isError ? "auth-message error" : "auth-message";
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

// SAVE: upload the photo, then add a row to the scans table
saveButton.addEventListener("click", async () => {
  if (!currentUser || !lastScan) return;
  saveButton.disabled = true;
  saveButton.textContent = "Saving…";

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

    saveButton.textContent = "✓ Saved";
    showSaveMessage("Saved! You'll find it under “My saved scans” below.", false);
    refreshSavedScans();
  } catch (error) {
    console.error(error);
    saveButton.disabled = false;
    saveButton.textContent = "💾 Save this scan";
    showSaveMessage("Couldn't save: " + error.message, true);
  }
});

// "Log in to save": open the login form at the top of the page
saveLoginButton.addEventListener("click", () => {
  document.getElementById("login-open-button").click();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

// ---------- 3. "My saved scans" ----------
// Called by auth.js whenever someone logs in or out, and after each save.
async function refreshSavedScans() {
  if (!supabaseClient || !currentUser) {
    savedCard.hidden = true;
    savedList.innerHTML = "";
    return;
  }
  savedCard.hidden = false;

  // Get this user's scans, newest first. (The security rules make sure
  // Supabase only ever returns the logged-in user's own scans.)
  const { data: scans, error } = await supabaseClient
    .from("scans")
    .select("*")
    .order("created_at", { ascending: false });

  savedList.innerHTML = "";
  if (error) {
    console.error(error);
    savedList.innerHTML = '<li class="hint">Couldn\'t load your saved scans. Has supabase-setup.sql been run?</li>';
    return;
  }
  if (scans.length === 0) {
    savedList.innerHTML = '<li class="hint">No saved scans yet. Scan a label and press “Save this scan”.</li>';
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
  item.className = "saved-item";

  // Thumbnail of the photo
  const img = document.createElement("img");
  img.className = "saved-thumb";
  img.alt = "Scanned label";
  if (photoUrl) img.src = photoUrl;

  // Date + verdict + which plastics were found
  const info = document.createElement("div");
  info.className = "saved-info";

  const date = document.createElement("div");
  date.className = "found-as";
  date.textContent = new Date(scan.created_at).toLocaleString();

  const highCount = scan.found.filter((f) => f.level === "high").length;
  const watchCount = scan.found.length - highCount;
  const verdict = document.createElement("strong");
  if (scan.found.length === 0) {
    verdict.className = "verdict good";
    verdict.textContent = "✅ All clear";
  } else {
    verdict.className = "verdict bad";
    verdict.textContent = [
      highCount ? `⚠️ ${highCount} microplastic` : "",
      watchCount ? `👁 ${watchCount} watch` : ""
    ].filter(Boolean).join(" · ");
  }

  const names = document.createElement("div");
  names.textContent = scan.found.map((f) => f.name).join(", ");

  info.append(date, verdict, names);

  // Delete button: removes the photo and the row
  const deleteButton = document.createElement("button");
  deleteButton.className = "link-button dark";
  deleteButton.textContent = "Delete";
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

  item.append(img, info, deleteButton);
  return item;
}
