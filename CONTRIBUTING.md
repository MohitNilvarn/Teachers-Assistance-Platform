# Contributing to TAP

Thanks for helping improve the Teacher Assistance Platform. This guide covers how the repository is organized and what to check before opening a pull request. For first-time setup, follow [Getting Started](README.md#getting-started) in the README.

## Repository layout

```text
.
├── apps/
│   ├── api/                  # FastAPI backend (Python 3.11)
│   │   ├── app/
│   │   │   ├── ai/           # LLM clients, LangGraph pipeline, prompts, external knowledge tools
│   │   │   ├── api/v1/       # HTTP/WebSocket endpoints, one module per resource
│   │   │   │   └── router.py # Registers every v1 router
│   │   │   ├── core/         # Settings, logging, auth dependencies
│   │   │   ├── data/         # Static reference data (subject catalog)
│   │   │   ├── db/           # MongoDB, Redis, and Supabase clients
│   │   │   ├── models/       # Beanie (MongoDB) documents
│   │   │   ├── schemas/      # Pydantic request/response models
│   │   │   ├── services/     # Business logic: ingestion, retrieval, transcription
│   │   │   └── main.py       # App factory, middleware, lifespan
│   │   ├── scripts/          # One-off maintenance and diagnostic scripts
│   │   ├── tests/            # pytest suite
│   │   └── .env.example
│   └── web/                  # React + Vite frontend (TypeScript)
│       ├── public/
│       ├── src/
│       │   ├── components/   # auth/, dashboard/, landing/, ui/
│       │   ├── lib/          # API client and shared helpers
│       │   ├── pages/        # Route-level components
│       │   └── types/        # Shared TypeScript types
│       └── .env.example
├── docs/                     # Architecture and workflow documentation
│   └── assets/               # Animated SVGs used by the README
└── .github/                  # CI workflow and PR template
```

## Before you open a pull request

CI runs these same checks on every pull request.

**Backend** (from `apps/api`, with the virtual environment active):

```bash
pip install -r requirements-dev.txt
pytest
```

**Frontend** (from `apps/web`):

```bash
npm ci
npm run lint
npm run build
```

## Conventions

### Backend

- Add new endpoints to `app/api/v1/<resource>.py` and register the router in `app/api/v1/router.py`. Append new routers rather than inserting them, because routers sharing the bare `/api/v1` prefix have overlapping path patterns.
- Put request/response models in `app/schemas/`, MongoDB documents in `app/models/`, and business logic in `app/services/`. Endpoint modules should stay thin.
- Read configuration through `app.core.config.settings`. Every new environment variable goes in `app/core/config.py` **and** `apps/api/.env.example`.
- Runtime dependencies go in `requirements.txt`. Test and tooling dependencies go in `requirements-dev.txt`.
- Scripts that talk to a live database or server belong in `scripts/`, not `tests/`. The test suite must run without network access or credentials.

### Frontend

- Name component files in PascalCase after the component they export, for example `HeroSection.tsx` exports `HeroSection`.
- Route-level screens go in `src/pages/`. Reusable pieces go in `src/components/<area>/`.
- Call the backend only through `src/lib/api.ts`, and add response types to `src/types/`.
- Browser-exposed environment variables must be prefixed with `VITE_` and documented in `apps/web/.env.example`.

### Git

- Branch from `prod` using `feature/<name>`, `fix/<name>`, or `chore/<name>`.
- Keep pull requests focused, and describe how you verified the change.
- Never commit `.env` files or credentials. If a secret is committed by accident, rotate it immediately. Deleting the file does not remove it from git history.
