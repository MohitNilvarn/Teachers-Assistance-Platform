# Document Upload & Processing Integration - Complete Guide

## Overview
Document upload, processing, and integration with AI content generation is now fully implemented and ready to use.

---

## 🎯 What's Been Implemented

### 1. **Frontend Integration**
**File**: `apps/web/src/pages/dashboard/UnitDetailPage.tsx`

Added a complete **Knowledge Base** section that allows teachers to:
- Upload study materials (PDF, DOCX, PPTX, TXT, Markdown)
- View all uploaded materials with processing status
- Delete materials
- See real-time processing indicators

**Features**:
- Material cards showing filename, file type, processing status, and creation date
- Processing status tracking: `Processing → Ready/Failed`
- Teacher-only delete functionality
- Student read-only view of materials
- Responsive grid layout matching existing UI theme

### 2. **API Endpoints**
**File**: `apps/api/app/api/v1/materials.py`

Three main upload endpoints:

#### Upload to Unit Knowledge Base (Most Common)
```
POST /{course_id}/units/{unit_number}/materials
Content-Type: multipart/form-data
```
- Uploads material to unit-level Knowledge Base
- Material is available to ALL lectures in that unit during content generation
- Teacher only

#### Upload to Specific Lecture
```
POST /lectures/{lecture_id}/materials
Content-Type: multipart/form-data
```
- Uploads material tied to a specific lecture
- Material is only used for that lecture's content generation
- Teacher only

#### Upload to Course
```
POST /{course_id}/materials?lecture_id=optional
Content-Type: multipart/form-data
```
- Uploads course-level material
- Optional lecture linkage
- Teacher only

### 3. **Document Processing Pipeline**
**File**: `apps/api/app/services/document_processor.py`

**Supported Formats**:
- PDF (with OCR fallback for scanned documents)
- DOCX (Word documents with table support)
- PPTX (PowerPoint slides)
- TXT (Plain text)
- Markdown (MD files)

**Process**:
1. File validation (type, size ≤ 50MB)
2. Text extraction (format-specific)
3. Text chunking (1000 char chunks with 200 char overlap)
4. Metadata extraction (page count, word count, etc.)

### 4. **Async Background Processing**
**New Feature**: Documents are now processed asynchronously!

**How it works**:
1. File is uploaded and saved to disk ✓ (returns immediately)
2. Material record created with status `PROCESSING`
3. API returns 201 with processing status
4. Background task begins (doesn't block API):
   - Extracts text from document
   - Creates overlapping chunks
   - Generates embeddings
   - Stores in MongoDB Vector Search
   - Updates material status to `COMPLETED` or `FAILED`

**Benefits**:
- Fast API response (no waiting for embedding)
- Large files don't timeout
- Better user experience
- Multiple files can be processed in parallel

### 5. **Vector Embeddings & Search**
**File**: `apps/api/app/services/embedding_service.py`

Uses `sentence-transformers/all-MiniLM-L6-v2` for:
- Converting document chunks to embeddings
- Storing in MongoDB Atlas Vector Search
- Enabling semantic search during content generation

**Scoping**:
- **Lecture-specific**: Materials only used for that lecture
- **Unit-level**: Materials used for all lectures in the unit
- **Course-level**: General reference materials

---

## 📊 Data Flow

### Upload Flow
```
Frontend (Knowledge Base UI)
    ↓
Upload File
    ↓
POST /api/v1/{course_id}/units/{unit_number}/materials
    ↓
API Saves File + Creates Material Record
    ↓
Returns: { id, filename, status: "PROCESSING" }
    ↓
Background Task Starts Async
    ├─ Extract Text
    ├─ Create Chunks
    ├─ Generate Embeddings
    ├─ Store in MongoDB Vector Search
    └─ Update Material: status = "COMPLETED"
```

### Content Generation Flow
```
Teacher Clicks "Generate Content"
    ↓
Transcript Available
    ↓
AI Graph Retrieves Context:
    ├─ Lecture-specific materials ← Vector search
    ├─ Unit knowledge base materials ← Vector search
    ├─ Transcript excerpts ← Vector search
    └─ Combine as context
    ↓
LLM Generates Content (Notes/Assignments/Flashcards)
    ↓
Stores Generated Content in MongoDB
    ↓
Frontend Displays Content
```

---

## 🚀 How to Use

### For Teachers

#### **Step 1: Upload Materials**
1. Navigate to a Unit (Course → Unit)
2. Scroll to **Knowledge Base** section
3. Click **"Add Material"**
4. Select file (PDF, DOCX, PPTX, TXT, MD)
5. Click **"Upload"**
6. See processing status update in real-time

#### **Step 2: Generate Content**
1. Record lecture or upload audio
2. Transcribe lecture
3. Click **"Generate Content"**
4. AI system automatically:
   - Retrieves your uploaded materials
   - Searches for relevant sections
   - Uses materials as context
   - Generates high-quality content grounded in your materials

#### **Step 3: Review Generated Content**
Generated notes, assignments, and flashcards appear with:
- All references grounded in your materials + transcript
- No made-up information
- Proper LaTeX for math equations
- Edit capability for teachers

### For Students
1. View knowledge base materials (read-only)
2. Access generated study materials from lectures
3. No limitations on content access

---

## 📱 API Response Examples

### Upload Response (Immediate - Async Processing Starts)
```json
{
  "id": "507f1f77bcf86cd799439011",
  "course_id": "507f1f77bcf86cd799439012",
  "unit_number": 1,
  "filename": "Chapter1.pdf",
  "file_type": "pdf",
  "processing_status": "processing",
  "message": "Material uploaded successfully. Processing in background..."
}
```

### Material Status During Processing
```json
{
  "id": "507f1f77bcf86cd799439011",
  "filename": "Chapter1.pdf",
  "file_type": "pdf",
  "processing_status": "processing",  // ← Still processing embeddings
  "file_size_bytes": 1524288,
  "created_at": "2024-04-21T10:30:00Z",
  "processed_at": null
}
```

### Material Status After Completion
```json
{
  "id": "507f1f77bcf86cd799439011",
  "filename": "Chapter1.pdf",
  "file_type": "pdf",
  "processing_status": "completed",  // ← Ready to use
  "file_size_bytes": 1524288,
  "created_at": "2024-04-21T10:30:00Z",
  "processed_at": "2024-04-21T10:32:15Z",
  "content": "Chapter 1 content...",
  "chunks": ["Chapter 1: ...", "1.1 Introduction: ..."],
  "embedding_ids": ["507f1f77bcf86cd799439011_chunk_0", ...]
}
```

### List Materials Response
```json
{
  "materials": [
    {
      "id": "507f1f77bcf86cd799439011",
      "filename": "Chapter1.pdf",
      "file_type": "pdf",
      "processing_status": "completed",
      "created_at": "2024-04-21T10:30:00Z"
    },
    {
      "id": "507f1f77bcf86cd799439012",
      "filename": "Slides.pptx",
      "file_type": "pptx",
      "processing_status": "processing",
      "created_at": "2024-04-21T10:35:00Z"
    }
  ],
  "total": 2
}
```

---

## 🔧 Configuration

### Upload Settings (apps/api/app/core/config.py)
```python
MAX_UPLOAD_SIZE_MB = 50          # Max file size
UPLOAD_DIR = "apps/api/uploads"  # Where files are stored
EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
```

### Document Processing (apps/api/app/services/document_processor.py)
```python
CHUNK_SIZE = 1000                # Characters per chunk
CHUNK_OVERLAP = 200              # Overlap between chunks
SUPPORTED_TYPES = ["pdf", "docx", "pptx", "txt", "md"]
```

---

## ✅ Testing the Integration

### Test Upload via Frontend
1. Login as teacher
2. Navigate to any unit
3. Click "Add Material" in Knowledge Base
4. Upload a test PDF/DOCX file
5. Verify status changes from "Processing" → "Ready"

### Test Content Generation
1. Record/upload a lecture
2. Transcribe it
3. Upload relevant materials beforehand
4. Click "Generate Content"
5. Verify generated content references your materials

### Check Processing Status
- Open browser DevTools (F12)
- Navigate to Network tab
- Click "Add Material"
- Check response includes `"processing_status": "processing"`
- Refresh after 10-30 seconds (depending on file size)
- Status should be "completed"

---

## 🐛 Troubleshooting

### Upload Hangs or Times Out
**Solution**: Already fixed! Processing is now async. If still issues:
- Check file size (max 50MB)
- Check file format (PDF, DOCX, PPTX, TXT, MD only)
- Check browser console for errors

### Material Shows "Failed" Status
**Check**:
- File is valid/not corrupted
- For PDFs: Try a scanned PDF (may need OCR)
- For Word docs: Ensure not password-protected
- Check backend logs for specific error

### Content Generation Not Using Materials
**Check**:
1. Material status is "completed" (not "processing")
2. Material is uploaded to the correct unit
3. Generation was triggered AFTER material upload
4. Check backend logs for vector search errors

### Embeddings Not Working
**Current Workaround**:
- Document text extraction still works without embeddings
- Content generation falls back to keyword search
- Check logs for: "Embedding error"

---

## 📋 Implementation Checklist

- [x] Frontend Knowledge Base UI in UnitDetailPage.tsx
- [x] API endpoints for material upload (3 variants)
- [x] Document processor (5 formats supported)
- [x] Text chunking with overlap
- [x] File validation and storage
- [x] Material model and schema
- [x] Async background processing
- [x] Processing status tracking
- [x] Vector embedding and storage
- [x] Integration with content generation
- [x] Error handling and logging
- [x] Student read-only access

---

## 🎓 How AI Uses Your Materials

When you generate content, the system:

1. **Searches your materials** using vector embeddings
   - Finds the 8 most relevant lecture-specific material chunks
   - Finds the 8 most relevant unit knowledge base chunks

2. **Builds context** from:
   - Lecture transcript (primary source)
   - Teacher materials (secondary source - highest priority)
   - Unit knowledge base (shared across unit)
   - Wikipedia (fact-checking only)

3. **Generates content** using:
   - System prompt that enforces grounding
   - Your combined context
   - Lecture transcript
   - Groq LLM (llama3-70b)

4. **Result**: Notes, assignments, flashcards that are:
   - ✓ Grounded in your materials
   - ✓ Grounded in transcript
   - ✓ No hallucinated information
   - ✓ Properly formatted with LaTeX
   - ✓ Editable by teachers

---

## 📞 Support

If documents still won't upload:
1. Check backend logs: `uvicorn` terminal output
2. Verify MongoDB connection
3. Check file permissions in `apps/api/uploads` directory
4. Try a simple .txt file first to isolate the issue
5. Check browser console (F12) for frontend errors

The system is now production-ready for document upload and processing!
