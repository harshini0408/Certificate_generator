require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const { parseExcel } = require("./utils/excelParser");
const { generateCertificate } = require("./utils/certificateGenerator");
const { sendEmail } = require("./utils/mailer");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "frontend")));

// Serve template images so frontend can render them for coordinate picking
app.use("/templates", express.static(path.join(__dirname, "templates")));

// Multer config for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === "excel") {
      cb(null, path.join(__dirname, "uploads"));
    } else if (file.fieldname.startsWith("template")) {
      cb(null, path.join(__dirname, "templates"));
    }
  },
  filename: (req, file, cb) => {
    if (file.fieldname === "excel") {
      cb(null, "data.xlsx");
    } else {
      // template1, template2, template3
      cb(null, file.fieldname + path.extname(file.originalname));
    }
  },
});

const upload = multer({ storage });

// Ensure directories exist
["uploads", "templates", "output"].forEach((dir) => {
  const dirPath = path.join(__dirname, dir);
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
});

// ---- Coordinate config storage (JSON file) ----
const CONFIG_PATH = path.join(__dirname, "templates", "config.json");

function loadConfig() {
  if (fs.existsSync(CONFIG_PATH)) {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  }
  return {};
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

// ========================
// ROUTES
// ========================

// Upload templates and excel
app.post(
  "/api/upload",
  upload.fields([
    { name: "excel", maxCount: 1 },
    { name: "template1", maxCount: 1 },
    { name: "template2", maxCount: 1 },
    { name: "template3", maxCount: 1 },
  ]),
  (req, res) => {
    try {
      const uploadedFiles = Object.keys(req.files).map((key) => key);
      res.json({
        success: true,
        message: "Files uploaded successfully",
        files: uploadedFiles,
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// Get list of uploaded templates (for coordinate picking UI)
app.get("/api/templates", (req, res) => {
  const templatesDir = path.join(__dirname, "templates");
  const templates = {};
  const exts = [".png", ".jpg", ".jpeg"];

  for (let i = 1; i <= 3; i++) {
    for (const ext of exts) {
      const fname = `template${i}${ext}`;
      if (fs.existsSync(path.join(templatesDir, fname))) {
        templates[`template${i}`] = `/templates/${fname}`;
        break;
      }
    }
  }

  const config = loadConfig();
  res.json({ success: true, templates, config });
});

// Save coordinate config for a template
app.post("/api/config", (req, res) => {
  try {
    const { templateKey, coordinates, displayWidth } = req.body;
    // coordinates = { name: {xPercent, yPercent, fontSize, color}, eventName: {...}, eventDate: {...} }
    const config = loadConfig();
    config[templateKey] = coordinates;
    // Store the display width so we can scale font sizes when generating PDFs
    if (displayWidth) {
      if (!config._displayWidths) config._displayWidths = {};
      config._displayWidths[templateKey] = displayWidth;
    }
    saveConfig(config);
    res.json({ success: true, message: `Config saved for ${templateKey}` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Preview parsed excel data
app.get("/api/preview", (req, res) => {
  try {
    const excelPath = path.join(__dirname, "uploads", "data.xlsx");
    if (!fs.existsSync(excelPath)) {
      return res
        .status(400)
        .json({ success: false, message: "No Excel file uploaded yet" });
    }
    const { valid, skipped } = parseExcel(excelPath);
    res.json({ success: true, data: valid, skipped, count: valid.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Generate certificates and optionally send via email
app.post("/api/generate-and-send", async (req, res) => {
  try {
    const excelPath = path.join(__dirname, "uploads", "data.xlsx");
    if (!fs.existsSync(excelPath)) {
      return res
        .status(400)
        .json({ success: false, message: "No Excel file uploaded yet" });
    }

    const { valid: data } = parseExcel(excelPath);
    const config = loadConfig();
    const results = [];
    const outputDir = path.join(__dirname, "output");

    // Clean output directory
    fs.readdirSync(outputDir).forEach((file) => {
      fs.unlinkSync(path.join(outputDir, file));
    });

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const templateNum = row.template;
      const templateKey = `template${templateNum}`;

      // Find template image file
      let templateImagePath = null;
      const exts = [".png", ".jpg", ".jpeg"];
      for (const ext of exts) {
        const p = path.join(__dirname, "templates", `template${templateNum}${ext}`);
        if (fs.existsSync(p)) {
          templateImagePath = p;
          break;
        }
      }

      if (!templateImagePath) {
        results.push({
          name: row.name,
          email: row.email,
          status: "failed",
          error: `Template ${templateNum} image not found`,
        });
        continue;
      }      // Get coordinate config for this template
      const coords = config[templateKey];
      if (!coords) {
        results.push({
          name: row.name,
          email: row.email,
          status: "failed",
          error: `No positions configured for ${templateKey}. Use the Configure tab first.`,
        });
        continue;
      }

      // Get the display width used when configuring (for font size scaling)
      const displayWidth = (config._displayWidths && config._displayWidths[templateKey]) || null;

      try {
        const safeName = row.name.replace(/[^a-zA-Z0-9]/g, "_");
        const outputFilename = `certificate_${safeName}_${i + 1}.pdf`;
        const outputPath = path.join(outputDir, outputFilename);

        await generateCertificate(templateImagePath, row, coords, outputPath, displayWidth);

        const mode = req.body.mode || "email";
        if (mode === "email") {
          await sendEmail(row.email, row.name, outputPath);
          results.push({ name: row.name, email: row.email, status: "sent" });
        } else {
          results.push({
            name: row.name,
            email: row.email,
            status: "generated",
            file: outputFilename,
          });
        }
      } catch (err) {
        results.push({
          name: row.name,
          email: row.email,
          status: "failed",
          error: err.message,
        });
      }
    }

    const successCount = results.filter(
      (r) => r.status === "sent" || r.status === "generated"
    ).length;
    const failCount = results.filter((r) => r.status === "failed").length;

    res.json({
      success: true,
      message: `Processed ${data.length} certificates. Success: ${successCount}, Failed: ${failCount}`,
      results,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Test email credentials (SMTP verify only, no email sent)
app.get("/api/test-email", async (req, res) => {
  try {
    const nodemailer = require("nodemailer");
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      return res.json({ success: false, message: "EMAIL_USER or EMAIL_PASS not set in .env" });
    }
    const appPassword = process.env.EMAIL_PASS.replace(/\s+/g, "");
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.EMAIL_USER, pass: appPassword },
    });
    await transporter.verify();
    res.json({ success: true, message: `✅ SMTP credentials valid for ${process.env.EMAIL_USER}` });
  } catch (err) {
    res.json({ success: false, message: `❌ SMTP Error: ${err.message}` });
  }
});

// Download a generated certificate
app.get("/api/download/:filename", (req, res) => {
  const filePath = path.join(__dirname, "output", req.params.filename);
  if (fs.existsSync(filePath)) {
    res.download(filePath);
  } else {
    res.status(404).json({ success: false, message: "File not found" });
  }
});

// Download all certificates list
app.get("/api/download-all", (req, res) => {
  const outputDir = path.join(__dirname, "output");
  const files = fs.readdirSync(outputDir).filter((f) => f.endsWith(".pdf"));
  if (files.length === 0) {
    return res
      .status(400)
      .json({ success: false, message: "No certificates generated yet" });
  }
  res.json({
    success: true,
    files: files.map((f) => ({
      name: f,
      url: `/api/download/${f}`,
    })),
  });
});

app.listen(PORT, () => {
  console.log(`\n  ========================================`);
  console.log(`   Yukta Certificate Generator`);
  console.log(`   Server running at http://localhost:${PORT}`);
  console.log(`  ========================================\n`);
});
