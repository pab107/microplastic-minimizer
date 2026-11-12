# 🔬 Microplastic Minimizer

Snap a photo of a cosmetic ingredient list or a clothing tag, and the app flags
synthetic polymers that shed microplastics.

## How it works
1. **Photo → text (OCR):** [Tesseract.js](https://tesseract.projectnaptha.com/) reads the text
   right in your browser. The photo is first enlarged and turned into high-contrast
   grayscale so the text is easier to read.
2. **Text → flags:** the text is checked against a watch-list of synthetic polymers
   (`polymers.js`).
   - **Microplastic** (red): on the Beat the Microbead *Red List*, or a synthetic
     fabric fiber that sheds in the wash.
   - **Watch** (amber): on the Beat the Microbead *Orange List*; it's debated whether
     these break down.
3. **Optional accounts and saving:** with [Supabase](https://supabase.com), users can
   sign up, log in and save their scans and photos. Row Level Security rules make sure
   each user can only see their own data.

## Tech stack
- Plain **HTML, CSS and JavaScript**, with no frameworks and no build step
- **Tesseract.js** for OCR, and **Supabase** for accounts, the database and photo storage
  (both loaded from a CDN)
- Hosted on **GitHub Pages**

## Files
| File | What it does |
|---|---|
| `index.html` | Page structure |
| `style.css` | Look and layout |
| `polymers.js` | The watch-list, with a source for every entry |
| `app.js` | Scanning: photo → OCR → results |
| `supabase-config.js` | Supabase project URL and **public** (publishable) key |
| `auth.js` | Sign up, log in, log out |
| `saving.js` | Save scans and show "My saved scans" |
| `supabase-setup.sql` | One-time database, storage and security setup |

## Sources
- [Beat the Microbead – Red List](https://www.beatthemicrobead.org/guide-to-microplastics/red-list/)
  and [Orange List](https://www.beatthemicrobead.org/guide-to-microplastics/orange-list/)
  (Plastic Soup Foundation)
- [US FTC – generic names for manufactured fibers (16 CFR 303.7)](https://www.ecfr.gov/current/title-16/chapter-I/subchapter-C/part-303/section-303.7)
- [Napper & Thompson (2016), Marine Pollution Bulletin](https://doi.org/10.1016/j.marpolbul.2016.09.025)

*Educational class project. The watch-list is not exhaustive, so always double-check labels.*
