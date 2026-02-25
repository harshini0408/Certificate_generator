const { PDFDocument, rgb, StandardFonts } = require("pdf-lib");
const fs = require("fs");
const path = require("path");

/**
 * Generate a certificate PDF by overlaying text on the template image
 * at the exact coordinates configured via the UI.
 *
 * @param {string} templateImagePath - Path to the template image (PNG/JPG)
 * @param {object} participant - { name, eventName, eventDate }
 * @param {object} coords - { name: {xPercent, yPercent, fontSize, color}, eventName: {...}, eventDate: {...} }
 * @param {string} outputPath - Where to save the PDF
 * @param {number|null} displayWidth - The CSS display width (px) of the image in the UI when positions were configured.
 *                                     Used to scale fontSize from screen space to actual image space.
 */
async function generateCertificate(templateImagePath, participant, coords, outputPath, displayWidth) {
  const pdfDoc = await PDFDocument.create();

  // Read and embed template image
  const imageBytes = fs.readFileSync(templateImagePath);
  const ext = path.extname(templateImagePath).toLowerCase();

  let image;
  if (ext === ".png") {
    image = await pdfDoc.embedPng(imageBytes);
  } else if (ext === ".jpg" || ext === ".jpeg") {
    image = await pdfDoc.embedJpg(imageBytes);
  } else {
    throw new Error(`Unsupported image format: ${ext}`);
  }

  const imgWidth = image.width;
  const imgHeight = image.height;

  const page = pdfDoc.addPage([imgWidth, imgHeight]);

  // Draw template image as full background
  page.drawImage(image, {
    x: 0,
    y: 0,
    width: imgWidth,
    height: imgHeight,
  });

  // Embed fonts
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Helper: parse color string "#RRGGBB" to rgb()
  function parseColor(hexColor) {
    if (!hexColor || hexColor === "#000000") return rgb(0, 0, 0);
    const hex = hexColor.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;
    return rgb(r, g, b);
  }
  // Helper: draw text at a coordinate position
  // Coordinates from the UI are stored as percentages of the image.
  // xPercent/yPercent are from top-left in screen space,
  // but PDF y=0 is at the BOTTOM, so we flip y.
  //
  // Font size scaling: The user picks fontSize while viewing the image at `displayWidth` pixels.
  // The actual image (and PDF page) is `imgWidth` pixels wide. So we scale:
  //   scaledFontSize = fontSize * (imgWidth / displayWidth)
  const fontScale = displayWidth ? (imgWidth / displayWidth) : 1;

  function drawField(text, fieldConfig, useBold) {
    if (!fieldConfig || !text) return;

    const rawFontSize = fieldConfig.fontSize || 32;
    const fontSize = Math.round(rawFontSize * fontScale);
    const font = useBold ? fontBold : fontRegular;
    const color = parseColor(fieldConfig.color);
    const textStr = String(text);

    // Convert percentage to absolute coordinates
    const xAbs = (fieldConfig.xPercent / 100) * imgWidth;
    // Flip Y: screen top-left → PDF bottom-left
    const yAbs = imgHeight - (fieldConfig.yPercent / 100) * imgHeight;

    // Center text horizontally around the click point
    const textWidth = font.widthOfTextAtSize(textStr, fontSize);
    const x = xAbs - textWidth / 2;
    const y = yAbs - fontSize / 2;

    page.drawText(textStr, {
      x: Math.max(0, x),
      y: Math.max(0, y),
      size: fontSize,
      font,
      color,
    });
  }

  // Draw each field using the saved coordinates
  drawField(participant.name, coords.name, true);
  drawField(participant.eventName, coords.eventName, false);
  drawField(String(participant.eventDate), coords.eventDate, false);

  // Save the PDF
  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(outputPath, pdfBytes);

  return outputPath;
}

module.exports = { generateCertificate };
