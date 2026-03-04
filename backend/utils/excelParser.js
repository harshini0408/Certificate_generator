const XLSX = require("xlsx");

/**
 * Parse the Excel file and return valid participants + skipped rows.
 *
 * Expected columns (case-insensitive):
 *   - Name
 *   - Event (or Event Name)
 *   - Date (or Event Date)
 *   - Mail (or Email)
 *   - Template — can be: 1, 2, 3, 4 OR "Template1", "Template2", "Template3", "Template4"
 *
 * Rows with missing Name are silently skipped.
 * Email (Mail) is optional — needed only when sending via email.
 */
function parseExcel(filePath) {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rawData = XLSX.utils.sheet_to_json(sheet);

  const valid = [];
  const skipped = [];

  rawData.forEach((row, index) => {
    // Normalize column headers
    const normalized = {};
    Object.keys(row).forEach((key) => {
      normalized[key.trim().toLowerCase().replace(/\s+/g, "_")] = row[key];
    });

    const participant = {
      rowNumber: index + 2,
      name: String(
        normalized["name"] || normalized["participant_name"] || ""
      ).trim(),
      email: String(
        normalized["email"] || normalized["email_id"] || normalized["mail"] || ""
      ).trim(),
      eventName: String(
        normalized["event_name"] || normalized["event"] || ""
      ).trim(),
      eventDate: normalized["event_date"] || normalized["date"] || "",
      template: 0, // parsed below
    };

    // Parse template: handles "Template1", "Template 1", "template1", 1, "1", etc.
    const rawTemplate = String(
      normalized["template"] || normalized["template_number"] || ""
    ).trim();
    const templateMatch = rawTemplate.match(/(\d+)/);
    if (templateMatch) {
      participant.template = parseInt(templateMatch[1]);
    }

    // Format date if it's an Excel serial number
    if (typeof participant.eventDate === "number") {
      const date = XLSX.SSF.parse_date_code(participant.eventDate);
      if (date) {
        participant.eventDate = `${String(date.d).padStart(2, "0")}/${String(date.m).padStart(2, "0")}/${date.y}`;
      }
    }
    participant.eventDate = String(participant.eventDate).trim();

    // --- Silent skip logic ---    // Skip if name is missing
    if (!participant.name) {
      skipped.push({
        rowNumber: participant.rowNumber,
        reason: "Name is missing",
      });
      return;
    }

    // Email is optional — only needed when sending via email
    // (no skip for missing email)    // Skip if template is invalid (must be 1, 2, 3, or 4)
    if (
      isNaN(participant.template) ||
      participant.template < 1 ||
      participant.template > 4
    ) {
      skipped.push({
        rowNumber: participant.rowNumber,
        name: participant.name,
        reason: `Invalid template: "${rawTemplate || "(empty)"}". Expected Template1, Template2, Template3, or Template4.`,
      });
      return;
    }

    // Template labels for reference
    const templateLabels = {
      1: "Technical",
      2: "Non-Technical",
      3: "Workshop",
      4: "General",
    };
    participant.templateLabel = templateLabels[participant.template];

    valid.push(participant);
  });

  return { valid, skipped };
}

module.exports = { parseExcel };
