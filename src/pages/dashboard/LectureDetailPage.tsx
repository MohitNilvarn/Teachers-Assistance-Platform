import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import {
  ArrowLeft, FileText, BookOpen, Layers, Loader2, AlertCircle,
  CheckCircle2, ChevronDown, ChevronUp
} from "lucide-react"
import { Button } from "../../components/ui/Button"
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/Card"
import { lecturesApi, contentApi } from "../../lib/api"
import type { Lecture, GeneratedContent, ContentListResponse } from "../../types"

export default function LectureDetailPage() {
  const { lectureId } = useParams<{ lectureId: string }>()
  const navigate = useNavigate()
  const role = localStorage.getItem("role")
  const isTeacher = role === "teacher"

  const [lecture, setLecture] = useState<Lecture | null>(null)
  const [content, setContent] = useState<ContentListResponse | null>(null)
  const [transcript, setTranscript] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [activeTab, setActiveTab] = useState<"notes" | "assignment" | "flashcards" | "transcript">("notes")
  const [showTranscript, setShowTranscript] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [transcribing, setTranscribing] = useState(false)

  const fetchData = async () => {
    if (!lectureId) return
    try {
      setLoading(true)
      const lectureData = await lecturesApi.get(lectureId)
      setLecture(lectureData)

      const [contentData, transcriptData] = await Promise.all([
        contentApi.getAll(lectureId).catch(() => null),
        lecturesApi.getTranscript(lectureId).catch(() => null),
      ])
      setContent(contentData)
      if (transcriptData?.transcript) setTranscript(transcriptData.transcript)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [lectureId])

  const handleTranscribe = async () => {
    if (!lectureId) return
    setTranscribing(true)
    setError("")
    try {
      const result = await lecturesApi.transcribe(lectureId)
      if (result.transcript) setTranscript(result.transcript)
      await fetchData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setTranscribing(false)
    }
  }

  const handleGenerate = async () => {
    if (!lectureId) return
    setGenerating(true)
    setError("")
    try {
      await lecturesApi.generate(lectureId)
      await fetchData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setGenerating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" />
      </div>
    )
  }

  if (!lecture) {
    return (
      <div className="text-center py-20">
        <h3 className="text-lg font-semibold">Lecture not found</h3>
        <button onClick={() => navigate(-1)} className="text-blue-600 hover:underline mt-2">Go back</button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-black/5 rounded-lg transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">{lecture.title}</h1>
          <p className="text-sm text-muted-foreground">
            {lecture.description || "No description"} • {new Date(lecture.created_at).toLocaleDateString()}
          </p>
        </div>
        {isTeacher && (
          <div className="flex gap-2">
            {lecture.audio_filename && lecture.transcription_status !== "completed" && (
              <Button variant="outline" onClick={handleTranscribe} disabled={transcribing}>
                {transcribing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Transcribe
              </Button>
            )}
            {lecture.transcription_status === "completed" && (
              <Button className="bg-black text-white hover:bg-black/90" onClick={handleGenerate} disabled={generating}>
                {generating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Layers className="h-4 w-4 mr-2" />}
                {lecture.generation_status === "completed" ? "Regenerate" : "Generate Content"}
              </Button>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 flex items-center gap-2 text-destructive text-sm">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}

      {/* Transcript toggle */}
      {transcript && (
        <Card className="border-black/5 bg-white">
          <button
            onClick={() => setShowTranscript(!showTranscript)}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-black/2 transition-colors"
          >
            <span className="font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" /> Transcript
            </span>
            {showTranscript ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {showTranscript && (
            <CardContent className="border-t border-black/5 pt-4">
              <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
                {transcript}
              </p>
            </CardContent>
          )}
        </Card>
      )}

      {/* Content Tabs */}
      <div className="flex gap-1 bg-black/5 p-1 rounded-lg w-fit">
        {(["notes", "assignment", "flashcards"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === tab ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab === "notes" && <FileText className="h-4 w-4 inline mr-1.5" />}
            {tab === "assignment" && <BookOpen className="h-4 w-4 inline mr-1.5" />}
            {tab === "flashcards" && <Layers className="h-4 w-4 inline mr-1.5" />}
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Content Display */}
      <ContentDisplay
        type={activeTab}
        content={
          activeTab === "notes" ? content?.notes :
          activeTab === "assignment" ? content?.assignment :
          content?.flashcards
        }
        lecture={lecture}
      />
    </div>
  )
}

function ContentDisplay({
  type, content, lecture
}: {
  type: string
  content?: GeneratedContent | null
  lecture: Lecture
}) {
  if (!content) {
    return (
      <Card className="border-dashed border-2 border-black/10 bg-transparent">
        <CardContent className="flex flex-col items-center justify-center py-16">
          {type === "notes" && <FileText className="h-10 w-10 text-muted-foreground mb-4" />}
          {type === "assignment" && <BookOpen className="h-10 w-10 text-muted-foreground mb-4" />}
          {type === "flashcards" && <Layers className="h-10 w-10 text-muted-foreground mb-4" />}
          <h3 className="text-lg font-medium text-foreground mb-1">No {type} generated yet</h3>
          <p className="text-sm text-muted-foreground">
            {lecture.transcription_status === "completed"
              ? `Click "Generate Content" to create ${type}`
              : "Transcribe the lecture first, then generate content"}
          </p>
        </CardContent>
      </Card>
    )
  }

  if (type === "notes") return <NotesDisplay content={content} />
  if (type === "assignment") return <AssignmentDisplay content={content} />
  if (type === "flashcards") return <FlashcardsDisplay content={content} />
  return null
}

function NotesDisplay({ content }: { content: GeneratedContent }) {
  const data = content.content
  return (
    <Card className="border-black/5 bg-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-blue-600" />
          {data.title || "Lecture Notes"}
        </CardTitle>
        {data.summary && <p className="text-sm text-muted-foreground">{data.summary}</p>}
      </CardHeader>
      <CardContent className="space-y-6">
        {data.sections?.map((section: any, i: number) => (
          <div key={i}>
            <h3 className="text-lg font-semibold text-foreground mb-2">{section.heading}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{section.content}</p>
            {section.key_points?.length > 0 && (
              <ul className="mt-3 space-y-1">
                {section.key_points.map((point: string, j: number) => (
                  <li key={j} className="text-sm text-muted-foreground flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    {point}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
        {data.key_takeaways?.length > 0 && (
          <div className="border-t border-black/5 pt-4">
            <h3 className="text-lg font-semibold text-foreground mb-3">Key Takeaways</h3>
            <ul className="space-y-2">
              {data.key_takeaways.map((t: string, i: number) => (
                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="bg-blue-100 text-blue-700 rounded-full w-5 h-5 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">{i + 1}</span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        )}
        {/* Fallback for raw text content */}
        {!data.sections && typeof data === "object" && (
          <pre className="text-sm text-muted-foreground whitespace-pre-wrap">{JSON.stringify(data, null, 2)}</pre>
        )}
      </CardContent>
    </Card>
  )
}

function AssignmentDisplay({ content }: { content: GeneratedContent }) {
  const data = content.content
  return (
    <Card className="border-black/5 bg-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-purple-600" />
          {data.title || "Assignment"}
        </CardTitle>
        {data.description && <p className="text-sm text-muted-foreground">{data.description}</p>}
        {data.total_points && <p className="text-xs text-muted-foreground">Total Points: {data.total_points}</p>}
      </CardHeader>
      <CardContent className="space-y-6">
        {data.questions?.map((q: any, i: number) => (
          <div key={i} className="p-4 bg-black/2 rounded-lg">
            <p className="font-medium text-foreground mb-2">Q{i + 1}. {q.question}</p>
            {q.type === "mcq" && q.options && (
              <div className="space-y-1 ml-4">
                {q.options.map((opt: string, j: number) => (
                  <p key={j} className="text-sm text-muted-foreground">
                    {String.fromCharCode(65 + j)}. {opt}
                  </p>
                ))}
                <p className="text-sm text-green-600 mt-2 font-medium">Answer: {q.correct_answer}</p>
                {q.explanation && <p className="text-xs text-muted-foreground italic">{q.explanation}</p>}
              </div>
            )}
            {q.type === "short_answer" && (
              <div className="ml-4 mt-2">
                <p className="text-sm text-green-600 font-medium">Expected: {q.expected_answer}</p>
                {q.keywords?.length > 0 && (
                  <p className="text-xs text-muted-foreground">Keywords: {q.keywords.join(", ")}</p>
                )}
              </div>
            )}
            {q.type === "long_answer" && (
              <div className="ml-4 mt-2">
                {q.rubric && <p className="text-sm text-muted-foreground">{q.rubric}</p>}
                {q.points && <p className="text-xs text-muted-foreground">Points: {q.points}</p>}
              </div>
            )}
          </div>
        ))}
        {!data.questions && (
          <pre className="text-sm text-muted-foreground whitespace-pre-wrap">{JSON.stringify(data, null, 2)}</pre>
        )}
      </CardContent>
    </Card>
  )
}

function FlashcardsDisplay({ content }: { content: GeneratedContent }) {
  const data = content.content
  const [flipped, setFlipped] = useState<Record<number, boolean>>({})

  return (
    <Card className="border-black/5 bg-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-green-600" />
          {data.title || "Flashcards"}
        </CardTitle>
        {data.description && <p className="text-sm text-muted-foreground">{data.description}</p>}
        {data.cards && <p className="text-xs text-muted-foreground">{data.cards.length} cards</p>}
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.cards?.map((card: any, i: number) => (
            <motion.div
              key={i}
              onClick={() => setFlipped(prev => ({ ...prev, [i]: !prev[i] }))}
              className="cursor-pointer"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className={`p-6 rounded-lg border transition-all min-h-[120px] flex items-center justify-center text-center ${
                flipped[i] ? "bg-green-50 border-green-200" : "bg-black/2 border-black/10"
              }`}>
                <div>
                  <p className={`text-sm font-medium ${flipped[i] ? "text-green-700" : "text-foreground"}`}>
                    {flipped[i] ? card.back : card.front}
                  </p>
                  <p className="text-xs text-muted-foreground mt-3">
                    {flipped[i] ? "Click to see question" : "Click to reveal answer"}
                  </p>
                  {card.difficulty && (
                    <span className={`mt-2 inline-block text-xs px-2 py-0.5 rounded-full ${
                      card.difficulty === "easy" ? "bg-green-100 text-green-700" :
                      card.difficulty === "medium" ? "bg-yellow-100 text-yellow-700" :
                      "bg-red-100 text-red-700"
                    }`}>
                      {card.difficulty}
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
        {!data.cards && (
          <pre className="text-sm text-muted-foreground whitespace-pre-wrap">{JSON.stringify(data, null, 2)}</pre>
        )}
      </CardContent>
    </Card>
  )
}
