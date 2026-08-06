export type UserRole = "super_admin" | "org_admin" | "therapist" | "assistant" | "supervisor";

export interface Profile {
  id: string;
  organization_id: string | null;
  clinic_id: string | null;
  role: UserRole;
  full_name: string;
  email: string;
  phone: string | null;
  license_number: string | null;
  specialty: string | null;
  avatar_url: string | null;
  active: boolean;
  invited_by: string | null;
  created_at: string;
  updated_at: string;
}

export type OrganizationStatus = "active" | "suspended" | "cancelled";

export interface Plan {
  id: string;
  code: string;
  name: string;
  tagline: string | null;
  monthly_price: number | null;
  annual_price: number | null;
  currency: string;
  is_custom: boolean;
  max_therapists: number | null;
  max_org_admins: number | null;
  max_assistants: number | null;
  max_supervisors: number | null;
  features: string[];
  display_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Organization {
  id: string;
  name: string;
  legal_name: string | null;
  tax_id: string | null;
  plan_id: string;
  plan?: Pick<Plan, "id" | "name" | "code"> | null;
  status: OrganizationStatus;
  billing_email: string | null;
  country: string;
  timezone: string;
  trial_ends_at: string | null;
  max_clinics: number;
  created_at: string;
  updated_at: string;
}

export interface Clinic {
  id: string;
  organization_id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  timezone: string | null;
  logo_url: string | null;
  primary_color: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export type PatientCategory = "child" | "adolescent" | "adult";

export interface Patient {
  id: string;
  organization_id: string;
  clinic_id: string;
  full_name: string;
  date_of_birth: string;
  category: PatientCategory;
  national_id: string | null;
  gender: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  address: string | null;
  occupation: string | null;
  education_level: string | null;
  referred_by: string | null;
  insurance_provider: string | null;
  insurance_policy_number: string | null;
  guardian_name: string | null;
  guardian_relationship: string | null;
  guardian_phone: string | null;
  guardian_national_id: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relationship: string | null;
  tags: string[];
  photo_url: string | null;
  primary_therapist_id: string | null;
  active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type AppointmentStatus = "scheduled" | "confirmed" | "completed" | "cancelled" | "no_show";
export type ConsultationModality = "in_person" | "virtual" | "phone";
export type ConsultationSessionType = "individual" | "family" | "couple" | "group";
export type ConsultationStatus = "draft" | "finalized";
export type NoteFormat = "soap" | "dap" | "free";
export type CaseStatus = "active" | "in_treatment" | "discharged" | "suspended";

export interface Appointment {
  id: string;
  organization_id: string;
  clinic_id: string;
  patient_id: string;
  therapist_id: string;
  clinical_record_id: string | null;
  consultation_id: string | null;
  start_time: string;
  end_time: string;
  modality: ConsultationModality;
  session_type: ConsultationSessionType;
  status: AppointmentStatus;
  reason: string | null;
  notes: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancellation_reason: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClinicalHistorySections {
  personal_history?: string;
  family_history?: string;
  medical_history?: string;
  psychiatric_history?: string;
  social_history?: string;
  mental_status_exam?: string;
}

export interface ClinicalSensitiveHistory {
  substance_use?: string;
  trauma_history?: string;
  risk_history?: string;
  legal_history?: string;
}

export interface ClinicalRecord {
  id: string;
  organization_id: string;
  clinic_id: string;
  patient_id: string;
  primary_therapist_id: string;
  status: CaseStatus;
  chief_complaint: string | null;
  diagnosis: string | null;
  diagnosis_hypothesis: string | null;
  therapeutic_objectives: string | null;
  treatment_plan: string | null;
  medications: string[];
  allergies: string[];
  history_sections: ClinicalHistorySections;
  sensitive_history: ClinicalSensitiveHistory;
  discharge_date: string | null;
  discharge_summary: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Consultation {
  id: string;
  organization_id: string;
  clinic_id: string;
  patient_id: string;
  clinical_record_id: string;
  therapist_id: string;
  appointment_id: string | null;
  session_date: string;
  duration_minutes: number | null;
  modality: ConsultationModality;
  session_type: ConsultationSessionType;
  reason: string | null;
  objectives: string | null;
  interventions: string | null;
  techniques_used: string[];
  note_format: NoteFormat;
  homework_tasks: string | null;
  next_appointment_date: string | null;
  observations: string | null;
  status: ConsultationStatus;
  signed_at: string | null;
  signed_by: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}
