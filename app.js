// app.js — the BEHAVIOR of the page.
// Flow: user picks photo -> Tesseract reads the text (OCR) -> we search the
// text for anything in POLYMERS (from polymers.js) -> we show the results.

// ---------- 1. Grab the parts of the page we need to work with ----------
// document.getElementById finds an element by the id="" we gave it in index.html.
const cameraInput   = document.getElementById("camera-input");   // "Take a photo"
const libraryInput  = document.getElementById("library-input");  // "Choose from photos"
const photoPreview  = document.getElementById("photo-preview");
const progressArea  = document.getElementById("progress-area");
const progressLabel = document.getElementById("progress-label");
const progressBar   = document.getElementById("progress-bar");
const resultsBox    = document.getElementById("results");

// The most recent scan: the photo file, the text read from it, and what we
// found. It isn't all shown on the page, but saving.js needs it to save the scan.
let lastScan = null;

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
          progressLabel.textContent = "Reading text…";
          progressBar.value = Math.round(message.progress * 100);
        } else {
          // Before reading, it loads its engine and language files.
          progressLabel.textContent = "Getting ready (first scan takes longer)…";
        }
      }
    });
  }
  return ocrWorker;
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
  progressArea.hidden = false;
  progressBar.value = 0;
  try {
    const image = await prepareImage(file);
    const worker = await getOcrWorker();
    const result = await worker.recognize(image);
    return result.data.text;
  } finally {
    // "finally" runs whether it worked or failed, so the bar always goes away.
    progressArea.hidden = true;
  }
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

// ---------- 6. Show the results on the page ----------
function showResults(found, text) {
  resultsBox.innerHTML = ""; // clear old results

  // If no text was read at all, say so instead of a misleading "all clear"
  if (!text.trim()) {
    resultsBox.innerHTML = '<p class="hint">We couldn\'t find any text in this photo. Try a closer, sharper, well-lit photo of the label.</p>';
    return;
  }

  // Summary banner at the top
  const summary = document.createElement("div");
  if (found.length === 0) {
    summary.className = "summary good";
    summary.textContent = "✅ No synthetic polymers from our watch-list were found.";
  } else {
    const highCount = found.filter((f) => f.polymer.level === "high").length;
    summary.className = "summary bad";
    summary.textContent =
      `⚠️ Found ${found.length} synthetic polymer(s)` +
      (highCount ? `, ${highCount} that shed microplastics.` : ".");
  }
  resultsBox.appendChild(summary);

  // One colored box per polymer found
  for (const item of found) {
    const box = document.createElement("div");
    box.className = item.polymer.level === "high" ? "flag" : "flag watch";

    const title = document.createElement("strong");
    title.textContent = item.polymer.name;
    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = item.polymer.level === "high" ? "Microplastic" : "Watch";
    title.appendChild(badge);

    const why = document.createElement("div");
    why.textContent = item.polymer.why;

    const foundAs = document.createElement("div");
    foundAs.className = "found-as";
    foundAs.textContent = "Found as: " + item.foundAs.join(", ");

    // Where we got this from, so users can see why it was flagged
    const source = document.createElement("div");
    source.className = "found-as";
    source.textContent = "Source: " + item.polymer.source;

    box.append(title, why, foundAs, source);
    resultsBox.appendChild(box);
  }
  // Note: we use textContent (not innerHTML) for scanned words, so weird text
  // from a photo can never be treated as code on our page.

  // Flash the results card and scroll to it (on phones it's below the screen)
  const card = resultsBox.closest(".card");
  card.classList.remove("flash");
  void card.offsetWidth; // tiny trick that lets the flash animation restart
  card.classList.add("flash");
  card.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ---------- 7. Connect everything to the buttons ----------

// When the user takes or picks a photo (either button), scan it.
// "input" is whichever of the two file pickers was used.
async function handlePhoto(input) {
  const file = input.files[0];
  if (!file) return;

  // Show the photo on the page
  photoPreview.src = URL.createObjectURL(file);
  photoPreview.hidden = false;

  resultsBox.innerHTML = '<p class="hint">Scanning…</p>';
  try {
    const text = await readTextFromImage(file);
    const found = findPolymers(text);
    showResults(found, text);
    // Remember this scan, and offer to save it (only if some text was read)
    lastScan = text.trim() ? { file: file, text: text.trim(), found: found } : null;
    showSaveArea();
  } catch (error) {
    console.error(error);
    lastScan = null; // don't leave the previous photo's scan behind
    hideSaveArea();
    resultsBox.innerHTML = error.message === "unsupported-format"
      ? '<p class="hint">This photo format can\'t be opened (iPhone .HEIC photos often can\'t). Take a screenshot of the photo, or save it as JPG/PNG, and try again.</p>'
      : '<p class="hint">Sorry, we could not read that photo. Try a sharper, well-lit picture.</p>';
  }
  // Clear the picker so choosing the SAME photo again still triggers a scan
  input.value = "";
}

cameraInput.addEventListener("change", () => handlePhoto(cameraInput));
libraryInput.addEventListener("change", () => handlePhoto(libraryInput));
