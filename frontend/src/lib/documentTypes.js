export const DOCUMENT_TYPES = [
  { value: 'LEARNING_PLAN', label: 'Learning Plan' },
  { value: 'SESSION_PLAN', label: 'Session Plan' },
  { value: 'RECORD_OF_WORK', label: 'Record of Work' },
  { value: 'WORK_LOAD', label: 'Work Load' },
  { value: 'TIMETABLE', label: 'Timetable' },
];

export function documentTypeLabel(type) {
  return DOCUMENT_TYPES.find((t) => t.value === type)?.label || type;
}

// 2026-2029 per the college's request; extend this list as later years are needed.
export const ACADEMIC_YEARS = ['2026', '2027', '2028', '2029'];

export const SEMESTERS = ['Term 1', 'Term 2', 'Term 3'];
