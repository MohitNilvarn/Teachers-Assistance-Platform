# Teacher Assistance Platform (TAP)

[![Typing SVG](https://readme-typing-svg.herokuapp.com?font=Inter&weight=600&size=24&pause=1000&color=D76D77&width=435&lines=Teacher+Assistance+Platform;Automated+Study+Material;Powered+by+AI)](https://git.io/typing-svg)

[![React](https://img.shields.io/badge/React-18-blue.svg)](https://reactjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688.svg)](https://fastapi.tiangolo.com/)
[![Python](https://img.shields.io/badge/Python-3.10+-3776AB.svg)](https://www.python.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC.svg)](https://tailwindcss.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248.svg)](https://www.mongodb.com/)

An AI-powered platform that transforms lectures and teacher materials into grounded, high-quality study content (notes, assignments, and flashcards) using a production-grade Retrieval-Augmented Generation (RAG) pipeline.

---

## 🎯 Problem Statement

Educators spend a significant amount of their time outside the classroom manually creating study materials. From drafting lecture notes to formulating assignments and creating revision flashcards, this repetitive process detracts from the time they could spend interacting with students or improving their teaching methods. Furthermore, ensuring that all generated content is accurately aligned with the specific curriculum and materials taught in class is challenging.

## 💡 The Solution: TAP

**TAP (Teacher Assistance Platform)** automates the creation of study materials. By simply recording a live lecture or uploading pre-recorded audio and reference documents, the platform automatically generates:

- 📝 **Detailed Notes**: Structured sections with formulas, derivations, and examples.
- 📋 **Assignments**: 16–24 subjective questions across varying difficulties and types.
- 🗂️ **Flashcards**: 25–35 categorized cards for quick revision.

Students can enroll in their academic year and instantly access these high-quality, AI-generated resources, while teachers can save hours of manual effort.

---

## 🚀 Key Features

### For Teachers
- **Live Lecture Recording**: Record directly from the browser with real-time transcription powered by Deepgram.
- **Batch Uploads**: Upload pre-recorded audio (MP3/WAV) and reference materials (PDF, DOCX, PPTX).
- **Automated Content Generation**: One-click generation of Notes, Assignments, and Flashcards based *strictly* on the uploaded materials and lecture transcript.
- **Content Management**: Manage courses by units, review AI-generated content, and optionally edit them.

### For Students
- **Instant Access**: Automatically enroll by academic year to get access to all relevant subjects.
- **Rich Interactive Content**: View beautifully formatted notes with LaTeX math rendering (via KaTeX), practice assignments, and study flashcards.

---

## 🏗️ Architecture & Tech Stack

TAP is built on a modern, scalable architecture featuring a React frontend, a FastAPI backend, and an advanced AI orchestrator using LangGraph.

### Tech Stack Highlights:
- **Frontend**: React 18, TypeScript, Tailwind CSS, Vite
- **Backend**: Python, FastAPI
- **AI Orchestration**: LangGraph, LangChain
- **LLM**: Groq API (LLaMA 3.3 70B) for blazing-fast inference
- **Speech-to-Text**: `faster-whisper` (local batch transcription), Deepgram (real-time streaming)
- **Embeddings**: HuggingFace `sentence-transformers/all-MiniLM-L6-v2` (local)
- **Database & Vector Store**: MongoDB Atlas + Atlas Vector Search
- **Authentication**: Supabase (Role-based: Teacher vs. Student)

### AI Generation Pipeline (RAG)
1. **Retrieve**: Vector search extracts the most relevant chunks from teacher-uploaded materials and transcripts.
2. **Fact-Check**: Wikipedia API is consulted for fact verification (secondary source).
3. **Generate**: Groq LLM strictly uses the retrieved context to generate notes, assignments, and flashcards in structured JSON format.
4. **Render**: Frontend parses the JSON and renders rich text and LaTeX equations.

---

## 📁 Repository Layout

```text
apps/
  api/        # FastAPI backend (Python)
  web/        # Vite + React frontend
docs/         # Architecture, Workflow, and detailed Operational docs
```

---

## 🛠️ Getting Started

### Prerequisites
- Python 3.10+
- Node.js 18+
- FFmpeg (for audio processing)
- MongoDB Atlas cluster
- API Keys: Supabase, Groq, (Optional) HuggingFace

### 1. Backend (FastAPI) Setup

```bash
cd "apps/api"
python -m venv .venv

# Activate Virtual Environment
# Windows:
.venv\Scripts\activate
# Mac/Linux:
# source .venv/bin/activate

pip install -r requirements.txt
```

**Environment Variables:**
Create a `.env` file at the root of the repository. (Refer to the `.env.example` if available or the `ARCHITECTURE.md` docs).

**Run the Server:**
```bash
uvicorn app.main:app --reload --port 8000
```
- API Docs: `http://localhost:8000/docs`

### 2. Frontend (Vite + React) Setup

```bash
cd "apps/web"
npm install
npm run dev
```
- Application: `http://localhost:5173`
- Environment: Set `VITE_API_URL` in `apps/web/.env.local` if necessary.

---

## 📚 Documentation

Detailed documentation can be found in the `docs/` folder:
- **Architecture**: `docs/ARCHITECTURE.md`
- **Complete Workflow**: `docs/PROJECT_WORKFLOW.md`
- **Document Upload Guide**: `docs/DOCUMENT_UPLOAD_GUIDE.md`
- **Troubleshooting**: `docs/UPLOAD_TROUBLESHOOTING.md`

---

## 🔒 Security

- JWT-based authentication via Supabase.
- Strict Role-Based Access Control (RBAC) ensuring students cannot access teacher portals and vice versa.
- Lecture-scoped vector retrieval ensuring AI only uses materials relevant to the specific lecture.
