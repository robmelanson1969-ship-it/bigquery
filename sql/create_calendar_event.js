#!/usr/bin/env node
/**
 * Creates an iCal (.ics) calendar event file for an HTTP Archive crawl date.
 *
 * Accepts dates in MM-DD-YYYY format (e.g. 10-5-2024) or YYYY_MM_DD format
 * (e.g. 2024_10_05).
 *
 * Usage:
 *
 *     node sql/create_calendar_event.js 10-5-2024
 *     node sql/create_calendar_event.js 2024_10_05
 *     node sql/create_calendar_event.js 10-5-2024 crawl.ics
 *
 * Output is written to stdout by default, or to the optional file argument.
 */

const fs = require('fs');

const input = process.argv[2];
const outputFile = process.argv[3] || null;

if (!input) {
  console.error('You must pass a date as input. For example:');
  console.error('  node sql/create_calendar_event.js 10-5-2024');
  console.error('  node sql/create_calendar_event.js 2024_10_05');
  process.exit(1);
}

/**
 * Parses a date string in MM-DD-YYYY or YYYY_MM_DD format.
 * Returns { year, month, day } or null if the format is unrecognized.
 */
function parseDate(str) {
  // YYYY_MM_DD format (e.g. 2024_10_05)
  const underscoreMatch = str.match(/^(\d{4})_(\d{2})_(\d{2})$/);
  if (underscoreMatch) {
    return {
      year: underscoreMatch[1],
      month: underscoreMatch[2].padStart(2, '0'),
      day: underscoreMatch[3].padStart(2, '0'),
    };
  }

  // MM-DD-YYYY format (e.g. 10-5-2024)
  const dashMatch = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dashMatch) {
    return {
      year: dashMatch[3],
      month: dashMatch[1].padStart(2, '0'),
      day: dashMatch[2].padStart(2, '0'),
    };
  }

  return null;
}

const parsed = parseDate(input);
if (!parsed) {
  console.error(`Unrecognized date format: "${input}"`);
  console.error('Expected MM-DD-YYYY (e.g. 10-5-2024) or YYYY_MM_DD (e.g. 2024_10_05).');
  process.exit(1);
}

const { year, month, day } = parsed;

// Validate the date using numeric arguments to avoid locale-dependent parsing
// and to catch invalid dates (e.g. Feb 30) without silent rollover.
const y = parseInt(year, 10);
const m = parseInt(month, 10);
const d = parseInt(day, 10);
const date = new Date(Date.UTC(y, m - 1, d));
if (
  isNaN(date.getTime()) ||
  date.getUTCFullYear() !== y ||
  date.getUTCMonth() + 1 !== m ||
  date.getUTCDate() !== d
) {
  console.error(`Invalid date: "${input}"`);
  process.exit(1);
}

// Build the next-day date for DTEND (all-day event).
const nextDay = new Date(date);
nextDay.setUTCDate(nextDay.getUTCDate() + 1);
const nextYear = String(nextDay.getUTCFullYear());
const nextMonth = String(nextDay.getUTCMonth() + 1).padStart(2, '0');
const nextDayStr = String(nextDay.getUTCDate()).padStart(2, '0');

// Generate a unique event ID based on the date.
const uid = `httparchive-crawl-${year}${month}${day}@httparchive.org`;

// Format the current timestamp for DTSTAMP (required by RFC 5545).
const now = new Date();
const dtstamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

const ics = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//HTTP Archive//BigQuery Crawl//EN',
  'CALSCALE:GREGORIAN',
  'METHOD:PUBLISH',
  'BEGIN:VEVENT',
  `UID:${uid}`,
  `DTSTAMP:${dtstamp}`,
  `DTSTART;VALUE=DATE:${year}${month}${day}`,
  `DTEND;VALUE=DATE:${nextYear}${nextMonth}${nextDayStr}`,
  'SUMMARY:HTTP Archive Crawl',
  `DESCRIPTION:HTTP Archive BigQuery data crawl for ${year}-${month}-${day}.`,
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n') + '\r\n';

if (outputFile) {
  try {
    fs.writeFileSync(outputFile, ics, 'utf8');
    console.log(`Calendar event written to ${outputFile}`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
} else {
  process.stdout.write(ics);
}
