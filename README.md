# Film Process Control

Web-based diagnostic tool for film processing at the University of Westminster Harrow Darkroom.

## Features

- **C-41 Colour Process**: Full 27-pattern diagnostic engine based on Kodak Z-131 manual
- **B&W Process**: Ilford FPC-based diagnostics
- **Tolerance Checking**: Action and Control limits with colour-coded warnings
- **Pattern Matching**: Automatic fault diagnosis with corrective actions
- **History Tracking**: Last 5 readings displayed, full history in Google Sheets
- **Local Storage**: Reference values and history persist in browser

## Files

- `index.html` - Main application (self-contained with embedded CSS/JS)
- `diagnostics.js` - Diagnostic engine with all patterns
- `apps-script.js` - Google Apps Script for Sheet logging

## Setup

### 1. Deploy to GitHub Pages

1. Create a new repository on GitHub
2. Upload `index.html` and `diagnostics.js`
3. Go to Settings > Pages
4. Set source to "Deploy from a branch" and select `main`
5. Your app will be at `https://yourusername.github.io/repository-name/`

### 2. Set Up Google Sheets Logging

1. Create a new Google Sheet
2. Go to **Extensions > Apps Script**
3. Delete any existing code and paste the contents of `apps-script.js`
4. Click **Deploy > New deployment**
5. Select **Web app** as the type
6. Set:
   - Execute as: **Me**
   - Who has access: **Anyone**
7. Click **Deploy** and authorise when prompted
8. Copy the Web App URL
9. Edit `index.html` and replace `YOUR_APPS_SCRIPT_URL_HERE` with the URL
10. Commit and push the change

## Usage

### Setting Reference Values

1. Click **Set Reference** 
2. Enter values from your control strip batch reference
3. Click **Save Reference**

Reference values are stored in your browser and persist between sessions.

### Taking Readings

1. Select **C-41 Colour** or **B&W** tab
2. Enter densitometer readings (values ×100, matching existing spreadsheet format)
3. Click **Analyse**

### Interpreting Results

| Colour | Meaning |
|--------|---------|
| 🟢 Green | Within action limits - process OK |
| 🟡 Amber | Exceeds action limit - monitor closely |
| 🔴 Red | Exceeds control limit - stop and diagnose |

### Logging

1. After analysis, add any notes about actions taken
2. Click **Log to Sheet**
3. Entry is saved locally and sent to Google Sheets

## Diagnostic Patterns

### C-41 (27 patterns from Kodak Z-131)

- Developer: temperature, time, agitation, replenishment, mix errors (Parts A/B/C), starter, dilution, concentration, oxidation, contamination
- Bleach: dilution, underreplenishment, poor aeration, staining
- Fixer: dilution, pH issues

### B&W (6 patterns from Ilford FPC)

- Developer: underactive, overactive, low/high contrast, contamination, gradual drift

## Tolerances (×100 format)

### C-41
| Measurement | Action | Control |
|-------------|--------|---------|
| D-min | ±3 | ±5 |
| LD | ±6 | ±8 |
| HD-LD | ±7 | ±9 |
| D-maxB - YB | +10 | +12 |

### B&W
| Measurement | Action | Control |
|-------------|--------|---------|
| LD | ±6 | ±10 |
| HD-LD | ±6 | ±10 |

## Technical References

- Kodak FLEXICOLOR Chemicals Manual Z-131
- Ilford FPC User Manual
- X-Rite 891/892 Operation Manual
