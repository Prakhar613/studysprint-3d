'use strict';
// Curated free and legal study resources. Every link goes to the publisher's own site.
// tags: 'all', a subject id, or 'exams'.
module.exports = [
  // School and exams
  { title: 'NCERT textbooks', url: 'https://ncert.nic.in/textbook.php', desc: 'Official free PDFs of every NCERT textbook, Class 1 to 12.', tags: ['all'], kind: 'Textbooks' },
  { title: 'NCERT ePathshala', url: 'https://epathshala.nic.in/', desc: 'NCERT e-books, flipbooks and audio-video lessons.', tags: ['all'], kind: 'Textbooks' },
  { title: 'DIKSHA', url: 'https://diksha.gov.in/', desc: 'Government of India learning platform with QR-linked textbook content.', tags: ['all'], kind: 'Courses' },
  { title: 'CBSE sample papers and marking schemes', url: 'https://cbseacademic.nic.in/', desc: 'Official sample question papers for Classes 9 to 12.', tags: ['exams'], kind: 'Exam papers' },
  { title: 'National Testing Agency (NTA)', url: 'https://nta.ac.in/', desc: 'JEE Main, NEET UG, CUET: information bulletins and past papers.', tags: ['exams', 'physics', 'chemistry', 'biology', 'math'], kind: 'Exam papers' },
  { title: 'UPSC previous question papers', url: 'https://upsc.gov.in/', desc: 'Official previous-year papers for the Civil Services examination.', tags: ['exams', 'polity', 'history', 'geography'], kind: 'Exam papers' },

  // Courses and general libraries
  { title: 'SWAYAM', url: 'https://swayam.gov.in/', desc: 'Free online courses from Indian universities, with certificates.', tags: ['all'], kind: 'Courses' },
  { title: 'NPTEL', url: 'https://nptel.ac.in/', desc: 'IIT and IISc video lectures and notes for engineering and science.', tags: ['physics', 'chemistry', 'math', 'cs', 'biology'], kind: 'Courses' },
  { title: 'National Digital Library of India', url: 'https://ndl.iitkgp.ac.in/', desc: 'Books, articles and papers in many Indian languages.', tags: ['all'], kind: 'Library' },
  { title: 'Khan Academy', url: 'https://www.khanacademy.org/', desc: 'Free lessons and practice from school level to early college.', tags: ['all'], kind: 'Courses' },
  { title: 'MIT OpenCourseWare', url: 'https://ocw.mit.edu/', desc: 'Free lecture notes, problem sets and videos from MIT courses.', tags: ['physics', 'chemistry', 'math', 'cs', 'biology'], kind: 'Courses' },
  { title: 'OpenStax', url: 'https://openstax.org/subjects', desc: 'Free peer-reviewed college textbooks. Download each as a PDF.', tags: ['all'], kind: 'Textbooks' },
  { title: 'LibreTexts', url: 'https://libretexts.org/', desc: 'Open textbooks across science, maths and social science.', tags: ['all'], kind: 'Textbooks' },
  { title: 'Internet Archive: texts', url: 'https://archive.org/details/texts', desc: 'Millions of books and papers, many free to read or download.', tags: ['all'], kind: 'Library' },
  { title: 'Project Gutenberg', url: 'https://www.gutenberg.org/', desc: 'Public-domain books to read online or download.', tags: ['all'], kind: 'Library' },

  // Physics
  { title: 'OpenStax College Physics 2e', url: 'https://openstax.org/details/books/college-physics-2e', desc: 'Free textbook with worked examples. PDF available.', tags: ['physics'], kind: 'Textbooks' },
  { title: 'PhET Interactive Simulations', url: 'https://phet.colorado.edu/', desc: 'Free simulations for physics, chemistry, biology and maths.', tags: ['physics', 'chemistry', 'biology', 'math'], kind: 'Practice' },

  // Chemistry
  { title: 'OpenStax Chemistry 2e', url: 'https://openstax.org/details/books/chemistry-2e', desc: 'Free general chemistry textbook. PDF available.', tags: ['chemistry'], kind: 'Textbooks' },
  { title: 'LibreTexts Chemistry', url: 'https://chem.libretexts.org/', desc: 'Organic, inorganic and physical chemistry texts.', tags: ['chemistry'], kind: 'Textbooks' },

  // Biology
  { title: 'OpenStax Biology 2e', url: 'https://openstax.org/details/books/biology-2e', desc: 'Free biology textbook covering cells, genetics and ecology.', tags: ['biology'], kind: 'Textbooks' },

  // Mathematics
  { title: 'OpenStax Calculus Volume 1', url: 'https://openstax.org/details/books/calculus-volume-1', desc: 'Limits, derivatives and integrals, with exercises. PDF available.', tags: ['math'], kind: 'Textbooks' },
  { title: "Paul's Online Math Notes", url: 'https://tutorial.math.lamar.edu/', desc: 'Clear notes and practice problems on algebra, calculus and differential equations.', tags: ['math'], kind: 'Practice' },

  // Computer Science
  { title: 'CS50', url: 'https://cs50.harvard.edu/x/', desc: "Harvard's free introduction to computer science and programming.", tags: ['cs'], kind: 'Courses' },
  { title: 'freeCodeCamp', url: 'https://www.freecodecamp.org/', desc: 'Free interactive coding lessons and projects.', tags: ['cs'], kind: 'Practice' },

  // History
  { title: 'Indian Culture portal', url: 'https://indianculture.gov.in/', desc: 'Ministry of Culture archive of manuscripts, rare books and heritage.', tags: ['history'], kind: 'Library' },
  { title: 'National Archives of India', url: 'https://www.nationalarchives.gov.in/', desc: 'Government records, exhibitions and research resources.', tags: ['history'], kind: 'Library' },

  // Geography
  { title: 'Bhuvan (ISRO)', url: 'https://bhuvan.nrsc.gov.in/', desc: 'ISRO satellite maps and geospatial data for India.', tags: ['geography'], kind: 'Practice' },
  { title: 'Survey of India', url: 'https://surveyofindia.gov.in/', desc: "India's national mapping agency.", tags: ['geography'], kind: 'Library' },

  // Polity
  { title: 'Constitution of India', url: 'https://legislative.gov.in/constitution-of-india/', desc: 'The full text from the Legislative Department, Government of India.', tags: ['polity'], kind: 'Textbooks' },
  { title: 'India Code', url: 'https://www.indiacode.nic.in/', desc: 'Central and state Acts in one searchable database.', tags: ['polity'], kind: 'Library' },
  { title: 'PRS Legislative Research', url: 'https://prsindia.org/', desc: 'Plain-language summaries of bills and Parliament.', tags: ['polity'], kind: 'Library' },
];
