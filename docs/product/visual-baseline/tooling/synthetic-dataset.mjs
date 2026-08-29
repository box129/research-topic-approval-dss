// Synthetic dataset for the visual baseline. EVERYTHING here is fabricated.
// Names are invented, matric numbers use a clearly fictional cohort code,
// emails use the reserved .invalid TLD, and every topic is a fictional
// Public Health-style title. No real student, lecturer, or departmental record.

export const ADMIN = {
  email: 'admin@pilot-demo.invalid',
  name: 'Departmental Administrator (Demo)',
  password: 'Demo-Admin-Baseline-2026!x'
};

export const LECTURERS = [
  { key: 'L1', name: 'Dr. Folasade Okonkwo-Adebayo', email: 'f.okonkwo-adebayo@pilot-demo.invalid', password: 'Demo-Lecturer-One-2026!x' },
  { key: 'L2', name: 'Dr. Chukwuemeka Balogun', email: 'c.balogun@pilot-demo.invalid', password: 'Demo-Lecturer-Two-2026!x' }
];

// Cohort code "PHD" = "Public Health Demo"; the numbering is deliberately unlike
// any real departmental scheme.
export const STUDENTS = [
  { key: 'S1', name: 'Adaeze Nwachukwu-Ibrahim', matric: 'PHD/24/0101', email: null,                              password: 'Demo-Student-S1-2026!x' },
  { key: 'S2', name: 'Oluwaseun Fakunle',        matric: 'PHD/24/0102', email: 'seun.fakunle@pilot-demo.invalid', password: 'Demo-Student-S2-2026!x' },
  { key: 'S3', name: 'Halima Danjuma-Oyelaran',  matric: 'PHD/24/0103', email: null,                              password: 'Demo-Student-S3-2026!x' },
  { key: 'S4', name: 'Tobiloba Eze-Adeyinka',    matric: 'PHD/24/0104', email: 'tobi.eze@pilot-demo.invalid',     password: 'Demo-Student-S4-2026!x' },
  { key: 'S5', name: 'Ngozi Afolabi-Musa',       matric: 'PHD/24/0105', email: null,                              password: 'Demo-Student-S5-2026!x' },
  { key: 'S6', name: 'Ibrahim Oyewole-Chukwu',   matric: 'PHD/24/0106', email: null,                              password: 'Demo-Student-S6-2026!x' }
];

// Fictional historical corpus. Session years and supervisors are invented.
export const HISTORICAL_TOPICS = [
  { title: 'Knowledge of malaria prevention among mothers of under-fives in Osogbo', population: 'Mothers of children under five', location: 'Osogbo', study_focus: 'Malaria prevention knowledge', session_year: '2021/2022', supervisor_name: 'Dr. F. Okonkwo-Adebayo', category: 'Epidemiology', keywords: 'malaria, prevention, mothers' },
  { title: 'Uptake of routine immunisation among caregivers in peri-urban Ede', population: 'Caregivers of infants', location: 'Ede', study_focus: 'Immunisation uptake and barriers', session_year: '2021/2022', supervisor_name: 'Dr. C. Balogun', category: 'Maternal and Child Health', keywords: 'immunisation, caregivers' },
  { title: 'Hand hygiene practices among food vendors in Ile-Ife markets', population: 'Food vendors', location: 'Ile-Ife', study_focus: 'Hand hygiene compliance', session_year: '2022/2023', supervisor_name: 'Dr. F. Okonkwo-Adebayo', category: 'Environmental Health', keywords: 'hand hygiene, food vendors' },
  { title: 'Antenatal clinic attendance and mobile reminders among pregnant women in Ilesa', population: 'Pregnant women', location: 'Ilesa', study_focus: 'Clinic attendance support', session_year: '2022/2023', supervisor_name: 'Dr. C. Balogun', category: 'Maternal and Child Health', keywords: 'antenatal, reminders' },
  { title: 'Exclusive breastfeeding barriers among nursing mothers in Ikire', population: 'Nursing mothers', location: 'Ikire', study_focus: 'Exclusive breastfeeding barriers', session_year: '2022/2023', supervisor_name: 'Dr. F. Okonkwo-Adebayo', category: 'Nutrition', keywords: 'breastfeeding, mothers' },
  { title: 'Household water treatment practices in rural communities of Iwo', population: 'Rural households', location: 'Iwo', study_focus: 'Water treatment practices', session_year: '2023/2024', supervisor_name: 'Dr. C. Balogun', category: 'Environmental Health', keywords: 'water, households' },
  { title: 'Tobacco use awareness among secondary school adolescents in Osogbo', population: 'Secondary school adolescents', location: 'Osogbo', study_focus: 'Tobacco awareness', session_year: '2023/2024', supervisor_name: 'Dr. F. Okonkwo-Adebayo', category: 'Health Promotion', keywords: 'tobacco, adolescents' },
  { title: 'Hypertension screening uptake among traders in Ejigbo market', population: 'Market traders', location: 'Ejigbo', study_focus: 'Screening uptake', session_year: '2023/2024', supervisor_name: 'Dr. C. Balogun', category: 'Non-communicable Diseases', keywords: 'hypertension, screening' },
  { title: 'Menstrual hygiene management among female students in Ikirun', population: 'Female secondary students', location: 'Ikirun', study_focus: 'Menstrual hygiene management', session_year: '2024/2025', supervisor_name: 'Dr. F. Okonkwo-Adebayo', category: 'Reproductive Health', keywords: 'menstrual hygiene' },
  { title: 'Occupational hazards among sawmill workers in Ilobu', population: 'Sawmill workers', location: 'Ilobu', study_focus: 'Occupational hazard exposure', session_year: '2024/2025', supervisor_name: 'Dr. C. Balogun', category: 'Occupational Health', keywords: 'occupational, sawmill' },
  { title: 'Treatment-seeking behaviour for childhood malaria among mothers in Osogbo', population: 'Mothers of children under five', location: 'Osogbo', study_focus: 'Treatment-seeking behaviour after diagnosis', session_year: '2024/2025', supervisor_name: 'Dr. F. Okonkwo-Adebayo', category: 'Epidemiology', keywords: 'malaria, treatment-seeking' },
  { title: 'Mental health help-seeking among undergraduate students in Osogbo', population: 'Undergraduate students', location: 'Osogbo', study_focus: 'Help-seeking behaviour', session_year: '2024/2025', supervisor_name: 'Dr. C. Balogun', category: 'Mental Health', keywords: 'mental health, students' }
];

// Proposals used in the walkthroughs. Deliberately close to corpus topics so
// the similarity evidence has something meaningful to show.
export const PROPOSALS = {
  precheckHigh: { title: 'Malaria prevention knowledge among mothers of under-fives in Osogbo', population: 'Mothers of children under five', location: 'Osogbo', studyFocus: 'Malaria prevention knowledge' },
  s1Submission: { title: 'Awareness of malaria prevention among mothers of under-fives in Osogbo', population: 'Mothers of children under five', location: 'Osogbo', studyFocus: 'Malaria prevention knowledge', category: 'Epidemiology', keywords: 'malaria, prevention, mothers' },
  s1Revision:   { title: 'Malaria prevention knowledge among mothers attending immunisation clinics in Osogbo', population: 'Mothers attending immunisation clinics', location: 'Osogbo', studyFocus: 'Malaria prevention knowledge and practice', category: 'Epidemiology', keywords: 'malaria, prevention, clinics' },
  s2Pending:    { title: 'Perceived barriers to routine immunisation among caregivers in Ede', population: 'Caregivers of infants', location: 'Ede', studyFocus: 'Immunisation barriers', category: 'Maternal and Child Health', keywords: 'immunisation, barriers' },
  s3Pending:    { title: 'Hand hygiene knowledge and practice among street food vendors in Ile-Ife', population: 'Street food vendors', location: 'Ile-Ife', studyFocus: 'Hand hygiene practice', category: 'Environmental Health', keywords: 'hand hygiene, vendors' },
  s4Approved:   { title: 'Household water safety practices among rural families in Iwo local government', population: 'Rural households', location: 'Iwo', studyFocus: 'Water safety practices', category: 'Environmental Health', keywords: 'water safety, households' },
  s5Rejected:   { title: 'Hypertension awareness among market traders in Ejigbo Osun State Nigeria', population: 'Market traders', location: 'Ejigbo', studyFocus: 'Hypertension awareness', category: 'Non-communicable Diseases', keywords: 'hypertension, traders' },
  s6Unrelated:  { title: 'Sleep hygiene and academic performance among boarding students in Osogbo', population: 'Boarding secondary students', location: 'Osogbo', studyFocus: 'Sleep hygiene', category: 'Health Promotion', keywords: 'sleep, students' }
};

export const FEEDBACK = {
  s1Revision: 'Narrow the population to a specific clinic setting and state the study design and sampling approach explicitly.',
  s5Reject: 'The proposed topic duplicates an approved 2023/2024 study in the same population and location. Please propose a different focus or setting.'
};

// Bulk onboarding cohort for the admin walkthrough: two valid no-email students,
// one valid student with email, one lecturer with email, one ALREADY-EXISTING
// student (conflict), and one lecturer without email (invalid).
export const BULK_ROWS = [
  ['Kehinde Olamide-Bassey', '', 'student', 'PHD/24/0201'],
  ['Amaka Suleiman-Ojo', '', 'student', 'PHD/24/0202'],
  ['Yusuf Adeniran-Okafor', 'yusuf.adeniran@pilot-demo.invalid', 'student', 'PHD/24/0203'],
  ['Dr. Ronke Esan-Mohammed', 'r.esan-mohammed@pilot-demo.invalid', 'lecturer', ''],
  ['Adaeze Nwachukwu-Ibrahim', '', 'student', 'PHD/24/0101'],
  ['Dr. Missing Email Example', '', 'lecturer', '']
];
