import type {
    AuthResponse,
    Subject,
    TeacherDashboardData,
    UnitDetail,
    Lecture,
    ContentList,
    GeneratedContent,
    Course,
    RecentContentListResponse,
    RecentLectureListResponse,
    ChatRequest,
    ChatResponse,
} from "../types"

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1"

// ──────────────────────────────────────────────
// Token helpers
// ──────────────────────────────────────────────

let isRefreshing = false
let refreshQueue: Array<{ resolve: (token: string) => void; reject: (err: Error) => void }> = []

function getHeaders(): Record<string, string> {
    const token = sessionStorage.getItem("token")
    return {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }
}

function getAuthHeaders(): Record<string, string> {
    const token = sessionStorage.getItem("token")
    return token ? { Authorization: `Bearer ${token}` } : {}
}

function clearSession() {
    sessionStorage.removeItem("token")
    sessionStorage.removeItem("refresh_token")
    sessionStorage.removeItem("role")
    sessionStorage.removeItem("user")
}

function redirectToLogin() {
    clearSession()
    // Avoid redirect loop if already on login page
    if (!window.location.pathname.includes("/login")) {
        window.location.href = "/login"
    }
}

/**
 * Try to refresh the access token using the stored refresh_token.
 * Queues concurrent callers so only one refresh request fires at a time.
 */
async function tryRefreshToken(): Promise<string> {
    const refreshToken = sessionStorage.getItem("refresh_token")
    if (!refreshToken) {
        throw new Error("No refresh token")
    }

    // If a refresh is already in-flight, queue up and wait for it
    if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
            refreshQueue.push({ resolve, reject })
        })
    }

    isRefreshing = true

    try {
        const res = await fetch(`${API_URL}/auth/refresh`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refresh_token: refreshToken }),
        })

        if (!res.ok) {
            throw new Error("Refresh failed")
        }

        const data = await res.json()
        const newToken = data.access_token as string
        const newRefresh = data.refresh_token as string

        // Persist new tokens
        sessionStorage.setItem("token", newToken)
        if (newRefresh) sessionStorage.setItem("refresh_token", newRefresh)
        if (data.user) {
            sessionStorage.setItem("user", JSON.stringify(data.user))
            sessionStorage.setItem("role", data.user.role)
        }

        // Resolve all queued callers
        refreshQueue.forEach(q => q.resolve(newToken))
        return newToken
    } catch (err) {
        // Reject all queued callers
        refreshQueue.forEach(q => q.reject(err as Error))
        throw err
    } finally {
        isRefreshing = false
        refreshQueue = []
    }
}

/**
 * Wrapper around fetch that automatically retries once on 401
 * by refreshing the access token. If refresh fails, redirects to login.
 */
async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const res = await fetch(url, options)

    if (res.status === 401) {
        try {
            const newToken = await tryRefreshToken()

            // Retry the original request with the new token
            const newHeaders = new Headers(options.headers || {})
            newHeaders.set("Authorization", `Bearer ${newToken}`)

            return fetch(url, { ...options, headers: newHeaders })
        } catch {
            redirectToLogin()
            throw new Error("Session expired. Please log in again.")
        }
    }

    return res
}

async function handleResponse<T>(res: Response): Promise<T> {
    if (!res.ok) {
        const text = await res.text()
        let detail = text || `Request failed (${res.status})`
        try {
            const parsed = JSON.parse(text)
            if (typeof parsed.detail === "string") detail = parsed.detail
            else if (Array.isArray(parsed.detail)) detail = parsed.detail[0]?.msg || detail
        } catch { /* raw text */ }
        throw new Error(detail)
    }
    return res.json() as Promise<T>
}

// ──────────────────────────────────────────────
// Auth
// ──────────────────────────────────────────────

export const api = {

    async login(payload: { email: string; password: string; role: string }): Promise<AuthResponse> {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        })
        return handleResponse<AuthResponse>(res)
    },

    async signup(data: Record<string, unknown>) {
        const res = await fetch(`${API_URL}/auth/signup`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        })
        return handleResponse<{ message: string; user_id: string }>(res)
    },

    async logout() {
        try {
            await fetch(`${API_URL}/auth/logout`, { method: "POST", headers: getHeaders() })
        } catch { /* best effort */ }
        clearSession()
    },

    async me() {
        const res = await authFetch(`${API_URL}/users/me`, { headers: getHeaders() })
        return handleResponse<Record<string, unknown>>(res)
    },

    // ── Subjects ─────────────────────────────

    async getSubjects(year: string): Promise<Subject[]> {
        const res = await authFetch(`${API_URL}/subjects?year=${year}`, { headers: getHeaders() })
        return handleResponse<Subject[]>(res)
    },

    // ── Teacher ──────────────────────────────

    async teacherSelectSubject(subjectCode: string) {
        const res = await authFetch(`${API_URL}/teachers/select-subject`, {
            method: "POST",
            headers: getHeaders(),
            body: JSON.stringify({ subject_code: subjectCode }),
        })
        return handleResponse<{ message: string; course_id: string }>(res)
    },

    async teacherDashboard(): Promise<TeacherDashboardData> {
        const res = await authFetch(`${API_URL}/teachers/dashboard`, { headers: getHeaders() })
        return handleResponse<TeacherDashboardData>(res)
    },

    async getUnitDetail(courseId: string, unitNumber: number): Promise<UnitDetail> {
        const res = await authFetch(`${API_URL}/teachers/courses/${courseId}/units/${unitNumber}`, {
            headers: getHeaders(),
        })
        return handleResponse<UnitDetail>(res)
    },

    // ── Courses ──────────────────────────────

    async getCourses(): Promise<{ courses: Course[]; total: number }> {
        const res = await authFetch(`${API_URL}/courses`, { headers: getHeaders() })
        return handleResponse<{ courses: Course[]; total: number }>(res)
    },

    async getCoursesByYear(year: string): Promise<{ courses: Course[]; total: number }> {
        const res = await authFetch(`${API_URL}/courses/by-year?year=${year}`, { headers: getHeaders() })
        return handleResponse<{ courses: Course[]; total: number }>(res)
    },

    async autoEnrollByYear(): Promise<{ message: string; total_courses: number; newly_enrolled: number }> {
        const res = await authFetch(`${API_URL}/courses/enroll-by-year`, {
            method: "POST",
            headers: getHeaders(),
        })
        return handleResponse<{ message: string; total_courses: number; newly_enrolled: number }>(res)
    },

    // ── Lectures ─────────────────────────────

    async createLecture(
        courseId: string,
        data: { title: string; unit_number: number; description?: string },
        audioFile: File,
    ): Promise<Lecture> {
        const formData = new FormData()
        formData.append("title", data.title)
        formData.append("unit_number", String(data.unit_number))
        if (data.description) formData.append("description", data.description)
        formData.append("audio_file", audioFile)

        const res = await authFetch(`${API_URL}/${courseId}/lectures`, {
            method: "POST",
            headers: getAuthHeaders(),
            body: formData,
        })
        return handleResponse<Lecture>(res)
    },

    async getLectures(courseId: string): Promise<{ lectures: Lecture[]; total: number }> {
        const res = await authFetch(`${API_URL}/${courseId}/lectures`, { headers: getHeaders() })
        return handleResponse<{ lectures: Lecture[]; total: number }>(res)
    },

    async getLecture(lectureId: string): Promise<Lecture> {
        const res = await authFetch(`${API_URL}/lectures/${lectureId}`, { headers: getHeaders() })
        return handleResponse<Lecture>(res)
    },

    // ── Transcription & Generation ───────────

    async transcribeLecture(lectureId: string, force = false) {
        const res = await authFetch(`${API_URL}/lectures/${lectureId}/transcribe`, {
            method: "POST",
            headers: getHeaders(),
            body: JSON.stringify({ force }),
        })
        return handleResponse<{ lecture_id: string; transcript: string; status: string }>(res)
    },

    async generateContent(lectureId: string, contentTypes = ["notes", "assignment", "flashcards"], force = false) {
        const res = await authFetch(`${API_URL}/lectures/${lectureId}/generate`, {
            method: "POST",
            headers: getHeaders(),
            body: JSON.stringify({ content_types: contentTypes, force }),
        })
        return handleResponse<{ message: string; lecture_id: string; status: string }>(res)
    },

    // ── Content ──────────────────────────────

    async getLectureContent(lectureId: string): Promise<ContentList> {
        const res = await authFetch(`${API_URL}/lectures/${lectureId}/content`, { headers: getHeaders() })
        return handleResponse<ContentList>(res)
    },

    async getNotes(lectureId: string): Promise<GeneratedContent | null> {
        const res = await authFetch(`${API_URL}/lectures/${lectureId}/notes`, { headers: getHeaders() })
        if (res.status === 200) return handleResponse<GeneratedContent>(res)
        return null
    },

    async getAssignment(lectureId: string): Promise<GeneratedContent | null> {
        const res = await authFetch(`${API_URL}/lectures/${lectureId}/assignment`, { headers: getHeaders() })
        if (res.status === 200) return handleResponse<GeneratedContent>(res)
        return null
    },

    async getFlashcards(lectureId: string): Promise<GeneratedContent | null> {
        const res = await authFetch(`${API_URL}/lectures/${lectureId}/flashcards`, { headers: getHeaders() })
        if (res.status === 200) return handleResponse<GeneratedContent>(res)
        return null
    },

    // ── Recent Content ───────────────────────

    async getRecentNotes(): Promise<RecentContentListResponse> {
        const res = await authFetch(`${API_URL}/recent/notes`, { headers: getHeaders() })
        return handleResponse<RecentContentListResponse>(res)
    },

    async getRecentAssignments(): Promise<RecentContentListResponse> {
        const res = await authFetch(`${API_URL}/recent/assignments`, { headers: getHeaders() })
        return handleResponse<RecentContentListResponse>(res)
    },

    async getRecentFlashcards(): Promise<RecentContentListResponse> {
        const res = await authFetch(`${API_URL}/recent/flashcards`, { headers: getHeaders() })
        return handleResponse<RecentContentListResponse>(res)
    },

    async getRecentLectures(): Promise<RecentLectureListResponse> {
        const res = await authFetch(`${API_URL}/recent/lectures`, { headers: getHeaders() })
        return handleResponse<RecentLectureListResponse>(res)
    },

    // ── Chat ─────────────────────────────────

    async askChatbot(payload: ChatRequest): Promise<ChatResponse> {
        const res = await authFetch(`${API_URL}/chat`, {
            method: "POST",
            headers: getHeaders(),
            body: JSON.stringify(payload),
        })
        return handleResponse<ChatResponse>(res)
    },

    // ── Materials ────────────────────────────

    async uploadMaterial(lectureId: string, file: File) {
        const formData = new FormData()
        formData.append("file", file)
        const res = await authFetch(`${API_URL}/lectures/${lectureId}/materials`, {
            method: "POST",
            headers: getAuthHeaders(),
            body: formData,
        })
        return handleResponse<{ id: string; filename: string; processing_status: string }>(res)
    },

    // ── Knowledge Base (unit-level materials) ──

    async getUnitMaterials(courseId: string, unitNumber: number) {
        const res = await authFetch(`${API_URL}/${courseId}/units/${unitNumber}/materials`, { headers: getHeaders() })
        return handleResponse<{ materials: Array<{id:string;filename:string;file_type:string;processing_status:string;processing_error?:string;created_at:string}>; total: number }>(res)
    },

    async uploadUnitMaterial(courseId: string, unitNumber: number, file: File) {
        const formData = new FormData()
        formData.append("file", file)
        const res = await authFetch(`${API_URL}/${courseId}/units/${unitNumber}/materials`, {
            method: "POST",
            headers: getAuthHeaders(),
            body: formData,
        })
        return handleResponse<{ id: string; filename: string; processing_status: string; message: string }>(res)
    },

    async deleteMaterial(materialId: string) {
        const res = await authFetch(`${API_URL}/materials/${materialId}`, {
            method: "DELETE",
            headers: getHeaders(),
        })
        if (!res.ok) {
            const text = await res.text()
            throw new Error(text || "Delete failed")
        }
    },

    // ── Real-time Transcription ──────────────

    /**
     * Create a WebSocket connection for real-time transcription.
     * Returns the WebSocket instance for the caller to manage.
     */
    createRealtimeTranscriptionSocket(courseId: string, unitNumber: number): WebSocket {
        const token = sessionStorage.getItem("token") || ""
        const wsBase = API_URL.replace(/^http/, "ws")
        const wsUrl = `${wsBase}/realtime/transcribe/${courseId}/${unitNumber}?token=${encodeURIComponent(token)}`
        return new WebSocket(wsUrl)
    },

    // Keep legacy helper
    getHeaders,
}