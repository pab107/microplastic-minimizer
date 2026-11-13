// app.js — the BEHAVIOR of scanning.
// Flow: user picks photo -> Scanning screen while Tesseract reads the text (OCR)
// -> we search the text for anything in POLYMERS (from polymers.js)
// -> Results screen (or the "couldn't read" screen).

// ---------- 1. Grab the parts of the page we need to work with ----------
// document.getElementById finds an element by the id="" we gave it in index.html.
const cameraInput     = document.getElementById("camera-input");   // "Take a photo"
const libraryInput    = document.getElementById("library-input");  // "Choose from photos"
const photoPreview    = document.getElementById("photo-preview");  // photo on the Scanning screen
const progressLabel   = document.getElementById("progress-label");
const progressPercent = document.getElementById("progress-percent");
const progressFill    = document.getElementById("progress-fill");
const resultThumb     = document.getElementById("result-thumb");   // photo on the Results screen
const resultMeta      = document.getElementById("result-meta");
const verdictBox      = document.getElementById("verdict");
const foundCount      = document.getElementById("found-count");
const resultsBox      = document.getElementById("result-cards");
const errorDetail     = document.getElementById("error-detail");

// The most recent scan: the photo file, the text read from it, and what we
// found. It isn't all shown on the page, but saving.js needs it to save the scan.
let lastScan = null;

// Which screens make sense right now (screens.js checks these)
let scanInProgress = false; // the Scanning screen
let hasResults = false;     // the Results screen
let hasError = false;       // the "couldn't read this photo" screen

// ---------- 2. The OCR "worker" ----------
// A worker is a helper that runs Tesseract in the background so the page
// doesn't freeze. Creating one downloads the English language data (~10 MB),
// so we only create it once, the first time someone scans, and reuse it.
let ocrWorker = null;

async function getOcrWorker() {
  if (!ocrWorker) {
    ocrWorker = await Tesseract.createWorker("eng", 1, {
      // Tesseract calls this repeatedly to report progress (0 to 1).
      logger: (message) => {
        if (message.status === "recognizing text") {
          setProgress("Reading text…", message.progress);
        } else {
          // Before reading, it loads its engine and language files.
          setProgress("Getting ready…", 0);
        }
      }
    });
  }
  return ocrWorker;
}

// Update the progress card on the Scanning screen ("fraction" goes from 0 to 1)
function setProgress(label, fraction) {
  const percent = Math.round(fraction * 100);
  progressLabel.textContent = label;
  progressPercent.textContent = percent + "%";
  progressFill.style.width = percent + "%";
}

// ---------- 3. Prepare the photo ----------
// Tesseract reads best when letters are big, dark and sharp on a light
// background. Real photos are often too small, too large, or have busy
// backgrounds (like fabric texture). So before reading, we:
//   a) let the browser open the photo (Tesseract can't open every format)
//   b) resize it: enlarge small photos so letters are big enough to read,
//      and shrink huge phone photos so scanning stays fast
//   c) turn it gray and boost the contrast so the text stands out
// The result is drawn onto a "canvas" (an in-memory picture) for Tesseract.
async function prepareImage(file) {
  const MIN_SIZE = 1600; // pixels on the longest side — enlarge smaller photos to this
  const MAX_SIZE = 2500; // shrink bigger photos to this
  const CONTRAST = 1.8;  // 1 = unchanged; higher = darks darker, lights lighter

  // a) Open the photo
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    // The browser itself can't open it (common with iPhone .HEIC photos)
    throw new Error("unsupported-format");
  }

  // b) Resize
  const longest = Math.max(bitmap.width, bitmap.height);
  const target = Math.min(Math.max(longest, MIN_SIZE), MAX_SIZE);
  const scale = target / longest;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingQuality = "high"; // smooth edges when enlarging
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  // c) Gray + contrast. An image is a long list of pixels, each stored as
  //    4 numbers: red, green, blue, alpha (transparency). We visit each pixel.
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = image.data;
  for (let i = 0; i < px.length; i += 4) {
    // Brightness of this pixel (the standard formula for converting to gray)
    let gray = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    // Push it away from middle gray (128) to increase contrast, keep it 0–255
    gray = Math.max(0, Math.min(255, (gray - 128) * CONTRAST + 128));
    px[i] = px[i + 1] = px[i + 2] = gray;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

// ---------- 4. Read text from an image ----------
// "async" means this function waits for slow work (OCR) without freezing the page.
async function readTextFromImage(file) {
  setProgress("Getting ready…", 0);
  const image = await prepareImage(file);
  const worker = await getOcrWorker();
  const result = await worker.recognize(image);
  return result.data.text;
}

// ---------- 5. Search the text for synthetic polymers ----------
function findPolymers(text) {
  // Clean the text up so matching is easier:
  //  - lowercase, so "Nylon" and "NYLON" both match "nylon"
  //  - rejoin words split across lines like "poly-\nester"
  //  - squash runs of spaces/new lines into a single space
  let remaining = text
    .toLowerCase()
    .replace(/-\s*\n\s*/g, "")
    .replace(/\s+/g, " ");

  const found = [];

  for (const polymer of POLYMERS) {
    // "g" = find every match, "i" = ignore upper/lower case
    const searcher = new RegExp(polymer.pattern.source, "gi");
    const matches = remaining.match(searcher);

    if (matches) {
      // Remember the polymer and the exact words that matched (e.g. "nylon-12")
      const uniqueMatches = [...new Set(matches.map((m) => m.trim()))];
      found.push({ polymer: polymer, foundAs: uniqueMatches });
      // Cross out what we found so a shorter name can't match it again
      remaining = remaining.replace(searcher, " ");
    }
  }
  return found;
}

// ---------- 6. Show the results ----------
// Fills in the Results screen. "photoUrl" is the photo to show at the top.
// (saving.js also uses this to reopen a saved scan.)
function showResults(found, text, photoUrl) {
  resultThumb.src = photoUrl;
  const words = text.split(/\s+/).filter(Boolean).length;
  resultMeta.textContent = words + " words read";

  // Summary banner: red with a warning icon, or green with a check
  const highCount = found.filter((f) => f.polymer.level === "high").length;
  if (found.length === 0) {
    verdictBox.className = "verdict good";
    verdictBox.innerHTML = '<span class="verdict-icon">' + icon("checkCircle") + "</span>" +
      "<p><strong>No synthetic polymers from our watch-list found.</strong> " +
      "Our list covers the most common plastics — always double-check labels.</p>";
  } else {
    verdictBox.className = "verdict bad";
    const plural = found.length === 1 ? "polymer" : "polymers";
    verdictBox.innerHTML = '<span class="verdict-icon">' + icon("alert") + "</span>" +
      `<p><strong>${found.length} synthetic ${plural} found` +
      (highCount ? ` — ${highCount} shed microplastics` : "") + "</strong></p>";
  }
  foundCount.textContent = found.length === 1 ? "1 ingredient" : found.length + " ingredients";

  // One card per polymer found
  resultsBox.innerHTML = "";
  if (found.length === 0) {
    resultsBox.innerHTML = '<div class="card empty-card">' + icon("checkCircle") +
      "<p>Nothing on our watch-list matched the text in your photo.</p></div>";
  }
  for (const item of found) {
    const isHigh = item.polymer.level === "high";
    const card = document.createElement("article");
    card.className = "card result-card";

    // Name + badge (icon AND word, so it doesn't rely on color alone)
    const head = document.createElement("div");
    head.className = "result-head";
    const name = document.createElement("h3");
    name.textContent = item.polymer.name;
    const badge = document.createElement("span");
    badge.className = isHigh ? "badge high" : "badge watch";
    badge.innerHTML = icon(isHigh ? "alert" : "eye") + (isHigh ? "Microplastic" : "Watch");
    head.append(name, badge);

    const why = document.createElement("p");
    why.className = "result-why";
    why.textContent = item.polymer.why;

    // "Found as: nylon-12   Source: Beat the Microbead Red List"
    const foot = document.createElement("div");
    foot.className = "result-foot";
    const foundAs = document.createElement("span");
    foundAs.append("Found as: ");
    const foundWords = document.createElement("strong");
    foundWords.textContent = item.foundAs.join(", ");
    foundAs.append(foundWords);
    const source = document.createElement("a");
    source.href = "#sources";
    source.textContent = "Source: " + item.polymer.source;
    foot.append(foundAs, source);

    card.append(head, why, foot);
    resultsBox.appendChild(card);
  }
  // Note: we use textContent (not innerHTML) for scanned words, so weird text
  // from a photo can never be treated as code on our page.

  hasResults = true;
}

// Show the "We couldn't read this photo" screen with a reason
function showReadError(reason) {
  errorDetail.textContent = reason;
  hasError = true;
  go("error", true);
}

// ---------- 7. Connect everything to the buttons ----------

// When the user takes or picks a photo (either button), scan it.
// "input" is whichever of the two file pickers was used.
async function handlePhoto(input) {
  const file = input.files[0];
  if (!file) return;
  // Clear the picker so choosing the SAME photo again still triggers a scan
  input.value = "";

  // Show the Scanning screen with the photo
  const photoUrl = URL.createObjectURL(file);
  photoPreview.src = photoUrl;
  scanInProgress = true;
  hasResults = false;
  hasError = false;
  lastScan = null; // don't leave the previous photo's scan behind
  go("scanning");

  try {
    const text = await readTextFromImage(file);
    if (!text.trim()) {
      showReadError("We couldn't find any text in it.");
    } else {
      const found = findPolymers(text);
      showResults(found, text, photoUrl);
      // Remember this scan, so it can be saved
      lastScan = { file: file, text: text.trim(), found: found };
      showSaveArea();
      go("results", true);
    }
  } catch (error) {
    console.error(error);
    showReadError(error.message === "unsupported-format"
      ? "This photo format can't be opened (iPhone .HEIC photos often can't). Take a screenshot of the photo, or save it as JPG/PNG, and try again."
      : "Something went wrong while reading it.");
  } finally {
    scanInProgress = false; // "finally" runs whether it worked or failed
  }
}

cameraInput.addEventListener("change", () => handlePhoto(cameraInput));
libraryInput.addEventListener("change", () => handlePhoto(libraryInput));
