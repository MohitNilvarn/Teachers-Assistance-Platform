# TAP — Teacher Assistance Platform
## Complete Project Workflow

---

## 1. What is TAP?

TAP is an AI-powered web application that **automates study material creation from lectures**. A teacher records or uploads a lecture, and the platform automatically generates:

- **Detailed Notes** — structured sections with formulas, derivations, and examples
- **Assignments** — 16–24 subjective questions (short answer, numerical, derivation, analytical)
- **Flashcards** — 25–35 categorized cards (definitions, theorems, formulas, comparisons)

Students enroll by academic year and get instant access to all generated content.

---

## 2. Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 18 + TypeScript + Tailwind CSS + Vite | Web interface for teachers and students |
| **Backend** | Python + FastAPI | REST API, WebSocket, business logic |
| **AI Pipeline** | LangGraph + LangChain | Orchestrates the multi-step content generation |
| **LLM** | Groq API (LLaMA 3.3 70B) | Generates notes, assignments, flashcards |
| **Speech-to-Text (Batch)** | faster-whisper (local) | Transcribes uploaded audio files |
| **Speech-to-Text (Live)** | Deepgram (cloud) | Real-time transcription during live recording |
| **Embeddings** | HuggingFace sentence-transformers/all-MiniLM-L6-v2 (local) | Converts text into 384-dimensional vectors |
| **Database** | MongoDB Atlas | Stores all data + vector embeddings |
| **Vector Search** | MongoDB Atlas Vector Search | Finds relevant chunks for AI context |
| **Authentication** | Supabase | User signup, login, JWT token management |
| **Fact-Checking** | Wikipedia API | Verifies factual accuracy of generated content |
| **Caching** | Redis (optional) | Session/data caching |
| **Math Rendering** | KaTeX | Renders LaTeX formulas in the frontend |

---

## 3. Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│  ┌────────────────┐       ┌──────────────┐       ┌───────────┐  │
│  │   FRONTEND     │◄─────►│  BACKEND API │◄─────►│  DATABASE │  │
│  │   React + TS   │ REST  │  FastAPI     │       │  MongoDB  │  │
│  │   Tailwind     │ + WS  │  Python      │       │  Atlas    │  │
│  └────────────────┘       └──────┬───────┘       └───────────┘  │
│                                  │                               │
│                           ┌──────▼───────┐                       │
│                           │  AI ENGINE   │                       │
│                           │  LangGraph   │                       │
│                           │  Groq LLM    │                       │
│                           │  Whisper     │                       │
│                           │  Deepgram    │                       │
│                           └──────────────┘                       │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 4. Database Structure

TAP uses **MongoDB Atlas** as a single database for all data. There are 5 collections:

### 4.1 `courses` Collection
Stores course information. Each course belongs to one teacher and has 6 units.

| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | Unique course identifier |
| `teacher_id` | String | Supabase user ID of the teacher who owns this course |
| `name` | String | Course name (e.g., "Machine Learning") |
| `code` | String | Subject code (e.g., "BE401") |
| `year` | String | Academic year — FE, SE, TE, or BE |
| `subject_code` | String | Links to the subject catalog |
| `units` | Array | List of 6 units, each with `number` (1–6) and `title` |
| `enrolled_students` | Array | List of student user IDs enrolled in this course |
| `created_at` | DateTime | When the course was created |

### 4.2 `lectures` Collection
Stores lecture metadata, audio file path, and transcript. Each lecture belongs to one unit of one course.

| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | Unique lecture identifier |
| `course_id` | String | Which course this lecture belongs to |
| `teacher_id` | String | Who created this lecture |
| `unit_number` | Integer | Which unit (1–6) this lecture is in |
| `title` | String | Lecture title |
| `audio_path` | String | Path to the uploaded audio file on disk |
| `transcript` | String | Full transcript text (after transcription) |
| `transcript_segments` | Array | Timestamped segments `[{start, end, text}]` |
| `transcription_status` | Enum | `pending` → `transcribing` → `completed` / `failed` |
| `generation_status` | Enum | `not_started` → `generating` → `completed` / `failed` |
| `embedding_ids` | Array | IDs of vector embeddings created from this transcript |
| `embedding_count` | Integer | How many chunks were embedded |
| `is_live_recorded` | Boolean | Whether this was from a live recording session |

### 4.3 `materials` Collection
Stores teacher-uploaded study materials (PDFs, DOCX, PPTX, etc.).

| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | Unique material identifier |
| `course_id` | String | Which course this material belongs to |
| `teacher_id` | String | Who uploaded this material |
| `lecture_id` | String (optional) | If set, scopes this material to a specific lecture |
| `filename` | String | Original filename |
| `file_type` | Enum | `pdf`, `docx`, `pptx`, `txt`, `md` |
| `content` | String | Extracted full text from the document |
| `chunks` | Array | Text split into smaller pieces for embedding |
| `embedding_ids` | Array | IDs of vector embeddings for each chunk |
| `processing_status` | Enum | `pending` → `processing` → `completed` / `failed` |

### 4.4 `generated_content` Collection
Stores the AI-generated notes, assignments, and flashcards as structured JSON.

| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | Unique content identifier |
| `lecture_id` | String | Which lecture this content was generated for |
| `course_id` | String | Which course this belongs to |
| `content_type` | Enum | `notes`, `assignment`, or `flashcards` |
| `content` | Dict (JSON) | The actual generated content — structured with sections, questions, or cards |
| `version` | Integer | Incremented when a teacher edits the content |
| `is_edited` | Boolean | Whether the teacher has manually modified this content |
| `metadata` | Dict | Generation info (how many context docs used, timestamp) |

### 4.5 `vector_embeddings` Collection
Stores 384-dimensional embedding vectors for semantic search. Used by the AI pipeline to find relevant context.

| Field | Type | Description |
|-------|------|-------------|
| `_id` | String | Unique embedding ID (e.g., `{lecture_id}_transcript_0`) |
| `course_id` | String | Which course this belongs to |
| `lecture_id` | String | Which lecture this belongs to |
| `source` | String | `lecture_transcript` or `teacher_material` |
| `text` | String | The original text chunk |
| `embedding` | Array[384] | 384-dimensional float vector |
| `metadata` | Dict | Extra info (title, chunk index, etc.) |

**Atlas Vector Search Index** named `vector_index` is created on the `embedding` field with filters on `lecture_id`, `course_id`, and `source`.

### Authentication (Supabase — separate)
User accounts are managed in **Supabase**, not MongoDB. Each user has:
- `id` — UUID
- `email` — Login email
- `role` — `teacher` or `student`
- `first_name`, `last_name`
- `year` — Academic year (for students: FE/SE/TE/BE)
- `subject_code` — (for teachers: which subject they teach)

---

## 5. Authentication Flow

### 5.1 Signup

```
User fills signup form (email, password, name, role, year/subject)
        │
        ▼
Frontend sends POST /api/v1/auth/signup
        │
        ▼
Backend calls Supabase auth.sign_up() with user metadata
        │
        ▼
Supabase creates user account, returns user ID
        │
        ▼
User receives confirmation → redirected to login
```

**Key detail:** The `role` (teacher/student) and `year`/`subject_code` are stored as Supabase user metadata, which gets embedded in the JWT token.

### 5.2 Login

```
User enters email + password + selects portal (Teacher/Student)
        │
        ▼
Frontend sends POST /api/v1/auth/login { email, password, role }
        │
        ▼
Backend authenticates with Supabase auth.sign_in_with_password()
        │
        ▼
Backend checks: does the user's actual role match the portal they're trying to access?
        │
  ┌─────┴──────┐
  │ YES        │ NO
  ▼            ▼
Return JWT   Return 403 "Access Denied.
tokens +     You are a {actual_role},
user data    not a {requested_role}."
  │
  ▼
Frontend stores access_token + refresh_token in sessionStorage
```

**Security feature:** A student can't log into the teacher portal and vice versa. The backend checks the user's stored role against what portal they selected.

### 5.3 Authenticated API Calls

```
Every API request includes:  Authorization: Bearer {access_token}
        │
        ▼
Backend decodes the JWT → extracts user_id, role, metadata
        │
        ▼
Role-based guards check access:
  - require_teacher() → only teachers can upload, transcribe, generate
  - require_student() → student-specific endpoints
  - get_current_user() → any authenticated user
        │
        ▼
If token expired → Frontend auto-refreshes via POST /auth/refresh
                   → retries the original request transparently
```

---

## 6. Complete Workflow — Step by Step

### FLOW A: Teacher Onboarding (First-Time Setup)

This happens once, right after a teacher signs up.

```
Step 1: Teacher logs in for the first time
        │
        ▼
Step 2: Frontend loads the Teacher Dashboard
        │
        ▼
Step 3: GET /api/v1/teachers/dashboard
        │
        ▼
Step 4: Backend detects: teacher has a subject_code but no course yet
        │
        ▼
Step 5: Backend auto-creates a Course from the subject catalog
        │   - Looks up subject by code (e.g., "BE401" → "Machine Learning")
        │   - Creates 6 units with predefined titles from the catalog
        │   - Links course to this teacher
        │
        ▼
Step 6: Teacher sees their dashboard with 1 course and 6 empty units
```

**Subject Catalog:** TAP has a hardcoded catalog of subjects for 4 academic years (FE, SE, TE, BE), 2 semesters each, ~5 subjects per semester. Each subject comes with 6 predefined unit titles.

---

### FLOW B: Teacher Uploads & Processes a Lecture (Batch Mode)

This is the main workflow — teacher uploads a pre-recorded audio, transcribes it, optionally adds materials, then generates content.

#### Step B1: Upload Audio

```
Teacher navigates to: Dashboard → Subject → Unit (e.g., Unit 3)
        │
        ▼
Teacher clicks "Add Lecture" → fills in title + selects audio file
(Supported formats: mp3, wav, m4a, ogg, flac, webm)
        │
        ▼
Frontend sends: POST /api/v1/{course_id}/lectures
  - Form data: title, unit_number, audio_file (binary)
        │
        ▼
Backend:
  1. Validates course ownership (teacher must own this course)
  2. Validates unit_number is valid (1–6)
  3. Validates audio file extension
  4. Saves audio file to disk: ./uploads/{uuid}.{ext}
  5. Calculates audio duration using pydub
  6. Creates Lecture document in MongoDB
     - transcription_status = "pending"
     - generation_status = "not_started"
        │
        ▼
Lecture appears in the unit with status: "Pending Transcription"
```

#### Step B2: Transcribe Audio

```
Teacher clicks "Transcribe" button on the lecture
        │
        ▼
Frontend sends: POST /api/v1/lectures/{lecture_id}/transcribe
        │
        ▼
Backend:
  1. Checks: teacher owns this lecture
  2. Checks: audio file exists
  3. Updates status → "transcribing"
  4. Loads faster-whisper model (lazy — first call loads "base" model)
     - Model: Whisper "base" (int8 quantized for CPU)
     - VAD filter enabled (skips silence)
     - Beam size = 5
  5. Transcribes audio → returns full transcript + timestamped segments
        │
        ▼
  6. Chunks the transcript into smaller pieces:
     - Chunk size: ~1000 characters
     - Overlap: 200 characters
     - Break points: sentence boundaries, paragraph boundaries
        │
        ▼
  7. Generates embeddings for each chunk:
     - Model: all-MiniLM-L6-v2 (local, 384 dimensions)
     - Each chunk → 384-dimensional float vector
        │
        ▼
  8. Stores chunks + embeddings in vector_embeddings collection:
     - IDs: {lecture_id}_transcript_0, {lecture_id}_transcript_1, ...
     - source: "lecture_transcript"
     - Each document has: text, embedding[384], lecture_id, course_id
        │
        ▼
  9. Updates Lecture document:
     - transcript = full text
     - transcript_segments = timestamped segments
     - transcription_status = "completed"
     - embedding_ids = list of chunk IDs
     - embedding_count = number of chunks
        │
        ▼
Lecture status changes to: "Transcribed" ✅
```

#### Step B3: Upload Study Materials (Optional)

Teachers can upload reference materials (PDFs, DOCX, PPTX) that the AI will use as primary context.

```
Teacher clicks "Upload Material" on a specific lecture
        │
        ▼
Frontend sends: POST /api/v1/lectures/{lecture_id}/materials
  - Multipart file upload (PDF, DOCX, PPTX, TXT, MD)
        │
        ▼
Backend:
  1. Validates file type and ownership
  2. Saves file to disk: ./uploads/{uuid}.{ext}
  3. Extracts text using the appropriate processor:
     - PDF → pypdf (reads all pages)
     - DOCX → python-docx (paragraphs + tables)
     - PPTX → python-pptx (slides + notes)
     - TXT/MD → markdown parser + BeautifulSoup
  4. Chunks extracted text:
     - Same as transcript: ~1000 chars, 200 overlap
     - Smart splitting at sentence/paragraph boundaries
  5. Generates 384-dim embeddings for each chunk
  6. Stores in vector_embeddings:
     - source: "teacher_material"
     - lecture_id: this specific lecture
     - This is KEY: material is scoped to the lecture
  7. Creates Material document in MongoDB
  8. Updates processing_status → "completed"
        │
        ▼
Material appears under the lecture, ready for AI to use
```

**Why lecture-scoped?** When the AI generates content for Lecture 5, it should only see materials uploaded FOR Lecture 5 — not materials from Lecture 1 or 2. This prevents the LLM from mixing up content from different topics.

#### Step B4: Generate Content (The Core AI Pipeline)

```
Teacher clicks "Generate" button on a transcribed lecture
        │
        ▼
Frontend sends: POST /api/v1/lectures/{lecture_id}/generate
  { content_types: ["notes", "assignment", "flashcards"] }
        │
        ▼
Backend:
  1. Validates: lecture exists, teacher owns it
  2. Validates: transcript is available (status = completed)
  3. Updates generation_status → "generating"
  4. Calls run_content_generation() — the LangGraph pipeline
```

**This triggers the 6-step LangGraph pipeline (detailed in Section 7).**

```
        │
        ▼
Pipeline completes → saves Notes + Assignment + Flashcards to MongoDB
        │
        ▼
  5. Updates Lecture: generation_status → "completed"
        │
        ▼
Response: { status: "completed", generated_types: ["notes", "assignment", "flashcards"] }
        │
        ▼
Lecture status changes to: "Content Generated" ✅
```

---

### FLOW C: Live Lecture Recording (Real-Time Mode)

Teachers can also record a lecture live from their browser microphone. Transcription happens in real-time using Deepgram's streaming API, and content generation triggers automatically when they stop.

```
Step C1: Teacher opens a unit page → clicks "Record Live"
        │
        ▼
Step C2: Frontend opens WebSocket connection:
  ws://host/api/v1/realtime/transcribe/{course_id}/{unit_number}?token=JWT
        │
        ▼
Step C3: Backend authenticates the JWT token via query parameter
  - Verifies it's a valid teacher
  - Verifies the course exists
  - Accepts the WebSocket connection
        │
        ▼
Step C4: Backend creates a Deepgram WebSocket session:
  - Connects to: wss://api.deepgram.com/v1/listen
  - Model: Nova-2
  - Audio format: linear16, 16kHz, mono
  - Features: punctuation, interim results, smart formatting
        │
        ▼
Step C5: Frontend captures microphone audio:
  - MediaRecorder API → captures PCM 16-bit 16kHz mono audio
  - Base64-encodes each audio chunk
  - Sends: { type: "audio", data: "<base64>" }
        │
        ▼
Step C6: Backend forwards audio to Deepgram → receives transcript:
  - Deepgram sends back interim (partial) and final transcript pieces
  - Backend forwards to client: { type: "transcript", text: "...", is_final: true/false }
  - Frontend displays live transcript in real-time
        │
        ▼
Step C7: Teacher clicks "Stop Recording" → enters a title
  - Frontend sends: { type: "stop", title: "Lecture on Neural Networks" }
        │
        ▼
Step C8: Backend processes the final transcript:
  1. Combines all final transcript pieces into full text
  2. Validates: transcript must be at least 50 characters
  3. Creates Lecture document in MongoDB:
     - is_live_recorded = true
     - transcription_status = "completed" (already transcribed)
     - generation_status = "generating"
  4. Sends to client: { type: "processing", message: "Generating content..." }
        │
        ▼
Step C9: Runs the full LangGraph AI pipeline (same as Flow B, Step B4)
  - Retrieves any teacher-uploaded materials for this lecture
  - Wikipedia fact-check
  - Generates notes, assignment, flashcards
  - Saves to MongoDB
        │
        ▼
Step C10: Sends completion message:
  { type: "complete", lecture_id: "...", generated: { notes: true, assignment: true, flashcards: true } }
        │
        ▼
Teacher sees the lecture in the unit page with all content ready
```

---

### FLOW D: Student Enrollment & Content Access

```
Step D1: Student signs up with:
  - Role: "student"
  - Academic year: e.g., "BE" (final year)
        │
        ▼
Step D2: Student logs in → first dashboard load
        │
        ▼
Step D3: Frontend calls POST /api/v1/courses/enroll-by-year
  - Backend finds all courses matching the student's academic year
  - Auto-enrolls the student in all matching courses
  - Student is added to each course's enrolled_students array
        │
        ▼
Step D4: Student Dashboard shows:
  - All enrolled subjects (courses)
  - Quick access cards: Recent Notes, Assignments, Flashcards
        │
        ▼
Step D5: Student navigates: Subject → Unit → Lecture
        │
        ▼
Step D6: Lecture Content Page loads:
  GET /api/v1/content/lectures/{lecture_id}/content
  - Returns all generated content (notes, assignment, flashcards)
        │
        ▼
Step D7: Frontend renders content in a 3-tab view:
  ┌─────────┬──────────────┬──────────────┐
  │  Notes  │  Assignment  │  Flashcards  │
  └─────────┴──────────────┴──────────────┘
  - Notes: Sections with headings, paragraphs, formulas, derivations
  - Assignment: Questions grouped by type (short, numerical, derivation, etc.)
  - Flashcards: Front/back cards by category
  - All LaTeX math is rendered using KaTeX (e.g., E = mc^2)
```

---

## 7. The AI Content Generation Pipeline — Deep Dive

This is the heart of TAP. It's built using **LangGraph**, which is a framework for building stateful, multi-step AI workflows as directed graphs.

### Pipeline Architecture

```
┌──────────────────┐      ┌───────────────────┐      ┌────────────────┐
│ 1. RETRIEVE      │      │ 2. WIKIPEDIA      │      │ 3. GENERATE    │
│    CONTEXT       │─────►│    FACT-CHECK      │─────►│    NOTES       │
│                  │      │                   │      │                │
│ Vector search    │      │ Search Wikipedia  │      │ Groq LLM call  │
│ for materials +  │      │ for lecture title  │      │ with context   │
│ transcript       │      │ + key topics       │      │                │
└──────────────────┘      └───────────────────┘      └───────┬────────┘
                                                             │
                                                             ▼
┌──────────────────┐      ┌───────────────────┐      ┌────────────────┐
│ 6. SAVE          │      │ 5. GENERATE       │      │ 4. GENERATE    │
│    CONTENT       │◄─────│    FLASHCARDS     │◄─────│    ASSIGNMENT  │
│                  │      │                   │      │                │
│ Insert into      │      │ Groq LLM call     │      │ Groq LLM call  │
│ MongoDB          │      │ with context       │      │ with context   │
└──────────────────┘      └───────────────────┘      └────────────────┘
```

### Step-by-Step Pipeline Execution

#### Step 1: Retrieve Context (Vector Search)

The pipeline starts by finding the most relevant text chunks for the current lecture.

```
Input: lecture_id, transcript (first 500 chars as query)
        │
        ▼
Search 1: Teacher-uploaded materials (lecture-scoped)
  - Collection: vector_embeddings
  - Filter: lecture_id = this lecture, source = "teacher_material"
  - Method: MongoDB Atlas $vectorSearch (cosine similarity)
  - Returns: top 8 most relevant material chunks
        │
        ▼
Search 2: Transcript chunks (lecture-scoped)
  - Filter: lecture_id = this lecture, source = "lecture_transcript"
  - Returns: top 5 most relevant transcript chunks
        │
        ▼
Combined context is built:
  === TEACHER-PROVIDED MATERIALS ===
  [chunk 1 text]
  ---
  [chunk 2 text]
  ---
  ... (up to 8 chunks)

  === LECTURE TRANSCRIPT EXCERPTS ===
  [chunk 1 text]
  ---
  ... (up to 5 chunks)
```

**How Vector Search works:**
1. The query text (first 500 chars of transcript) is converted to a 384-dim embedding
2. MongoDB Atlas Vector Search finds the stored embeddings that are most similar (cosine similarity)
3. Only embeddings belonging to THIS lecture are considered (lecture-scoped filtering)
4. The original text chunks of the top matches are returned

**Fallback:** If Atlas Vector Search isn't available (local dev), a brute-force cosine similarity calculation is used instead.

#### Step 2: Wikipedia Fact-Check

A non-critical step that fetches reference material from Wikipedia to help the LLM verify facts.

```
Input: lecture_title + key phrases from transcript
        │
        ▼
Search Wikipedia for the lecture title (2 results max)
Search Wikipedia for key transcript phrases (1 result each, up to 5)
        │
        ▼
For each matching Wikipedia article:
  - Fetch the article's introduction/extract (truncated to 2000 chars)
        │
        ▼
Build fact-check context:
  === WIKIPEDIA FACT-CHECK CONTEXT ===
  (Use this ONLY to verify facts and improve accuracy.
   Teacher materials remain the primary source.)

  --- Cloud Computing ---
  Cloud computing is the on-demand availability of computer system
  resources, especially data storage and computing power...
```

**Important:** If Wikipedia fails (403, timeout, no results), the pipeline continues without it. It is never the primary source — only a fact-checking supplement.

#### Step 3: Generate Notes

```
Input: transcript + combined context (materials + transcript chunks + Wikipedia)
        │
        ▼
Build the prompt:
  System Prompt (SYSTEM_PROMPT):
    - Engineering/STEM professor persona
    - 16 strict rules including:
      • Only use information from teacher materials + transcript
      • Never invent theorems or formulas
      • Use LaTeX for all math (\\frac, \\lambda, etc.)
      • Use SI units
      • Include step-by-step derivations
      • Grade-appropriate complexity
        │
        ▼
  Notes Prompt (NOTES_PROMPT):
    - Generate 5–8 sections, each with:
      • Title
      • 5–8 paragraphs of detailed content
    - Include: formulas, derivations, numerical examples, vocabulary, practice questions
    - Output: strict JSON format
        │
        ▼
Call Groq API (LLaMA 3.3 70B):
  - Temperature: 0.5 (for consistent JSON)
  - Max tokens: 8192
  - System prompt enforces JSON-only output + double backslashes for LaTeX
        │
        ▼
Parse response:
  1. Strip markdown code blocks (```json ... ```)
  2. Try JSON.parse
  3. If fails → fix LaTeX backslashes (\\frac → \\\\frac)
  4. If still fails → fix trailing commas
  5. Return parsed JSON object
        │
        ▼
Retry logic: up to 4 attempts with exponential backoff (4s → 8s → 16s → 30s)
```

#### Step 4: Generate Assignment

Same process as notes, but with the **Assignment Prompt**:
- Generates 16–24 **subjective-only questions** (no MCQs)
- Question types: short answer, numerical, derivation, explain, analytical, long answer, application, bonus
- Total: 200 points
- Each question has: text, type, marks, expected answer length
- Uses the same combined context + Wikipedia

#### Step 5: Generate Flashcards

Same process, with the **Flashcards Prompt**:
- Generates 25–35 flashcards
- Categories: definitions, theorems/laws, formulas, numerical examples, derivation steps, comparisons
- Each card has: front (question/term), back (answer/explanation), category
- Uses the same combined context + Wikipedia

#### Step 6: Save Content

```
For each successfully generated content type (notes, assignment, flashcards):
        │
        ▼
Create GeneratedContent document:
  - lecture_id
  - course_id
  - content_type: "notes" / "assignment" / "flashcards"
  - content: the full JSON object
  - version: 1
  - metadata: { context_docs_used: N, generated_at: timestamp }
        │
        ▼
Insert into generated_content collection
        │
        ▼
Update Lecture document:
  - generation_status → "completed"
  - generated_at → current timestamp
```

---

## 8. How the LLM Works (Groq + LaTeX Handling)

### LLM Configuration
- **Provider:** Groq (cloud API, extremely fast inference)
- **Model:** LLaMA 3.3 70B Versatile
- **Temperature:** 0.5 for JSON generation (lower = more deterministic)
- **Max tokens:** 8192 per response

### JSON + LaTeX Problem
LLMs commonly output LaTeX inside JSON strings. But LaTeX uses single backslashes (`\frac`, `\text`, `\lambda`) which are invalid in JSON:
- `\f` is interpreted as formfeed
- `\t` is interpreted as tab
- `\n` is interpreted as newline
- `\b` is interpreted as backspace

### TAP's Solution
The `_fix_latex_in_json()` function automatically doubles backslashes that aren't valid JSON escapes:
```
\frac  → \\frac   (preserved as LaTeX)
\text  → \\text   (preserved as LaTeX)
\"     → \"       (left alone — valid JSON escape)
\\     → \\       (left alone — already doubled)
\n     → \n       (left alone — valid JSON escape, but...)
\nu    → \\nu     (fixed — this is LaTeX \nu, not newline)
```

The parsing pipeline:
1. Try `JSON.parse` directly (fast path)
2. If fails → apply LaTeX backslash fix → retry
3. If still fails → also strip trailing commas before `}` or `]` → retry
4. If still fails → error (retry the entire LLM call)

---

## 9. How Text Chunking & Embeddings Work

### Why Chunk?
LLMs have limited context windows. Instead of sending a 50-page PDF to the LLM, we:
1. Split it into small chunks (~1000 characters each)
2. Convert each chunk to a vector (embedding)
3. When generating content, find only the most relevant chunks via vector search
4. Send only those top chunks to the LLM

### Chunking Strategy
```
Full text (e.g., 10,000 characters)
        │
        ▼
Split into chunks of ~1000 characters with 200-character overlap:
  Chunk 0: chars 0–1000
  Chunk 1: chars 800–1800    (200 overlap with chunk 0)
  Chunk 2: chars 1600–2600   (200 overlap with chunk 1)
  ...

Smart boundary detection:
  - Prefer breaking at paragraph boundaries (\n\n)
  - Then at sentence boundaries (. ! ?)
  - Last resort: break at any space
```

### Embedding Generation
```
Each chunk → sentence-transformers/all-MiniLM-L6-v2 → 384-dim float vector
```

This model runs **locally** (no API call, no cost). It converts any text into a 384-dimensional vector where semantically similar texts have similar vectors.

Example:
- "Newton's second law: F = ma" → [0.12, -0.34, 0.56, ...]
- "Force equals mass times acceleration" → [0.11, -0.33, 0.55, ...] (very similar!)
- "The weather is sunny today" → [0.89, 0.22, -0.44, ...] (very different)

### Vector Search
When generating content, the pipeline queries:
```
"Find the 8 most similar teacher material chunks for this lecture"

1. Encode the query → 384-dim vector
2. MongoDB Atlas $vectorSearch:
   - Searches by cosine similarity
   - Filter: lecture_id = this lecture, source = "teacher_material"
   - Returns top 8 matches
3. Return the original text of those 8 chunks
```

---

## 10. Real-Time Transcription — How Deepgram Streaming Works

```
Browser Microphone
        │
        ├─ MediaRecorder API captures audio
        │  (PCM, 16-bit, 16kHz, mono)
        │
        ▼
Frontend WebSocket ──── base64(audio) ────► Backend WebSocket
                                                  │
                                       raw bytes  │
                                                  ▼
                                     Deepgram WebSocket
                                     (Nova-2 model)
                                                  │
                                     JSON         │
                                     transcripts  │
                                                  ▼
Frontend WebSocket ◄─── { text, is_final } ─── Backend WebSocket
        │
        ▼
Display live transcript on screen
```

- **Interim results:** Partial transcript that updates as the speaker continues (displayed in gray)
- **Final results:** Confirmed transcript segments (displayed in white/black)
- **Ping/pong:** Keep-alive messages every 20 seconds to prevent timeout

---

## 11. Frontend Routes & Pages

```
/                           → Landing page (hero, features, CTA)
/login                      → Login page (email + password + role selector)
/signup                     → Signup page (email, password, name, role, year/subject)
/dashboard                  → Protected route → DashboardLayout
  /                          → DashboardHome
                               - Teachers: course overview, unit cards, stats
                               - Students: enrolled subjects, quick access cards
  /notes                     → Recent notes (last 6 across all courses)
  /assignments               → Recent assignments
  /flashcards                → Recent flashcards
  /subject/:courseId         → SubjectDetailPage (6 units listed)
  /course/:id/unit/:num     → UnitDetailPage
                               - List of lectures with status badges
                               - Upload lecture form (title + audio)
                               - Transcribe & Generate buttons
                               - Live recording mode
                               - Upload materials per lecture
  /course/:id/unit/:num/
    lecture/:lectureId       → LectureContentPage
                               - 3-tab view: Notes | Assignment | Flashcards
                               - KaTeX rendering for math
                               - Structured JSON rendered as rich HTML
```

---

## 12. API Endpoints Reference

### Auth (`/api/v1/auth`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/signup` | Create new user account |
| POST | `/login` | Authenticate and get JWT tokens |
| POST | `/refresh` | Refresh expired access token |
| POST | `/logout` | Revoke session |

### Courses (`/api/v1/courses`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/` | Create a new course (teacher) |
| GET | `/` | List courses (teacher: own, student: enrolled) |
| GET | `/by-year?year=BE` | List courses for an academic year |
| GET | `/{id}` | Get course details |
| PUT | `/{id}` | Update course (teacher) |
| DELETE | `/{id}` | Delete course (teacher) |
| POST | `/{id}/enroll` | Enroll a student manually |
| POST | `/enroll-by-year` | Auto-enroll student in year-matching courses |

### Lectures (`/api/v1/lectures`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/{course_id}/lectures` | Create lecture with audio upload |
| GET | `/{course_id}/lectures` | List lectures in a course |
| GET | `/lectures/{id}` | Get lecture details |
| POST | `/lectures/{id}/transcribe` | Transcribe audio with Whisper |
| GET | `/lectures/{id}/transcript` | Get transcript text |
| POST | `/lectures/{id}/generate` | Generate notes/assignment/flashcards |
| DELETE | `/lectures/{id}` | Delete lecture + all associated data |

### Materials (`/api/v1/materials`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/lectures/{id}/materials` | Upload material for a specific lecture |
| POST | `/{course_id}/materials` | Upload course-level material |
| GET | `/{course_id}/materials` | List materials |
| GET | `/materials/{id}` | Get material details |
| DELETE | `/materials/{id}` | Delete material + embeddings |

### Content (`/api/v1/content`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/lectures/{id}/notes` | Get generated notes |
| GET | `/lectures/{id}/assignment` | Get generated assignment |
| GET | `/lectures/{id}/flashcards` | Get generated flashcards |
| GET | `/lectures/{id}/content` | Get all generated content |
| GET | `/recent/notes` | Last 6 notes across courses |
| GET | `/recent/assignments` | Last 6 assignments |
| GET | `/recent/flashcards` | Last 6 flashcards |
| PATCH | `/content/{id}` | Edit generated content (teacher) |
| POST | `/lectures/{id}/search` | Semantic search within a lecture |
| POST | `/courses/{id}/search` | Semantic search across a course |

### Teachers (`/api/v1/teachers`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/select-subject` | Onboarding: create course from catalog |
| GET | `/dashboard` | Get teacher dashboard data |
| GET | `/courses/{id}/units/{num}` | Get unit detail with lecture statuses |

### Subjects (`/api/v1/subjects`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/?year=BE` | List subjects for an academic year |
| GET | `/{code}` | Get subject details |

### Users (`/api/v1/users`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/me` | Get current user profile |

### Realtime (`/api/v1/realtime`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| WS | `/realtime/transcribe/{course_id}/{unit}?token=JWT` | Live transcription WebSocket |
| GET | `/realtime/test` | Test page for development |

---

## 13. Key Design Decisions

### 1. Lecture-Scoped Grounding
All AI context retrieval is scoped to the **specific lecture** being processed. The LLM never sees materials from other lectures. This prevents cross-topic contamination and keeps generated content accurate.

### 2. Single Database for Everything
MongoDB Atlas serves as both the document database AND vector store. No need for separate services like Pinecone or ChromaDB. The `vector_embeddings` collection stores 384-dim vectors and supports Atlas Vector Search with cosine similarity.

### 3. Two Transcription Paths
- **Batch** (faster-whisper, local): For pre-recorded audio uploads. Runs on CPU, no API cost.
- **Real-time** (Deepgram, cloud): For live lecture recording. Requires internet, uses Deepgram's streaming WebSocket API.

### 4. Supabase for Auth Only
Supabase handles ONLY user accounts and JWT tokens. All business data (courses, lectures, content) lives in MongoDB. This separation keeps auth simple while allowing flexible data modeling.

### 5. LaTeX-First Math
All prompts enforce LaTeX notation for mathematical formulas. The LLM output contains LaTeX strings, and the frontend renders them using KaTeX. A custom JSON parser handles the backslash escaping issues between LaTeX and JSON.

### 6. Strict AI Grounding
The system prompt explicitly says: **"Do NOT add information from your own knowledge. Only use the teacher-provided materials and transcript."** Wikipedia is the only external knowledge source, and it's labeled as a fact-checking supplement only.

### 7. Auto-Enrollment
Students don't manually search and enroll in courses. When they sign up with their academic year (e.g., "BE"), they are automatically enrolled in all courses created for BE students. This mimics a real university where students are assigned to their year's courses.

### 8. Editable AI Content
Teachers can review and edit any generated content. Edits are versioned (`version` field increments) and flagged (`is_edited = true`), preserving the original while allowing corrections.

### 9. Retry with Exponential Backoff
All LLM calls use `tenacity` retry logic:
- `generate_text()`: 3 attempts, 2s → 4s → 10s backoff
- `generate_json()`: 4 attempts, 4s → 8s → 16s → 30s backoff
This handles transient API errors and rate limits gracefully.

---

## 14. Error Handling Strategy

| Component | Error Type | Handling |
|-----------|-----------|----------|
| **Auth** | Invalid credentials | 401 + clear error message |
| **Auth** | Wrong portal (student → teacher) | 403 + sign out + block |
| **Transcription** | Audio file corrupt | Status → "failed", error stored in lecture |
| **Material** | Unsupported format | 400 + allowed formats listed |
| **Vector Search** | Atlas not available | Falls back to brute-force cosine similarity |
| **Wikipedia** | API fails (403/timeout) | Pipeline continues without it (non-fatal) |
| **LLM** | Invalid API key | Retry fails → error stored, status → "failed" |
| **LLM** | Rate limit | Exponential backoff retry (up to 4 attempts) |
| **LLM** | Invalid JSON output | Fix LaTeX backslashes → fix commas → retry |
| **WebSocket** | Client disconnects | Session cleaned up, Deepgram connection closed |
| **Deepgram** | No API key | Error sent to client, WebSocket closed |

---

## 15. File & Folder Structure

```
app/
├── main.py                     # FastAPI app + lifespan (startup/shutdown)
├── core/
│   ├── config.py               # Environment variables → Settings class
│   ├── dependencies.py         # Auth middleware (JWT decode, role guards)
│   └── logger.py               # Logging setup
├── db/
│   ├── mongodb.py              # Motor + Beanie initialization
│   ├── supabase.py             # Supabase client creation
│   └── redis.py                # Optional Redis connection
├── models/                     # Beanie ODM documents (MongoDB collections)
│   ├── course.py               # Course + Unit
│   ├── lecture.py              # Lecture (audio, transcript, status)
│   ├── material.py             # Uploaded materials
│   └── content.py              # Generated content (notes/assignment/flashcards)
├── schemas/                    # Pydantic request/response models
│   ├── auth.py, course.py, lecture.py, material.py, content.py
├── services/                   # Business logic services
│   ├── audio_processor.py      # faster-whisper transcription
│   ├── document_processor.py   # PDF/DOCX/PPTX text extraction
│   ├── embedding_service.py    # Local sentence-transformer embeddings
│   ├── vector_store.py         # MongoDB Atlas Vector Search
│   └── realtime_transcription.py # Deepgram WebSocket streaming
├── ai/                         # AI pipeline
│   ├── graph.py                # LangGraph 6-node workflow
│   ├── llm.py                  # Groq LLM wrapper + JSON/LaTeX handling
│   ├── prompts.py              # System + notes + assignment + flashcard prompts
│   └── wikipedia_tool.py       # Wikipedia fact-check tool
├── api/v1/                     # Route handlers
│   ├── auth.py, courses.py, lectures.py, materials.py
│   ├── content.py, teachers.py, users.py, subjects.py, realtime.py
└── data/
    └── subjects.py             # Hardcoded subject catalog (FE/SE/TE/BE)

src/                            # React frontend
├── App.tsx                     # Routes + layout
├── main.tsx                    # React entry point
├── lib/
│   ├── api.ts                  # API client with auto JWT refresh
│   └── utils.ts                # Utility functions
├── pages/
│   ├── LandingPage.tsx
│   ├── auth/                   # LoginPage, SignupPage
│   └── dashboard/              # All dashboard pages
├── components/
│   ├── auth/                   # ProtectedRoute
│   ├── dashboard/              # DashboardLayout, Chatbot, StudentSubjects
│   ├── landing/                # Hero, Features, HowItWorks, CTA, Testimonials
│   └── ui/                     # Button, Card, Input, Navbar, Sidebar, LatexRenderer
└── types/
    └── index.ts                # TypeScript type definitions
```

---

*Last updated: March 2026*
