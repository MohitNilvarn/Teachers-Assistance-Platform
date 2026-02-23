import type {
  AuthResponse,
  LoginData,
  SignupData,
  Course,
  CourseCreate,
  CourseUpdate,
  CourseListResponse,
  Lecture,
  LectureListResponse,
  TranscriptResponse,
  Material,
  MaterialListResponse,
  MaterialUploadResponse,
  GeneratedContent,
  ContentListResponse,
  SearchResponse,
  User,
} from "../types"

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1"

function getHeaders(): Record<string, string> {
  const token = localStorage.getItem("token")
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem("token")
  if (!token) throw new Error("Not authenticated")
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  }
}

function getUploadHeaders(): Record<string, string> {
  const token = localStorage.getItem("token")
  if (!token) throw new Error("Not authenticated")
  return { Authorization: `Bearer ${token}` }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const text = await response.text()
    let detail = `Request failed (${response.status})`
    try {
      const err = JSON.parse(text)
      if (typeof err.detail === "string") detail = err.detail
      else if (Array.isArray(err.detail)) {
        const first = err.detail[0]
        detail = first?.msg || detail
      }
    } catch {
      if (text) detail = text
    }
    throw new Error(detail)
  }
  if (response.status === 204) return undefined as T
  return response.json()
}

// ===================== AUTH =====================
export const authApi = {
  async login(data: LoginData): Promise<AuthResponse> {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    return handleResponse<AuthResponse>(res)
  },

  async signup(data: SignupData) {
    const res = await fetch(`${API_URL}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    return handleResponse<{ message: string; user_id: string }>(res)
  },

  async logout() {
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: "POST",
        headers: getHeaders(),
      })
    } catch {
      // swallow
    } finally {
      localStorage.removeItem("token")
      localStorage.removeItem("user")
      localStorage.removeItem("role")
    }
  },

  async me(): Promise<User> {
    const res = await fetch(`${API_URL}/users/me`, { headers: getAuthHeaders() })
    return handleResponse<User>(res)
  },
}

// ===================== COURSES =====================
export const coursesApi = {
  async list(): Promise<CourseListResponse> {
    const res = await fetch(`${API_URL}/courses`, { headers: getAuthHeaders() })
    return handleResponse<CourseListResponse>(res)
  },

  async get(courseId: string): Promise<Course> {
    const res = await fetch(`${API_URL}/courses/${courseId}`, { headers: getAuthHeaders() })
    return handleResponse<Course>(res)
  },

  async create(data: CourseCreate): Promise<Course> {
    const res = await fetch(`${API_URL}/courses`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    })
    return handleResponse<Course>(res)
  },

  async update(courseId: string, data: CourseUpdate): Promise<Course> {
    const res = await fetch(`${API_URL}/courses/${courseId}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    })
    return handleResponse<Course>(res)
  },

  async delete(courseId: string): Promise<void> {
    const res = await fetch(`${API_URL}/courses/${courseId}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    })
    return handleResponse<void>(res)
  },

  async enroll(courseId: string, studentId: string) {
    const res = await fetch(`${API_URL}/courses/${courseId}/enroll`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ student_id: studentId }),
    })
    return handleResponse<{ message: string }>(res)
  },
}

// ===================== LECTURES =====================
export const lecturesApi = {
  async list(courseId: string): Promise<LectureListResponse> {
    const res = await fetch(`${API_URL}/${courseId}/lectures`, { headers: getAuthHeaders() })
    return handleResponse<LectureListResponse>(res)
  },

  async get(lectureId: string): Promise<Lecture> {
    const res = await fetch(`${API_URL}/lectures/${lectureId}`, { headers: getAuthHeaders() })
    return handleResponse<Lecture>(res)
  },

  async create(courseId: string, title: string, description?: string, audioFile?: File): Promise<Lecture> {
    const formData = new FormData()
    formData.append("title", title)
    if (description) formData.append("description", description)
    if (audioFile) formData.append("audio_file", audioFile)

    const res = await fetch(`${API_URL}/${courseId}/lectures`, {
      method: "POST",
      headers: getUploadHeaders(),
      body: formData,
    })
    return handleResponse<Lecture>(res)
  },

  async delete(lectureId: string): Promise<void> {
    const res = await fetch(`${API_URL}/lectures/${lectureId}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    })
    return handleResponse<void>(res)
  },

  async transcribe(lectureId: string, force = false): Promise<TranscriptResponse> {
    const res = await fetch(`${API_URL}/lectures/${lectureId}/transcribe`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ force }),
    })
    return handleResponse<TranscriptResponse>(res)
  },

  async getTranscript(lectureId: string): Promise<TranscriptResponse> {
    const res = await fetch(`${API_URL}/lectures/${lectureId}/transcript`, { headers: getAuthHeaders() })
    return handleResponse<TranscriptResponse>(res)
  },

  async generate(lectureId: string, contentTypes = ["notes", "assignment", "flashcards"], force = false) {
    const res = await fetch(`${API_URL}/lectures/${lectureId}/generate`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ content_types: contentTypes, force }),
    })
    return handleResponse<{ message: string; lecture_id: string; status: string; generated_types?: string[] }>(res)
  },
}

// ===================== MATERIALS =====================
export const materialsApi = {
  async listForCourse(courseId: string): Promise<MaterialListResponse> {
    const res = await fetch(`${API_URL}/${courseId}/materials`, { headers: getAuthHeaders() })
    return handleResponse<MaterialListResponse>(res)
  },

  async listForLecture(lectureId: string): Promise<MaterialListResponse> {
    const res = await fetch(`${API_URL}/lectures/${lectureId}/materials`, { headers: getAuthHeaders() })
    return handleResponse<MaterialListResponse>(res)
  },

  async get(materialId: string): Promise<Material> {
    const res = await fetch(`${API_URL}/materials/${materialId}`, { headers: getAuthHeaders() })
    return handleResponse<Material>(res)
  },

  async uploadForCourse(courseId: string, file: File, lectureId?: string): Promise<MaterialUploadResponse> {
    const formData = new FormData()
    formData.append("file", file)
    if (lectureId) formData.append("lecture_id", lectureId)

    const res = await fetch(`${API_URL}/${courseId}/materials`, {
      method: "POST",
      headers: getUploadHeaders(),
      body: formData,
    })
    return handleResponse<MaterialUploadResponse>(res)
  },

  async uploadForLecture(lectureId: string, file: File): Promise<MaterialUploadResponse> {
    const formData = new FormData()
    formData.append("file", file)

    const res = await fetch(`${API_URL}/lectures/${lectureId}/materials`, {
      method: "POST",
      headers: getUploadHeaders(),
      body: formData,
    })
    return handleResponse<MaterialUploadResponse>(res)
  },

  async delete(materialId: string): Promise<void> {
    const res = await fetch(`${API_URL}/materials/${materialId}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    })
    return handleResponse<void>(res)
  },
}

// ===================== CONTENT =====================
export const contentApi = {
  async getAll(lectureId: string): Promise<ContentListResponse> {
    const res = await fetch(`${API_URL}/lectures/${lectureId}/content`, { headers: getAuthHeaders() })
    return handleResponse<ContentListResponse>(res)
  },

  async getNotes(lectureId: string): Promise<GeneratedContent | null> {
    const res = await fetch(`${API_URL}/lectures/${lectureId}/notes`, { headers: getAuthHeaders() })
    if (res.status === 200) {
      const data = await res.json()
      return data || null
    }
    return null
  },

  async getAssignment(lectureId: string): Promise<GeneratedContent | null> {
    const res = await fetch(`${API_URL}/lectures/${lectureId}/assignment`, { headers: getAuthHeaders() })
    if (res.status === 200) {
      const data = await res.json()
      return data || null
    }
    return null
  },

  async getFlashcards(lectureId: string): Promise<GeneratedContent | null> {
    const res = await fetch(`${API_URL}/lectures/${lectureId}/flashcards`, { headers: getAuthHeaders() })
    if (res.status === 200) {
      const data = await res.json()
      return data || null
    }
    return null
  },

  async update(contentId: string, content: Record<string, any>): Promise<GeneratedContent> {
    const res = await fetch(`${API_URL}/content/${contentId}`, {
      method: "PATCH",
      headers: getAuthHeaders(),
      body: JSON.stringify({ content }),
    })
    return handleResponse<GeneratedContent>(res)
  },

  async delete(contentId: string): Promise<void> {
    const res = await fetch(`${API_URL}/content/${contentId}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    })
    return handleResponse<void>(res)
  },

  async searchLecture(lectureId: string, query: string, nResults = 5): Promise<SearchResponse> {
    const res = await fetch(`${API_URL}/lectures/${lectureId}/search`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ query, n_results: nResults }),
    })
    return handleResponse<SearchResponse>(res)
  },

  async searchCourse(courseId: string, query: string, nResults = 5): Promise<SearchResponse> {
    const res = await fetch(`${API_URL}/courses/${courseId}/search`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ query, n_results: nResults }),
    })
    return handleResponse<SearchResponse>(res)
  },
}

// ===================== REALTIME =====================
export function createRealtimeConnection(courseId: string): WebSocket {
  const token = localStorage.getItem("token")
  if (!token) throw new Error("Not authenticated")
  const wsBase = API_URL.replace(/^http/, "ws").replace(/\/api\/v1$/, "")
  return new WebSocket(`${wsBase}/api/v1/realtime/transcribe/${courseId}?token=${token}`)
}

// Backward-compatible api export
export const api = {
  async login(formData: FormData) {
    const email = formData.get("email") || formData.get("username")
    const password = formData.get("password")
    if (!email || !password) throw { detail: "Please provide both email and password." }
    return authApi.login({ email: email as string, password: password as string, role: "student" })
  },
  async signup(data: any) {
    return authApi.signup(data)
  },
  async logout() {
    return authApi.logout()
  },
  async me() {
    return authApi.me()
  },
  getHeaders() {
    return getHeaders()
  },
}