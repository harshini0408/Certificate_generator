/**
 * Run this script to generate a sample Excel file for testing.
 * Usage: node create-sample-excel.js
 */
const XLSX = require("xlsx");
const path = require("path");

const data = [
  {
    Name: "Alice Johnson",
    Email: "alice@example.com",
    "Event Name": "CodeStorm 2026",
    "Event Date": "15/02/2026",
    Template: 1,
  },
  {
    Name: "Bob Smith",
    Email: "bob@example.com",
    "Event Name": "Yukta Quiz",
    "Event Date": "15/02/2026",
    Template: 2,
  },
  {
    Name: "Carol Davis",
    Email: "carol@example.com",
    "Event Name": "IoT Workshop",
    "Event Date": "16/02/2026",
    Template: 3,
  },
  {
    Name: "",
    Email: "noname@example.com",
    "Event Name": "Yukta Quiz",
    "Event Date": "16/02/2026",
    Template: 2,
  },
  {
    Name: "Eve Brown",
    Email: "",
    "Event Name": "CodeStorm 2026",
    "Event Date": "16/02/2026",
    Template: 1,
  },
  {
    Name: "Frank Lee",
    Email: "frank@example.com",
    "Event Name": "AI Workshop",
    "Event Date": "16/02/2026",
    Template: 3,
  },
];

const ws = XLSX.utils.json_to_sheet(data);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Participants");

ws["!cols"] = [
  { wch: 20 },
  { wch: 25 },
  { wch: 20 },
  { wch: 15 },
  { wch: 10 },
];

const outputPath = path.join(__dirname, "uploads", "sample_data.xlsx");
XLSX.writeFile(wb, outputPath);
console.log(`Sample Excel file created at: ${outputPath}`);
console.log(`Note: Rows 4 and 5 have missing Name/Email and will be skipped.`);
