import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { Plus, BookOpen, Users, Trash2, AlertCircle } from "lucide-react"
import { Button } from "../../components/ui/Button"
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/Card"
import { Input } from "../../components/ui/Input"
import { coursesApi } from "../../lib/api"
import type { Course } from "../../types"

export default function CoursesPage() {
  const navigate = useNavigate()
  const role = localStorage.getItem("role")
  const isTeacher = role === "teacher"

  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  // Create course form
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState("")
  const [code, setCode] = useState("")
  const [description, setDescription] = useState("")
  const [semester, setSemester] = useState("")
  const [creating, setCreating] = useState(false)

  const fetchCourses = async () => {
    try {
      setLoading(true)
      const data = await coursesApi.list()
      setCourses(data.courses)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchCourses() }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    setError("")
    try {
      await coursesApi.create({ name, code, description, semester })
      setShowCreate(false)
      setName(""); setCode(""); setDescription(""); setSemester("")
      await fetchCourses()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (courseId: string) => {
    if (!confirm("Delete this course? This will remove all lectures and materials.")) return
    try {
      await coursesApi.delete(courseId)
      setCourses(prev => prev.filter(c => c.id !== courseId))
    } catch (err: any) {
      setError(err.message)
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">My Courses</h1>
          <p className="text-muted-foreground">
            {isTeacher ? "Manage your courses and lectures" : "View your enrolled courses"}
          </p>
        </div>
        {isTeacher && (
          <Button onClick={() => setShowCreate(!showCreate)} className="bg-black text-white hover:bg-black/90">
            <Plus className="h-4 w-4 mr-2" /> New Course
          </Button>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 flex items-center gap-2 text-destructive text-sm">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}

      {showCreate && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-black/10 bg-white shadow-sm">
            <CardHeader><CardTitle>Create New Course</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Course Name</label>
                    <Input value={name} onChange={e => setName(e.target.value)} placeholder="Data Structures" required />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Course Code</label>
                    <Input value={code} onChange={e => setCode(e.target.value)} placeholder="CS201" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Description</label>
                  <textarea
                    value={description} onChange={e => setDescription(e.target.value)}
                    className="w-full rounded-md border border-input bg-transparent p-3 text-sm focus:outline-none focus:ring-2 focus:ring-black/10 resize-none h-20"
                    placeholder="Course description..."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Semester</label>
                  <Input value={semester} onChange={e => setSemester(e.target.value)} placeholder="Fall 2025" />
                </div>
                <div className="flex gap-3">
                  <Button type="submit" className="bg-black text-white hover:bg-black/90" disabled={creating}>
                    {creating ? "Creating..." : "Create Course"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" />
        </div>
      ) : courses.length === 0 ? (
        <div className="text-center py-20">
          <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground">No courses yet</h3>
          <p className="text-muted-foreground">
            {isTeacher ? "Create your first course to get started" : "You haven't been enrolled in any courses yet"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course, i) => (
            <motion.div key={course.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card
                className="hover:shadow-lg transition-all cursor-pointer border-black/5 bg-white group relative"
                onClick={() => navigate(`/dashboard/courses/${course.id}`)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono bg-black/5 px-2 py-1 rounded">{course.code}</span>
                    {isTeacher && (
                      <button
                        onClick={e => { e.stopPropagation(); handleDelete(course.id) }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-destructive/10 rounded"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </button>
                    )}
                  </div>
                  <CardTitle className="text-lg mt-2">{course.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  {course.description && (
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{course.description}</p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    {course.semester && <span>{course.semester}</span>}
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" /> {course.enrolled_students.length} students
                    </span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
