import { Button } from "../../components/ui/Button"
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/Card"
import { FileText, AlertCircle, ChevronRight } from "lucide-react"
import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { coursesApi, lecturesApi, contentApi } from "../../lib/api"
import type { Lecture, GeneratedContent } from "../../types"

interface LectureWithNotes {
    lecture: Lecture
    notes: GeneratedContent | null
    courseName: string
}

export default function GenerateNotes() {
    const [items, setItems] = useState<LectureWithNotes[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState("")

    useEffect(() => {
        loadNotes()
    }, [])

    const loadNotes = async () => {
        try {
            setLoading(true)
            const { courses } = await coursesApi.list()
            const allItems: LectureWithNotes[] = []

            for (const course of courses) {
                try {
                    const { lectures } = await lecturesApi.list(course.id)
                    for (const lec of lectures) {
                        try {
                            const notes = await contentApi.getNotes(lec.id)
                            allItems.push({ lecture: lec, notes, courseName: course.name })
                        } catch {
                            allItems.push({ lecture: lec, notes: null, courseName: course.name })
                        }
                    }
                } catch { /* skip */ }
            }
            setItems(allItems)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" />
            </div>
        )
    }

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-foreground">Lecture Notes</h1>
                <p className="text-muted-foreground">Browse generated notes from all your lectures.</p>
            </div>

            {error && (
                <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 flex items-center gap-2 text-destructive text-sm">
                    <AlertCircle className="h-4 w-4" /> {error}
                </div>
            )}

            {items.length === 0 ? (
                <Card className="border-dashed border-2 border-black/10 bg-transparent">
                    <CardContent className="flex flex-col items-center justify-center py-16">
                        <FileText className="h-10 w-10 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-medium text-foreground mb-1">No lectures yet</h3>
                        <p className="text-sm text-muted-foreground mb-4">Create a course and add lectures to generate notes.</p>
                        <Link to="/dashboard/courses">
                            <Button className="bg-black text-white hover:bg-black/90">Go to Courses</Button>
                        </Link>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {items.map((item, i) => (
                        <motion.div key={item.lecture.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                            <Link to={`/dashboard/lectures/${item.lecture.id}`}>
                                <Card className="hover:shadow-lg transition-all cursor-pointer border-black/5 h-full">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-lg">{item.lecture.title}</CardTitle>
                                        <p className="text-xs text-muted-foreground">{item.courseName}</p>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-sm text-muted-foreground mb-3">
                                            {new Date(item.lecture.created_at).toLocaleDateString()}
                                        </p>
                                        {item.notes ? (
                                            <div className="flex items-center gap-2 text-sm font-medium text-blue-600">
                                                <FileText className="h-4 w-4" />
                                                View Notes
                                                <ChevronRight className="h-4 w-4 ml-auto" />
                                            </div>
                                        ) : (
                                            <p className="text-xs text-muted-foreground italic">
                                                {item.lecture.generation_status === "generating" ? "Generating..." :
                                                 item.lecture.transcription_status === "completed" ? "Ready to generate" :
                                                 "Needs transcription"}
                                            </p>
                                        )}
                                    </CardContent>
                                </Card>
                            </Link>
                        </motion.div>
                    ))}
                </div>
            )}
        </div>
    )
}
