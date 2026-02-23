import { BrowserRouter as Router, Routes, Route } from "react-router-dom"
import LandingPage from "./pages/LandingPage"
import LoginPage from "./pages/auth/LoginPage"
import SignupPage from "./pages/auth/SignupPage"
import { DashboardLayout } from "./components/dashboard/DashboardLayout"
import DashboardHome from "./pages/dashboard/DashboardHome"
import GenerateNotes from "./pages/dashboard/GenerateNotes"
import GenerateAssignments from "./pages/dashboard/GenerateAssignments"
import GenerateFlashcards from "./pages/dashboard/GenerateFlashcards"
import CoursesPage from "./pages/dashboard/CoursesPage"
import CourseDetailPage from "./pages/dashboard/CourseDetailPage"
import LectureDetailPage from "./pages/dashboard/LectureDetailPage"
import RecordLecturePage from "./pages/dashboard/RecordLecturePage"
import { ProtectedRoute } from "./components/auth/ProtectedRoute"

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<DashboardHome />} />
            <Route path="courses" element={<CoursesPage />} />
            <Route path="courses/:courseId" element={<CourseDetailPage />} />
            <Route path="courses/:courseId/record" element={<RecordLecturePage />} />
            <Route path="lectures/:lectureId" element={<LectureDetailPage />} />
            <Route path="notes" element={<GenerateNotes />} />
            <Route path="assignments" element={<GenerateAssignments />} />
            <Route path="flashcards" element={<GenerateFlashcards />} />
          </Route>
        </Route>
      </Routes>
    </Router>
  )
}

export default App
