import { useEffect, useState } from "react"
import { useParams, useNavigate, Link } from "react-router-dom"
import { motion } from "framer-motion"
import {
  Plus, Upload, Mic, FileText, BookOpen, Layers, Trash2, Play,
  ArrowLeft, AlertCircle, Clock, CheckCircle2, XCircle, Loader2
} from "lucide-react"
import { Button } from "../../components/ui/Button"
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/Card"
import { Input } from "../../components/ui/Input"
import { coursesApi, lecturesApi, materialsApi } from "../../lib/api"
import type { Course, Lecture, Material } from "../../types"

function StatusBadge({ status, label }: { status: string; label: string }) {
  const map: Record<string, { color: string; icon: React.ReactNode }> = {
    pending: { color: "bg-yellow-100 text-yellow-700", icon: <Clock className="h-3 w-3" /> },
    transcribing: { color: "bg-blue-100 text-blue-700", icon: <Loader2 className="h-3 w-3 animate-spin" /> },
    generating: { color: "bg-blue-100 text-blue-700", icon: <Loader2 className="h-3 w-3 animate-spin" /> },
    completed: { color: "bg-green-100 text-green-700", icon: <CheckCircle2 className="h-3 w-3" /> },
    failed: { color: "bg-red-100 text-red-700", icon: <XCircle className="h-3 w-3" /> },
    not_started: { color: "bg-gray-100 text-gray-600", icon: <Clock className="h-3 w-3" /> },
  }
  const s = map[status] || map.pending
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${s.color}`}>
      {s.icon} {label}
    </span>
  )
}

export default function CourseDetailPage() {
  const { courseId } = useParams<{ courseId: string }>()
  const navigate = useNavigate()
  const role = localStorage.getItem("role")
  const isTeacher = role === "teacher"

  const [course, setCourse] = useState<Course | null>(null)
  const [lectures, setLectures] = useState<Lecture[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  // Create lecture form
  const [showCreateLecture, setShowCreateLecture] = useState(false)
  const [lectureTitle, setLectureTitle] = useState("")
  const [lectureDesc, setLectureDesc] = useState("")
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [creating, setCreating] = useState(false)

  // Upload material
  const [uploadingMaterial, setUploadingMaterial] = useState(false)

  // Processing states
  const [processingLecture, setProcessingLecture] = useState<string | null>(null)

  const fetchData = async () => {
    if (!courseId) return
    try {
      setLoading(true)
      const [courseData, lecturesData, materialsData] = await Promise.all([
        coursesApi.get(courseId),
        lecturesApi.list(courseId),
        materialsApi.listForCourse(courseId),
      ])
      setCourse(courseData)
      setLectures(lecturesData.lectures)
      setMaterials(materialsData.materials)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [courseId])

  const handleCreateLecture = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!courseId) return
    setCreating(true)
    setError("")
    try {
      await lecturesApi.create(courseId, lectureTitle, lectureDesc || undefined, audioFile || undefined)
      setShowCreateLecture(false)
      setLectureTitle(""); setLectureDesc(""); setAudioFile(null)
      await fetchData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setCreating(false)
    }
  }

  const handleUploadMaterial = async (file: File) => {
    if (!courseId) return
    setUploadingMaterial(true)
    setError("")
    try {
      await materialsApi.uploadForCourse(courseId, file)
      await fetchData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setUploadingMaterial(false)
    }
  }

  const handleTranscribe = async (lectureId: string) => {
    setProcessingLecture(lectureId)
    setError("")
    try {
      await lecturesApi.transcribe(lectureId)
      await fetchData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setProcessingLecture(null)
    }
  }

  const handleGenerate = async (lectureId: string) => {
    setProcessingLecture(lectureId)
    setError("")
    try {
      await lecturesApi.generate(lectureId)
      await fetchData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setProcessingLecture(null)
    }
  }

  const handleDeleteLecture = async (lectureId: string) => {
    if (!confirm("Delete this lecture and all its content?")) return
    try {
      await lecturesApi.delete(lectureId)
      setLectures(prev => prev.filter(l => l.id !== lectureId))
    } catch (err: any) {
      setError(err.message)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" />
      </div>
    )
  }

  if (!course) {
    return (
      <div className="text-center py-20">
        <h3 className="text-lg font-semibold">Course not found</h3>
        <Link to="/dashboard/courses" className="text-blue-600 hover:underline mt-2 inline-block">Back to courses</Link>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate("/dashboard/courses")} className="p-2 hover:bg-black/5 rounded-lg transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-foreground">{course.name}</h1>
            <span className="text-xs font-mono bg-black/5 px-2 py-1 rounded">{course.code}</span>
          </div>
          <p className="text-muted-foreground">{course.description || "No description"}</p>
        </div>
        {isTeacher && (
          <div className="flex gap-2">
            <Button onClick={() => navigate(`/dashboard/courses/${courseId}/record`)} variant="outline" className="border-red-200 text-red-600 hover:bg-red-50">
              <Mic className="h-4 w-4 mr-2" /> Record Live
            </Button>
            <Button onClick={() => setShowCreateLecture(!showCreateLecture)} className="bg-black text-white hover:bg-black/90">
              <Plus className="h-4 w-4 mr-2" /> Add Lecture
            </Button>
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 flex items-center gap-2 text-destructive text-sm">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}

      {/* Create Lecture Form */}
      {showCreateLecture && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-black/10 bg-white shadow-sm">
            <CardHeader><CardTitle>Add New Lecture</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleCreateLecture} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Title</label>
                    <Input value={lectureTitle} onChange={e => setLectureTitle(e.target.value)} placeholder="Introduction to Binary Trees" required />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Audio File (optional)</label>
                    <input
                      type="file" accept=".mp3,.wav,.m4a,.ogg,.flac,.webm"
                      onChange={e => setAudioFile(e.target.files?.[0] || null)}
                      className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-black file:text-white file:text-sm hover:file:bg-black/90"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Description (optional)</label>
                  <Input value={lectureDesc} onChange={e => setLectureDesc(e.target.value)} placeholder="Brief description..." />
                </div>
                <div className="flex gap-3">
                  <Button type="submit" className="bg-black text-white hover:bg-black/90" disabled={creating}>
                    {creating ? "Creating..." : "Create Lecture"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowCreateLecture(false)}>Cancel</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Lectures */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-foreground">Lectures ({lectures.length})</h2>
        </div>

        {lectures.length === 0 ? (
          <Card className="border-dashed border-2 border-black/10 bg-transparent">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-10 w-10 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No lectures yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {lectures.map((lecture, i) => (
              <motion.div key={lecture.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
                <Card className="border-black/5 bg-white hover:shadow-md transition-all">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="font-semibold text-foreground">{lecture.title}</h3>
                          {lecture.audio_filename && (
                            <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Play className="h-3 w-3" /> Audio
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-2">
                          <StatusBadge status={lecture.transcription_status} label={`Transcript: ${lecture.transcription_status}`} />
                          <StatusBadge status={lecture.generation_status} label={`Content: ${lecture.generation_status}`} />
                          <span className="text-xs text-muted-foreground">
                            {new Date(lecture.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* View content */}
                        <Button
                          variant="outline" size="sm"
                          onClick={() => navigate(`/dashboard/lectures/${lecture.id}`)}
                        >
                          <FileText className="h-4 w-4 mr-1" /> View
                        </Button>

                        {isTeacher && (
                          <>
                            {/* Transcribe button */}
                            {lecture.audio_filename && lecture.transcription_status !== "completed" && (
                              <Button
                                variant="outline" size="sm"
                                onClick={() => handleTranscribe(lecture.id)}
                                disabled={processingLecture === lecture.id}
                              >
                                {processingLecture === lecture.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <><Mic className="h-4 w-4 mr-1" /> Transcribe</>
                                )}
                              </Button>
                            )}

                            {/* Generate button */}
                            {lecture.transcription_status === "completed" && lecture.generation_status !== "completed" && (
                              <Button
                                size="sm" className="bg-black text-white hover:bg-black/90"
                                onClick={() => handleGenerate(lecture.id)}
                                disabled={processingLecture === lecture.id}
                              >
                                {processingLecture === lecture.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <><Layers className="h-4 w-4 mr-1" /> Generate</>
                                )}
                              </Button>
                            )}

                            {/* Delete */}
                            <button
                              onClick={() => handleDeleteLecture(lecture.id)}
                              className="p-2 hover:bg-destructive/10 rounded transition-colors"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Materials */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-foreground">Course Materials ({materials.length})</h2>
          {isTeacher && (
            <label className="cursor-pointer">
              <input
                type="file" accept=".pdf,.docx,.pptx,.txt,.md" className="hidden"
                onChange={e => { if (e.target.files?.[0]) handleUploadMaterial(e.target.files[0]) }}
              />
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-black/10 text-sm font-medium hover:bg-black/5 transition-colors">
                <Upload className="h-4 w-4" />
                {uploadingMaterial ? "Uploading..." : "Upload Material"}
              </span>
            </label>
          )}
        </div>

        {materials.length === 0 ? (
          <Card className="border-dashed border-2 border-black/10 bg-transparent">
            <CardContent className="flex flex-col items-center justify-center py-8">
              <BookOpen className="h-8 w-8 text-muted-foreground mb-3" />
              <p className="text-muted-foreground text-sm">No materials uploaded</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {materials.map(material => (
              <Card key={material.id} className="border-black/5 bg-white hover:shadow-md transition-all">
                <CardContent className="py-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-sm truncate max-w-[200px]">{material.filename}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {material.file_type.toUpperCase()} • {material.file_size_bytes ? `${(material.file_size_bytes / 1024).toFixed(0)}KB` : ""}
                      </p>
                      <StatusBadge status={material.processing_status} label={material.processing_status} />
                    </div>
                    {isTeacher && (
                      <button
                        onClick={() => materialsApi.delete(material.id).then(fetchData)}
                        className="p-1 hover:bg-destructive/10 rounded"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
