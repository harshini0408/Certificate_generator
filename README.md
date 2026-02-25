# 🎓 Yukta Certificate Generator

Generate certificates from templates and distribute them via email to participants.

## Features

- Upload 3 certificate templates (PNG/JPG images)
- Upload an Excel sheet with participant details
- **Visual coordinate picker** — click on the template image to set exactly where Name, Event Name, and Date should appear
- Auto-generate PDF certificates with text overlaid at the exact positions you set
- Send certificates via email (Gmail SMTP)
- Download generated certificates as PDFs
- **Silently skips** rows with missing Name or Email (no errors)

## Certificate Templates

| Template | Type | Fields |
|----------|------|--------|
| Template 1 | Technical | Name, Event Name, Event Date |
| Template 2 | Non-Technical | Name, Event Name, Event Date |
| Template 3 | Workshop | Name, Event Name, Event Date |

## Excel Sheet Format

| Name | Email | Event Name | Event Date | Template |
|------|-------|------------|------------|----------|
| Alice | alice@example.com | CodeStorm 2026 | 15/02/2026 | 1 |
| Bob | bob@example.com | Yukta Quiz | 15/02/2026 | 2 |
| Carol | carol@example.com | IoT Workshop | 16/02/2026 | 3 |

- **Template** column: 1 (Technical), 2 (Non-Technical), 3 (Workshop)
- Rows with missing **Name** or **Email** are silently skipped

## Setup

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure Email (for sending certificates)

Edit `backend/.env`:

```env
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
```

**To get a Gmail App Password:**
1. Enable **2-Step Verification** at [Google Account Security](https://myaccount.google.com/security)
2. Search for **App Passwords** in Google Account settings
3. Generate a new app password for "Mail"
4. Paste the 16-character password into `EMAIL_PASS`

### 3. Run the Server

```bash
cd backend
npm start
```

### 4. Open the App

Go to [http://localhost:3000](http://localhost:3000)

## How to Use

### Step 1: Upload
Upload your 3 certificate template images and the Excel file.

### Step 2: Configure Positions
This is the key step — for each template:
1. Select the template tab (Technical / Non-Technical / Workshop)
2. Select a field (Name / Event Name / Date)
3. **Click on the certificate image** where that text should appear
4. Adjust font size and color in the sidebar
5. Repeat for all 3 fields
6. Click **Save Positions**

The positions are saved as percentages of the image, so they work regardless of image resolution.

### Step 3: Preview & Send
1. Preview the parsed data to verify
2. Choose mode: Email or Generate Only
3. Click Generate — certificates are created and emailed/downloaded

## Creating Sample Test Data

```bash
cd backend
node create-sample-excel.js
```

## Tech Stack

- **Frontend**: HTML, CSS, JavaScript (vanilla) — single file, no build step
- **Backend**: Node.js, Express
- **Certificate Generation**: pdf-lib (overlays text on images → PDF)
- **Excel Parsing**: xlsx (SheetJS)
- **Email**: Nodemailer (Gmail SMTP)
