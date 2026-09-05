# DocReader 📄⚡

> **Universal Local-First Document Reader, Converter, & Neural OCR Studio**  
> *Available as a Mobile-First PWA and Native Android App (via Capacitor).*

DocReader is a privacy-centric, zero-cloud document workspace that allows you to view, edit, convert, and extract text across **11+ document formats** directly in the browser or on your smartphone. Every single calculation, file render, conversion pipeline, and neural OCR operation runs **100% client-side** using WebAssembly and modern web APIs.

---

## 📑 Table of Contents

1. [Why DocReader? (Core Philosophy)](#-why-docreader-core-philosophy)
2. [Key Features](#-key-features)
3. [Format Support Matrix](#-format-support-matrix)
4. [Architecture & How We Made It](#-architecture--how-we-made-it)
   - [Hub-and-Spoke Universal Converter](#1-hub-and-spoke-universal-converter)
   - [Computer Vision Preprocessing Pipeline](#2-computer-vision-preprocessing-pipeline)
   - [Neural OCR Studio (Tesseract.js v7 + WASM)](#3-neural-ocr-studio)
   - [Multi-Format Document Virtualization Engine](#4-multi-format-document-virtualization-engine)
   - [High-Craft Design System (Zinc / Slate Architecture)](#5-high-craft-design-system)
   - [Cross-Platform Native Android Architecture](#6-cross-platform-native-android-architecture)
5. [User Guide (How to Use DocReader)](#-user-guide-how-to-use-docreader)
   - [Viewing Documents](#viewing-documents)
   - [Editing Documents](#editing-documents)
   - [Converting Documents](#converting-documents)
   - [Using the OCR Studio](#using-the-ocr-studio)
   - [Scanned PDF OCR](#scanned-pdf-ocr)
6. [Developer & Build Guide](#-developer--build-guide)
   - [Prerequisites](#prerequisites)
   - [Running the Local Web Server](#running-the-local-web-server)
   - [Running Verification Test Suites](#running-verification-test-suites)
   - [Building for Production](#building-for-production)
   - [Building the Native Android APK](#building-the-native-android-apk)
7. [Privacy & Security Guarantee](#-privacy--security-guarantee)

---

## 💡 Why DocReader? (Core Philosophy)

Traditional document converters and online OCR tools suffer from major pitfalls:
- **Privacy Violations**: Uploading sensitive contracts, financial statements, and medical records to remote third-party servers.
- **Paywalls & Limits**: File size caps, watermarks, rate limits, and subscription fees.
- **Bloated Native Apps**: Massive 200MB+ mobile apps burdened with trackers and intrusive advertisements.

**DocReader solves this through Local-First Engineering:**
- 🛡️ **100% Client-Side Privacy**: Zero files, images, or extracted text ever touch a server or cloud bucket.
- ⚡ **WebAssembly Speed**: High-performance WASM binaries compile C/C++ rendering and neural network runtimes straight in your browser engine.
- 📱 **Mobile-First & Installable**: Works offline as a Progressive Web App (PWA) with full service worker caching, or as a native Android APK with zero overhead.
- 🎨 **De-Uglified High-Craft Interface**: Engineered around modern zinc/slate neutrals, strict 4px/8px modular scales, and Bento grid interactions.

---

## ✨ Key Features

- **Universal Multi-Format Viewer**: Seamlessly view PDFs, Word documents (DOCX), Spreadsheets (XLSX, CSV, TSV), E-Books (EPUB), Markdown, Rich Text (RTF), JSON, Plain Text, and Images.
- **Bi-Directional Universal Converter**: Instant conversion between formats (e.g. `DOCX ⇄ PDF`, `XLSX ⇄ CSV`, `TXT ⇄ DOCX/PDF`, `MD ⇄ HTML/PDF`, etc.) with automatic file generation.
- **Adaptive Computer Vision OCR**:
  - Neural text recognition powered by **Tesseract.js v7** WebAssembly workers.
  - 18+ supported world languages (English, Spanish, French, German, Hindi, Japanese, Chinese, Russian, Arabic, and more).
  - Canvas-based image enhancements: Otsu's adaptive binarization, dynamic contrast stretching, unsharp mask sharpening, and dark mode auto-inversion.
  - Interactive bounding boxes with confidence heatmaps (🟢 High, 🟡 Medium, 🔴 Low) and tap-to-inspect metrics.
- **In-Place WYSIWYG Editor**: Built-in rich text editor (powered by Quill.js) allowing you to edit documents, modify text, and export directly to PDF, DOCX, Markdown, HTML, or TXT.
- **Scanned PDF Text Extractor**: Built-in multi-page canvas OCR pipeline for scanned PDF books, receipts, and forms without native text layers.
- **Offline PWA & Native Android APK**: Service worker precaching for complete offline capability, coupled with a Capacitor-based native Android APK build.

---

## 📊 Format Support Matrix

| Format | Read / View | In-Place Edit | Convert Targets | OCR Extraction |
| :--- | :---: | :---: | :--- | :---: |
| **PDF** (`.pdf`) | ✅ Full Multi-page | — | TXT, Markdown, DOCX | ✅ Multi-page Scan OCR |
| **Word** (`.docx`, `.doc`) | ✅ Native Typography | ✅ WYSIWYG | PDF, TXT, Markdown, HTML | — |
| **Excel** (`.xlsx`, `.xls`) | ✅ Multi-Sheet Grid | — | CSV, TSV, PDF, HTML | — |
| **Delimited** (`.csv`, `.tsv`) | ✅ Dynamic Table | — | XLSX, PDF, HTML, TXT | — |
| **Markdown** (`.md`) | ✅ Formatted HTML | ✅ WYSIWYG | PDF, DOCX, TXT, HTML | — |
| **Plain Text** (`.txt`) | ✅ Monospace Wrap | ✅ WYSIWYG | PDF, DOCX, Markdown, HTML | — |
| **E-Book** (`.epub`) | ✅ Chapter Nav | — | TXT, HTML, Markdown | — |
| **Rich Text** (`.rtf`) | ✅ Styled Parser | ✅ WYSIWYG | TXT, HTML, PDF, Markdown | — |
| **Structured** (`.json`) | ✅ Tree Formatter | — | TXT, CSV, YAML | — |
| **Images** (`.png`, `.jpg`, `.webp`) | ✅ Zoom / Pan | — | TXT, PDF, DOCX | ✅ Full Vision Studio |

---

## 🛠️ Architecture & How We Made It

The DocReader codebase is constructed as a modular, framework-free vanilla JavaScript architecture optimized for maximum mobile performance, minimal bundle overhead, and instantaneous startup.

```
doc-reader/
├── android/                 # Native Android Gradle Project (Capacitor)
├── src/
│   ├── components/          # UI Components (Toasts, Modals, Dropzones)
│   ├── services/            # Core Processing Engines
│   │   ├── converter-service.js   # Universal Hub-and-Spoke Conversion
│   │   ├── format-router.js       # File Format Dispatcher & Registry
│   │   ├── ocr-service.js         # Vision Studio & Tesseract.js WASM
│   │   ├── pdf-service.js         # PDF.js Virtualization & Scanned OCR
│   │   ├── docx-service.js        # Mammoth.js & docx Generation
│   │   ├── spreadsheet-service.js # SheetJS Workbook & Tab Virtualizer
│   │   ├── epub-service.js        # EPUB.js Rendition & Chapter Engine
│   │   ├── text-service.js        # TextDecoder & Markdown-it Parser
│   │   ├── rtf-service.js         # Custom RTF Tokenizer & Sanitizer
│   │   └── json-service.js        # JSON Syntax Highlighter & Tree Formatter
│   ├── styles/              # Design System (Zinc / Slate Architecture)
│   │   ├── index.css        # Core Tokens, Color Scale, Reset
│   │   ├── layout.css       # 52px Header, App Shell, Bottom Dock
│   │   ├── components.css   # Bento Grid, Buttons, Tinted Pills, Badges
│   │   └── viewer.css       # Document Viewport, Toolbars, Zoom Controls
│   ├── utils/               # Math, Storage & Processing Helpers
│   │   ├── file-utils.js          # Magic Byte Sniffing & MIME Detection
│   │   ├── image-preprocessor.js  # Computer Vision Convolution Pipeline
│   │   ├── storage.js             # IndexedDB Document Persistence
│   │   └── touch-gestures.js      # Mobile Touch Navigation & Pinch-Zoom
│   ├── views/               # Top-Level Screens
│   │   ├── home.js          # Bento Grid, Local Vault, File Hub
│   │   ├── viewer.js        # Universal Multi-Page Document Viewport
│   │   ├── editor.js        # Quill WYSIWYG In-Place Rich Editor
│   │   └── converter.js     # Target Format Selection & Export Progress
│   └── app.js               # Reactive State Controller & Routing Engine
├── tests/                   # Automated Verification Test Suites
│   ├── verify-converters.js # Universal Conversion Pipeline Tests
│   └── verify-ocr.js        # Computer Vision & Preprocessing Tests
├── index.html               # Main Entry Point & Web App Manifest
├── capacitor.config.json    # Mobile Native Configuration
└── vite.config.js           # Build Pipeline & PWA Workbox Config
```

---

### 1. Hub-and-Spoke Universal Converter
Instead of writing \(N \times (N-1)\) individual convert adapters for 11 formats (which would require over 110 discrete modules), DocReader implements a **Hub-and-Spoke Intermediate Representation (IR)** architecture:

```
[DOCX / MD / RTF / TXT] ───► [Sanitized HTML / Plain Text Hub] ───► [PDF / DOCX / MD / TXT]
[XLSX / TSV]             ───► [2D Array / AOA Matrix Hub]       ───► [CSV / XLSX / PDF / HTML]
[Images / Scanned PDF]   ───► [Preprocessed Pixel Matrix]       ───► [OCR String] ──► [Export Hub]
```

- **Documents**: Normalized into clean HTML / DOM fragments using `mammoth`, `markdown-it`, or `DOMPurify`. The normalized HTML hub can then be synthesized into a paginated PDF (via `jspdf` + `html2canvas`), packed into an OpenXML Word document (via `docx`), or transformed into clean Markdown (via `turndown`).
- **Tabular Data**: Extracted into a workbook object via `SheetJS`. The sheets are converted to Array-of-Arrays (AOA) or CSV streams, allowing bidirectional roundtripping between XLSX, CSV, TSV, and formatted HTML tables.

---

### 2. Computer Vision Preprocessing Pipeline
Camera shots from mobile phones often contain uneven lighting, table shadows, low contrast, and blur. Our custom `image-preprocessor.js` applies real-time computer vision transformations on an offscreen HTML5 canvas before feeding pixels to the OCR engine:

1. **Grayscale & Luminance Weighting**:
   $$\text{Gray} = 0.299R + 0.587G + 0.114B$$
2. **Otsu's Adaptive Global Binarization**:
   Calculates the statistical intra-class and inter-class pixel variance across the 256-level histogram to determine the exact threshold separation between ink and paper.
3. **Contrast Stretching**:
   Scans the 5th and 95th percentiles of the pixel histogram and stretches them across the full 0–255 dynamic range:
   $$\text{stretched} = \frac{p - p_{\min}}{p_{\max} - p_{\min}} \times 255$$
4. **Unsharp Masking (Convolution Kernel)**:
   Applies a $3 \times 3$ Laplacian spatial filter kernel to sharpen fuzzy letters captured on phone lenses:
   $$\begin{bmatrix} 0 & -1 & 0 \\ -1 & 5 & -1 \\ 0 & -1 & 0 \end{bmatrix}$$
5. **Auto-Inversion**:
   Calculates average background brightness to automatically invert white-text-on-dark-background scans.

---

### 3. Neural OCR Studio
- **Engine**: **Tesseract.js v7** running in a dedicated WebAssembly background worker to prevent freezing the UI thread.
- **Page Segmentation Modes (PSM)**: Supports automatic full-document analysis, single text blocks, sparse text (receipts and price tags), and single lines.
- **Word-Level Bounding Boxes**: Maps the exact bounding rectangles $(x, y, w, h)$ returned by the neural engine over the original canvas.
- **Confidence Heatmap**:
  - 🟢 **Green**: $\ge 85\%$ confidence
  - 🟡 **Yellow**: $60\% - 84\%$ confidence
  - 🔴 **Red**: $< 60\%$ confidence
- **Interactive Inspection**: Tap or hover on any word in the document image to inspect the OCR text and confidence percentage in real time.

---

### 4. Multi-Format Document Virtualization Engine
- **PDF Rendering**: Employs `pdfjs-dist` to render pages as crisp `<canvas>` elements scaled dynamically to the mobile viewport with touch zoom support.
- **Word (DOCX)**: Converts OpenXML structure into semantically valid HTML while isolating styles, sanitized using `DOMPurify` to protect against script injection.
- **Spreadsheets (XLSX/CSV)**: Renders virtualized tables with sticky column headers and zebra striping, enabling horizontal touch scrolling across hundreds of columns.
- **EPUB E-Books**: Employs `epubjs` with swipe pagination and custom theme injection.
- **JSON**: Formatted with expandable indentation and color-coded syntax keys.
- **RTF**: Tokenizes 7-bit ASCII control codes into formatted DOM structures.

---

### 5. High-Craft Design System
Following the principles of the **"Full-Stack & AI Engineering Master Resource Bible"**:
- **Zinc / Slate Neutral Surfaces**: No generic purple/indigo AI gradients. The palette features deep zinc neutrals (`#09090b` primary background, `#121215` card base, `#1c1c21` elevated surface).
- **Hairline Borders & Tinted Pills**: 1px subtle borders (`rgba(255, 255, 255, 0.08)`) with translucent badges (`rgba(..., 0.10)`) replacing heavy opaque chips.
- **Strict 4px/8px Modular Scale**: All margins, paddings, and button dimensions align to 4px and 8px grid steps.
- **Typography**: Crisp typographic hierarchy with negative letter-spacing (`tracking-tight: -0.015em`, `tracking-tighter: -0.03em`) and JetBrains Mono for technical metadata.
- **Bento Grid**: Asymmetric hero layout on mobile and desktop for quick access to actions and recent files.

---

### 6. Cross-Platform Native Android Architecture
DocReader is bundled natively for Android using **Capacitor 8**:
- The production web build (`dist/`) is synchronized directly to Android native assets (`android/app/src/main/assets/public`).
- Configured with edge-to-edge display, transparent navigation bars, and mobile touch optimizations.
- Native Android Gradle configuration handles camera permissions, file picker intents, and local storage seamlessly.

---

## 📖 User Guide (How to Use DocReader)

### Viewing Documents
1. **Open a File**:
   - Tap **"Open Document"** on the home screen or drag and drop any supported document into the drop zone.
   - Alternatively, tap any format chip in the **Quick Formats** bar to filter your files.
2. **Navigation**:
   - For multi-page PDFs, scroll vertically or use the floating bottom page indicator.
   - For EPUB books, swipe left/right or tap the bottom page navigation arrows.
   - For Spreadsheets, swipe horizontally to inspect table columns.
   - Pinch with two fingers on mobile to zoom in and out.

---

### Editing Documents
1. Open any editable document (**DOCX, TXT, Markdown, RTF**).
2. Tap the **"Edit"** pencil icon in the top toolbar.
3. Use the WYSIWYG toolbar to format text (Bold, Italic, Headings, Bullet Lists, Blockquotes, Links).
4. Tap **"Save"** to download the modified document, or tap **"Export ▾"** to export it as PDF, Word, Markdown, HTML, or TXT.

---

### Converting Documents
1. Open the document you wish to convert.
2. Tap the **"Convert"** icon in the toolbar (or select **"Convert Files"** on the home screen).
3. DocReader will analyze the source format and display all compatible target formats.
4. Tap your desired target format (e.g. `DOCX ➔ PDF`).
5. The conversion will execute locally and your converted file will automatically download.

---

### Using the OCR Studio
1. Tap **"OCR Studio"** on the home screen or open any image (`PNG`, `JPG`, `WEBP`).
2. **Configure OCR**:
   - Select your document's language (English, Spanish, French, German, Hindi, Japanese, Chinese, etc.).
   - Choose the Page Segmentation Mode (Auto Document, Single Block, Sparse Text, etc.).
3. **Toggle Computer Vision Enhancements**:
   - Check **"Adaptive Binarization"** to clean shadows and uneven lighting.
   - Check **"Contrast Boost"** for faint pencil or low-contrast text.
   - Check **"Edge Sharpen"** for blurred photos.
4. Tap **"Start OCR Extraction"**.
5. **Inspect & Use Results**:
   - Tap bounding boxes on the image preview to verify word recognition accuracy.
   - Use the buttons in the text panel:
     - 📋 **Copy**: Copies all recognized text to your clipboard.
     - ✏️ **Edit**: Opens the recognized text in the rich text editor for cleanup.
     - 💾 **Export ▾**: Instantly creates a downloadable PDF, Word (DOCX), Markdown, or TXT file from the scan.

---

### Scanned PDF OCR
If you open a scanned PDF that has no selectable text:
1. Tap the **"OCR Scan"** button in the top toolbar.
2. DocReader will process each page through the computer vision pipeline and extract the text.
3. Once completed, the extracted text will automatically open in the editor.

---

## 💻 Developer & Build Guide

### Prerequisites
- **Node.js**: `v18.0.0` or higher
- **npm**: `v9.0.0` or higher
- *(Optional for Android APK)*: **Android Studio** & **JDK 17+**

### Running the Local Web Server
Clone the repository and install dependencies:
```bash
git clone https://github.com/S1nhaPriyanshu/doc-reader.git
cd doc-reader
npm install
```

Start the Vite development server:
```bash
npm run dev
```
Open your browser at **`http://localhost:5173/`**.

---

### Running Verification Test Suites
Run the automated test suites to verify conversion and computer vision pipelines:
```bash
# Test Hub-and-Spoke Conversion Engine
node tests/verify-converters.js

# Test Computer Vision & Adaptive Thresholding
node tests/verify-ocr.js
```

---

### Building for Production
To compile an optimized production web build:
```bash
npm run build
```
The bundled assets and service worker will be generated in `dist/`.

---

### Building the Native Android APK
1. Compile the production web build:
   ```bash
   npm run build
   ```
2. Synchronize the build into the native Android project:
   ```bash
   npx cap sync android
   ```
3. Open the native project in Android Studio:
   ```bash
   npx cap open android
   ```
4. Build the APK directly via Gradle from the command line:
   ```bash
   cd android
   ./gradlew assembleDebug
   ```
   The resulting APK will be generated at:
   `android/app/build/outputs/apk/debug/app-debug.apk`

---

## 🔒 Privacy & Security Guarantee

DocReader was built from the ground up on the principle of **Zero-Knowledge Architecture**:

| Metric | DocReader | Traditional Online Converters |
| :--- | :---: | :---: |
| **Server Uploads** | **None (0 bytes sent)** | Full document uploaded to cloud |
| **Telemetry / Tracking** | **None** | Google Analytics, User Session Replays |
| **Account Required** | **No** | Yes / Credit Card for High Res |
| **Offline Operation** | **100% Offline** | Fails without active internet |
| **GDPR / HIPAA Safe** | **Strictly Compliant** | Requires Enterprise BAA |

---

## 📄 License

MIT License. Free and open-source for personal and commercial use.
