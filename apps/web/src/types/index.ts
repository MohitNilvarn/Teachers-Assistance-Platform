/* ──────────────────────────────────────────────
   Shared TypeScript types for TAP frontend
   ────────────────────────────────────────────── */
/* eslint-disable @typescript-eslint/no-explicit-any */
// Using any for dynamic API response content which varies based on generation type

// ── Auth ─────────────────────────────────────

export interface User {
  id: string
  email: string
  role: "student" | "teacher"
  first_name: string
  last_name: string
  year?: string
  subject_code?: string
}

export interface AuthResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
  user: User
}

// ── Subject Catalog ──────────────────────────

export interface SubjectUnit {
  number: number
  title: string
}

export interface Subject {
  code: string
  name: string
  year: string
  semester: number
  units: SubjectUnit[]
}

// ── Course ───────────────────────────────────

export interface CourseUnit {
  number: number
  title: string
}

export interface Course {
  id: string
  teacher_id: string
  name: string
  code: string
  description?: string
  semester?: string
  year?: string
  subject_code?: string
  units: CourseUnit[]
  syllabus_content?: string
  enrolled_students: string[]
  created_at: string
  updated_at: string
}

// ── Lecture ───────────────────────────────────

export type TranscriptionStatus = "pending" | "transcribing" | "completed" | "failed"
export type GenerationStatus = "not_started" | "generating" | "completed" | "failed"

export interface Lecture {
  id: string
  course_id: string
  teacher_id: string
  unit_number: number
  title: string
  description?: string
  audio_filename?: string
  audio_duration_seconds?: number
  transcription_status: TranscriptionStatus
  generation_status: GenerationStatus
  created_at: string
  transcribed_at?: string
  generated_at?: string
}

// ── Generated Content ────────────────────────

export type ContentType = "notes" | "assignment" | "flashcards"

export interface GeneratedContent {
  id: string
  lecture_id: string
  course_id: string
  content_type: ContentType
  content: Record<string, any>
  metadata: Record<string, any>
  version: number
  is_edited: boolean
  created_at: string
  updated_at: string
}

export interface ContentList {
  lecture_id: string
  notes?: GeneratedContent
  assignment?: GeneratedContent
  flashcards?: GeneratedContent
}

// ── Recent Content ───────────────────────────

export interface RecentContentItem {
  id: string
  lecture_id: string
  course_id: string
  unit_number: number
  content_type: ContentType
  title: string
  lecture_title: string
  course_name: string
  content: Record<string, any>
  created_at: string
  updated_at: string
}

export interface RecentContentListResponse {
  items: RecentContentItem[]
  total: number
}

export interface RecentLectureItem {
  id: string
  lecture_id: string
  course_id: string
  course_name: string
  unit_number: number
  title: string
  description?: string
  transcription_status: TranscriptionStatus | string
  generation_status: GenerationStatus | string
  created_at: string
  transcribed_at?: string
  generated_at?: string
}

export interface RecentLectureListResponse {
  items: RecentLectureItem[]
  total: number
}

// ── Teacher Dashboard ────────────────────────

export interface UnitLecture {
  id: string
  title: string
  transcription_status: TranscriptionStatus
  generation_status: GenerationStatus
  created_at: string
}

export interface DashboardUnit {
  number: number
  title: string
  lecture_count: number
  lectures: UnitLecture[]
}

export interface DashboardCourse {
  course_id: string
  subject_code: string
  name: string
  year: string
  semester: string
  enrolled_students: number
  units: DashboardUnit[]
}

export interface TeacherDashboardData {
  has_subject: boolean
  message?: string
  courses: DashboardCourse[]
}

// ── Unit Detail ──────────────────────────────

export interface UnitLectureDetail {
  id: string
  title: string
  description?: string
  audio_filename?: string
  transcription_status: TranscriptionStatus
  generation_status: GenerationStatus
  has_notes: boolean
  has_assignment: boolean
  has_flashcards: boolean
  content: Record<string, { id: string; content_type: string; created_at: string; version: number }>
  created_at: string
}

export interface UnitDetail {
  course_id: string
  subject_code: string
  course_name: string
  unit_number: number
  unit_title: string
  lectures: UnitLectureDetail[]
  total_lectures: number
}

// ── Chat ─────────────────────────────────────

export interface ChatMessage {
  role: string // "user" | "assistant"
  content: string
}

export interface ChatRequest {
  query: string
  course_id?: string
  lecture_id?: string
  history: ChatMessage[]
}

export interface ChatResponse {
  response: string
  sources: Array<{ id: string; source: string; score?: number }>
}
