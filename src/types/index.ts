// ===== AUTH =====
export interface User {
  id: string
  email: string
  role: "student" | "teacher"
  first_name?: string
  last_name?: string
  year?: string
}

export interface AuthResponse {
  access_token: string
  token_type: string
  user?: User
}

export interface SignupData {
  email: string
  password: string
  first_name: string
  last_name: string
  role: "student" | "teacher"
  year?: string
}

export interface LoginData {
  email: string
  password: string
  role: "student" | "teacher"
}

// ===== COURSES =====
export interface Course {
  id: string
  teacher_id: string
  name: string
  code: string
  description?: string
  semester?: string
  year?: string
  syllabus_content?: string
  enrolled_students: string[]
  created_at: string
  updated_at: string
}

export interface CourseCreate {
  name: string
  code: string
  description?: string
  semester?: string
  year?: string
  syllabus_content?: string
}

export interface CourseUpdate {
  name?: string
  code?: string
  description?: string
  semester?: string
  year?: string
  syllabus_content?: string
}

export interface CourseListResponse {
  courses: Course[]
  total: number
}

// ===== LECTURES =====
export type TranscriptionStatus = "pending" | "transcribing" | "completed" | "failed"
export type GenerationStatus = "not_started" | "generating" | "completed" | "failed"

export interface Lecture {
  id: string
  course_id: string
  teacher_id: string
  title: string
  description?: string
  lecture_date?: string
  audio_filename?: string
  audio_duration_seconds?: number
  transcription_status: TranscriptionStatus
  generation_status: GenerationStatus
  created_at: string
  transcribed_at?: string
  generated_at?: string
}

export interface LectureListResponse {
  lectures: Lecture[]
  total: number
}

export interface TranscriptResponse {
  lecture_id: string
  transcript?: string
  segments: Record<string, any>[]
  status: TranscriptionStatus
}

// ===== MATERIALS =====
export type MaterialType = "pdf" | "docx" | "pptx" | "txt" | "md"
export type ProcessingStatus = "pending" | "processing" | "completed" | "failed"

export interface Material {
  id: string
  course_id: string
  teacher_id: string
  lecture_id?: string
  filename: string
  file_type: MaterialType
  file_size_bytes?: number
  content?: string
  metadata: Record<string, any>
  processing_status: ProcessingStatus
  processing_error?: string
  created_at: string
  processed_at?: string
}

export interface MaterialListResponse {
  materials: Material[]
  total: number
}

export interface MaterialUploadResponse {
  id: string
  course_id: string
  lecture_id?: string
  filename: string
  file_type: MaterialType
  processing_status: ProcessingStatus
  message: string
}

// ===== GENERATED CONTENT =====
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

export interface ContentListResponse {
  lecture_id: string
  notes?: GeneratedContent
  assignment?: GeneratedContent
  flashcards?: GeneratedContent
}

// ===== SEARCH =====
export interface SearchResult {
  id: string
  text: string
  score: number
  source?: string
  lecture_id?: string
  metadata: Record<string, any>
}

export interface SearchResponse {
  query: string
  results: SearchResult[]
  total: number
}

// ===== REALTIME =====
export interface RealtimeMessage {
  type: "audio" | "stop" | "ping"
  data?: string
  title?: string
}

export interface RealtimeServerMessage {
  type: "connected" | "ready" | "transcript" | "processing" | "complete" | "error" | "pong"
  message?: string
  text?: string
  is_final?: boolean
  lecture_id?: string
  generated?: Record<string, boolean>
  error?: string
}
