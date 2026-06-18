# Teacher Assistance Platform (TAP)

AI-powered platform that turns lectures and teacher materials into grounded study content (notes, assignments, flashcards) using a production-grade RAG pipeline.

## Repository Layout

```
apps/
  api/        # FastAPI backend (Python)
  web/        # Vite + React frontend
docs/         # Architecture and operational docs
```

## Backend (FastAPI)

```bash
cd "apps/api"
python -m venv .venv
.venv\Scripts\activate  # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

- API docs: http://localhost:8000/docs
- Uploads default to `apps/api/uploads` (configurable via `UPLOAD_DIR`).
- `.env` lives at the repo root.

## Frontend (Vite + React)

```bash
cd "apps/web"
npm install
npm run dev
```

- App: http://localhost:5173
- Set `VITE_API_URL` in `apps/web/.env.local` if needed.

## Tests

```bash
cd "apps/api"
pytest
```

## Docs

- Architecture: docs/ARCHITECTURE.md
- Workflow: docs/PROJECT_WORKFLOW.md
- Upload pipeline: docs/DOCUMENT_UPLOAD_GUIDE.md
- Upload troubleshooting: docs/UPLOAD_TROUBLESHOOTING.md
