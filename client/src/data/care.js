export const SERVICE_OPTIONS = [
  { value: 'daily_checkin', label: 'Daily check-ins' },
  { value: 'doctor_visit', label: 'Doctor visits' },
  { value: 'lab_test', label: 'Lab tests and home samples' },
  { value: 'meals_medicines', label: 'Meals and medicines' },
  { value: 'companionship', label: 'Companionship' },
  { value: 'post_hospital', label: 'Post-hospital recovery' },
];

export const WEEKDAYS = [
  { value: 'mon', label: 'Monday' },
  { value: 'tue', label: 'Tuesday' },
  { value: 'wed', label: 'Wednesday' },
  { value: 'thu', label: 'Thursday' },
  { value: 'fri', label: 'Friday' },
  { value: 'sat', label: 'Saturday' },
  { value: 'sun', label: 'Sunday' },
];

export const LANGUAGES = ['Odia', 'Hindi', 'English', 'Bengali', 'Telugu', 'Tamil'];

export const DOCUMENT_GROUPS = [
  { type: 'id', label: 'ID document', hint: 'Aadhaar, PAN, voter ID or passport' },
  { type: 'police', label: 'Police verification', hint: 'Your police clearance certificate' },
  { type: 'certificate', label: 'Training certificates', hint: 'Care, nursing or first aid training' },
];

// Bookable services, and the caregiver profile service each one needs.
export const BOOKING_SERVICES = [
  { value: 'doctor_escort', label: 'Doctor visit escort', caregiverService: 'doctor_visit' },
  { value: 'lab_test', label: 'Lab test escort', caregiverService: 'lab_test' },
  { value: 'home_sample', label: 'Home sample collection', caregiverService: 'lab_test' },
  { value: 'companionship', label: 'Companionship visit', caregiverService: 'companionship' },
  { value: 'post_hospital', label: 'Post-hospital support', caregiverService: 'post_hospital' },
  { value: 'emergency_visit', label: 'Emergency visit', caregiverService: null },
];

export const MOODS = [
  { value: 'great', label: 'Great' },
  { value: 'good', label: 'Good' },
  { value: 'okay', label: 'Okay' },
  { value: 'low', label: 'Low' },
  { value: 'unwell', label: 'Unwell' },
];

export const moodLabel = (value) => MOODS.find((mood) => mood.value === value)?.label ?? value;

export const serviceLabel = (value) =>
  SERVICE_OPTIONS.find((option) => option.value === value)?.label ?? value;

export const dayLabel = (value) => WEEKDAYS.find((day) => day.value === value)?.label ?? value;
