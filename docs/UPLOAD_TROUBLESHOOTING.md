# Document Upload Troubleshooting Guide

## Issues Found & Fixed

### 1. **Unit Validation Error** ✅ FIXED
**Problem**: If a course had no units configured, ANY upload attempt would fail with a cryptic error.
**Fix**: Added explicit validation to check if units exist and provide a clear error message.
**Error Message Before**: "Unit X does not exist in this course. Valid units: []"
**Error Message After**: "Course has no units configured. Please contact support..."

### 2. **Async Task Creation Error Handling** ✅ FIXED  
**Problem**: If the background processing task failed to be created, the error was silently ignored, and the Material would be stuck in "PROCESSING" status forever.
**Fix**: Added try-catch around `asyncio.create_task()` to catch and log any errors, marking the Material as FAILED if the task can't be created.

---

## Prerequisites for Upload to Work

### 1. **Course Setup**
- ✓ Course must be created
- ✓ Course must have **at least one unit configured**
  - Units are typically auto-created when you select a subject
  - If missing, contact admin to create them
- ✓ You (the teacher) must be the course owner

### 2. **Unit Configuration**
- ✓ Unit number must be between 1-6
- ✓ Unit must have a title
- ✓ Check unit exists: Go to Unit Detail Page → should see unit info

### 3. **File Requirements**
- ✓ Supported formats: PDF, DOCX, PPTX, TXT, Markdown
- ✓ File size: < 50MB
- ✓ File must not be corrupted or password-protected (for DOCX)

### 4. **Authentication**
- ✓ Must be logged in as a teacher (not student)
- ✓ Session token must be valid
- ✓ Browser cookies must be allowed

### 5. **API Server**
- ✓ Backend server must be running on http://127.0.0.1:8000
- ✓ MongoDB must be accessible
- ✓ Network connection must be stable

---

## Troubleshooting Steps

### Step 1: Check if Server is Running
```bash
# Open a new terminal and check if server is listening
curl http://127.0.0.1:8000/api/v1/courses
# Should return JSON response (may require auth)
```

### Step 2: Verify Course Setup
```bash
# In browser console, check your course:
localStorage.getItem('currentCourse')
# Should show course details with units array
```

### Step 3: Check Browser Console Errors
1. Open browser DevTools: **F12**
2. Go to **Console** tab
3. Try uploading a file
4. Look for error messages - they will show the exact problem

### Step 4: Check Network Tab
1. Open browser DevTools: **F12**
2. Go to **Network** tab
3. Try uploading a file
4. Look for the POST request to `/api/v1/{courseId}/units/{unitNumber}/materials`
5. Check the response status and body for error details

### Step 5: Check Backend Logs
1. Look at the terminal where the API server is running
2. Look for error messages mentioning "Material" or "upload"
3. Check for specific errors like:
   - `File save error: ...`
   - `Failed to create async processing task: ...`
   - `Material ... processing failed: ...`

---

## Common Error Messages & Solutions

### ❌ "Course has no units configured"
**Cause**: The course doesn't have units set up.
**Solution**:
- Check if you created the course properly
- Units should be auto-created when you select a subject
- If missing, contact your administrator

### ❌ "Unit X does not exist in this course. Valid units: []"
**Cause**: Same as above - no units in course.
**Solution**: See above.

### ❌ "Unit X does not exist in this course. Valid units: [1, 2]"
**Cause**: You tried to upload to Unit 3, but only Units 1 and 2 exist.
**Solution**: Check the unit number you're uploading to - make sure it's one of the valid units.

### ❌ "Access denied"
**Cause**: You're not the owner of this course, or you're logged in as a student.
**Solution**:
- Make sure you're logged in as a teacher
- Make sure you created this course
- If not, ask the course creator to upload materials

### ❌ "File too large. Max size: 50MB"
**Cause**: File is bigger than the 50MB limit.
**Solution**: Compress the file or split it into smaller parts.

### ❌ "File type not allowed"
**Cause**: File format is not supported.
**Solution**: Supported formats are: PDF, DOCX, PPTX, TXT, Markdown

### ❌ "Failed to save file"
**Cause**: Server couldn't write the file to disk (permissions issue, disk full, etc.)
**Solution**:
- Check server disk space
- Check `apps/api/uploads` directory permissions
- Check backend logs for details

### ❌ "No text could be extracted from this document"
**Cause**: Document is scanned/image-based without OCR capabilities, or file is corrupted.
**Solution**:
- Try a different PDF
- If it's a scanned document, you may need to use OCR
- Verify the file isn't corrupted

### ❌ "Embedding failed: ..." (material shows "Processing" forever)
**Cause**: Vector embedding service error (this is now handled).
**Solution**:
- Material content is still extracted even if embedding fails
- Check backend logs for the specific error
- Material will eventually timeout and show "Failed"

---

## Step-by-Step Upload Process

1. **Navigate to Unit**
   - Go to Course → Click on a Unit
   - You should see "Knowledge Base" section at the top

2. **Click "Add Material"**
   - Only visible to teachers
   - Should show dialog to select file

3. **Select File**
   - Click on the dashed upload area
   - Choose a file (PDF, DOCX, PPTX, TXT, or MD)
   - File should appear in the dialog

4. **Click "Upload"**
   - Upload button should become active once file is selected
   - Should show "Uploading..." during upload
   - Should complete within a few seconds

5. **See Processing Status**
   - Material should appear in the list with status "Processing..."
   - Status should update to "Ready" after 10-30 seconds (depends on file size)
   - If it shows "Failed", check the error message

6. **Use in Content Generation**
   - Once status is "Ready", material will be used when you generate content
   - Generated notes/assignments will reference the material

---

## Testing Upload Manually

If you want to test without the UI, you can use curl:

```bash
# Create test file
echo "This is a test document." > test.txt

# Upload (requires valid token)
curl -X POST http://127.0.0.1:8000/api/v1/{courseId}/units/{unitNumber}/materials \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@test.txt"

# Should return JSON with material details
```

---

## What to Check First

### If upload button is disabled:
- Make sure a file is selected
- Check if you're already uploading
- Check browser console for errors

### If upload shows error immediately:
- Check the error message in the UI
- Check if course/unit exists
- Check authentication

### If upload seems to work but material doesn't appear:
- Refresh the page
- Check if list endpoint is working: `GET /api/v1/{courseId}/units/{unitNumber}/materials`
- Check browser console for fetch errors

### If material stays in "Processing" forever:
- Check backend logs
- May be embedding failure (now handled gracefully)
- Content is still usable even if embedding fails

---

## Backend Logs to Check

When troubleshooting, look for these log lines:

### ✓ Success
```
Material {id} queued for async processing: {filename} (pdf) - Task ID: ...
Material {id} processing completed successfully
Successfully embedded X chunks for material {id}
```

### ❌ Errors
```
File save error: ...
Failed to create async processing task: ...
Material {material_id} not found during processing
No text extracted from {filename}
Embedding error for material {id}: ...
Background processing error for {material_id}: ...
```

---

## Final Checklist

- [ ] Backend server is running
- [ ] You're logged in as teacher
- [ ] Course is created with units
- [ ] You're uploading to a valid unit
- [ ] File is supported format and < 50MB
- [ ] Browser console shows no errors
- [ ] Network tab shows 201/200 response
- [ ] Material appears in the list

If all of the above are true and uploads still don't work, there may be an environment-specific issue. Check the backend logs and contact support with the full error message.
