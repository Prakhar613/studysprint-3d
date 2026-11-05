'use strict';
const { IST_OFFSET, DAY, WEEK, MIN } = require('./util');

const SUBJECTS = [
  { id: 'physics', name: 'Physics', color: '#2f6fed', blurb: 'Motion, light, electricity' },
  { id: 'chemistry', name: 'Chemistry', color: '#e0662b', blurb: 'Atoms, bonds, reactions' },
  { id: 'biology', name: 'Biology', color: '#1f9d55', blurb: 'Cells, genes, the human body' },
  { id: 'math', name: 'Mathematics', color: '#8b5cf6', blurb: 'Algebra, calculus, geometry' },
  { id: 'cs', name: 'Computer Science', color: '#0891b2', blurb: 'Code, data, computers' },
  { id: 'history', name: 'History', color: '#b7791f', blurb: 'India and the world' },
  { id: 'geography', name: 'Geography', color: '#0d9488', blurb: 'Land, rivers, climate' },
  { id: 'polity', name: 'Indian Polity', color: '#d6336c', blurb: 'Constitution and governance' },
];
const SUBJECT_IDS = SUBJECTS.map((s) => s.id);

const STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana',
  'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya',
  'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
];

const GRADES = [
  'Class 6-8', 'Class 9', 'Class 10', 'Class 11', 'Class 12', 'Undergraduate', 'Postgraduate', 'Exam aspirant',
];

const ROOMS = [
  { id: 'general', name: 'General', group: 'Community' },
  { id: 'motivation', name: 'Study and motivation', group: 'Community' },
  ...SUBJECTS.map((s) => ({ id: s.id, name: s.name, group: 'Subjects' })),
  { id: 'jee', name: 'JEE', group: 'Exams' },
  { id: 'neet', name: 'NEET', group: 'Exams' },
  { id: 'upsc', name: 'UPSC', group: 'Exams' },
  { id: 'boards', name: 'Board exams', group: 'Exams' },
  { id: 'gate', name: 'GATE', group: 'Exams' },
  { id: 'cuet', name: 'CUET', group: 'Exams' },
];
const ROOM_IDS = ROOMS.map((r) => r.id);

// Weekly contests, in Indian Standard Time. dow: 0 = Sunday.
const SCHEDULE = [
  { subject: 'math', dow: 1, hour: 19, minute: 0 },
  { subject: 'physics', dow: 2, hour: 19, minute: 0 },
  { subject: 'chemistry', dow: 3, hour: 19, minute: 0 },
  { subject: 'biology', dow: 4, hour: 19, minute: 0 },
  { subject: 'cs', dow: 5, hour: 19, minute: 0 },
  { subject: 'history', dow: 6, hour: 17, minute: 0 },
  { subject: 'geography', dow: 6, hour: 19, minute: 0 },
  { subject: 'polity', dow: 0, hour: 19, minute: 0 },
];

const JOIN_WINDOW_MS = 15 * MIN; // students can start any time within 15 minutes of the scheduled time
const CONTEST_QUESTIONS = 10;
const CONTEST_SECONDS = 30;

/** First occurrence of the weekly slot at or after `fromMs` (UTC ms). */
function nextOccurrence(slot, fromMs) {
  const ist = new Date(fromMs + IST_OFFSET);
  let cand = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate(), slot.hour, slot.minute) - IST_OFFSET;
  cand += ((slot.dow - ist.getUTCDay() + 7) % 7) * DAY;
  if (cand < fromMs) cand += WEEK;
  return cand;
}

function contestStatus(start, now = Date.now()) {
  if (now < start) return 'upcoming';
  if (now < start + JOIN_WINDOW_MS) return 'live';
  return 'ended';
}

/** The contest a student should currently see for a slot: the live one, or the next one. */
function currentContest(slot, now = Date.now()) {
  const next = nextOccurrence(slot, now + 1);
  const last = next - WEEK;
  const start = now >= last && now < last + JOIN_WINDOW_MS ? last : next;
  return { start, status: contestStatus(start, now), previousStart: start - WEEK };
}

const contestId = (subject, startMs) => `${subject}-${Math.round(startMs / 1000)}`;
const slotFor = (subject) => SCHEDULE.find((s) => s.subject === subject);

/** Parses and validates a contest id. Returns null for anything that is not a real scheduled occurrence. */
function parseContestId(id) {
  const m = /^([a-z]+)-(\d{9,11})$/.exec(String(id));
  if (!m) return null;
  const slot = slotFor(m[1]);
  if (!slot) return null;
  const start = Number(m[2]) * 1000;
  if (nextOccurrence(slot, start) !== start) return null;
  return { id, slot, subject: slot.subject, start, closesAt: start + JOIN_WINDOW_MS };
}

module.exports = {
  SUBJECTS, SUBJECT_IDS, STATES, GRADES, ROOMS, ROOM_IDS, SCHEDULE,
  JOIN_WINDOW_MS, CONTEST_QUESTIONS, CONTEST_SECONDS,
  nextOccurrence, contestStatus, currentContest, contestId, slotFor, parseContestId,
};
