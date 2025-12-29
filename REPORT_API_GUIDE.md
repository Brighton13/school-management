# Report System API Usage Guide

## Authentication

All endpoints require an authenticated session using NextAuth with a valid user role.

## Report Generation Endpoint

### POST /api/reports/generate

Generate a new student report. The system automatically validates that all CORE subjects have approved results.

**Request Body:**
```json
{
  "studentId": "student-uuid",
  "sectionId": "section-uuid",
  "academicTermId": "term-uuid",
  "examId": "exam-uuid" // Optional: filter by specific exam
}
```

**Success Response (201):**
```json
{
  "id": "report-uuid",
  "studentId": "student-uuid",
  "sectionId": "section-uuid",
  "academicTermId": "term-uuid",
  "totalMarksObtained": 445,
  "maxTotalMarks": 500,
  "positionInClass": 3,
  "classSize": 45,
  "progressRatio": 5.5,
  "previousTermAverage": 82.4,
  "currentTermAverage": 87.9,
  "status": "PENDING_CLASS_TEACHER",
  "submittedBy": "teacher-uuid",
  "submittedAt": "2025-12-29T10:24:29.000Z",
  "generatedAt": "2025-12-29T10:24:29.000Z",
  "generatedBy": "teacher-uuid",
  "student": {
    "id": "student-uuid",
    "user": {
      "id": "user-uuid",
      "name": "John Doe",
      "email": "john@school.com"
    }
  },
  "section": {
    "id": "section-uuid",
    "name": "A",
    "class": {
      "id": "class-uuid",
      "name": "Class 10"
    },
    "classTeacher": { /* teacher info */ }
  },
  "academicTerm": {
    "id": "term-uuid",
    "name": "First Term",
    "academicYear": "2025"
  }
}
```

**Error Responses:**

1. **Missing Core Subjects (400):**
```json
{
  "error": "Not all core subjects have approved results",
  "missingSubjects": ["Mathematics", "Science"],
  "approvedCount": 2,
  "totalRequired": 4
}
```

2. **Student Not Enrolled (404):**
```json
{
  "error": "Student not enrolled in this section/term"
}
```

3. **Unauthorized (401):**
```json
{
  "error": "Unauthorized"
}
```

---

## Get Reports Endpoint

### GET /api/reports/generate

Retrieve reports based on user role and filters.

**Query Parameters:**
- `studentId` (optional) - Filter by specific student
- `sectionId` (optional) - Filter by specific section
- `academicTermId` (optional) - Filter by academic term
- `status` (optional) - Filter by status (DRAFT, PENDING_CLASS_TEACHER, PENDING_PRINCIPAL, APPROVED, REJECTED)

**Example Request:**
```
GET /api/reports/generate?sectionId=section-uuid&status=APPROVED
```

**Response:**
```json
[
  {
    "id": "report-uuid",
    "student": {
      "id": "student-uuid",
      "user": {
        "name": "John Doe",
        "email": "john@school.com"
      }
    },
    "section": {
      "id": "section-uuid",
      "name": "A",
      "class": { "id": "class-uuid", "name": "Class 10" }
    },
    "totalMarksObtained": 445,
    "maxTotalMarks": 500,
    "positionInClass": 3,
    "classSize": 45,
    "progressRatio": 5.5,
    "status": "APPROVED",
    "comments": [
      {
        "id": "comment-uuid",
        "commentText": "Excellent performance",
        "performanceArea": "OVERALL",
        "teacher": {
          "id": "teacher-uuid",
          "user": { "name": "Mr. Smith" }
        }
      }
    ]
  }
]
```

---

## Get Report Details Endpoint

### GET /api/reports/[id]

Retrieve complete report with all details including subject results and comments.

**Example Request:**
```
GET /api/reports/report-uuid
```

**Response:**
```json
{
  "report": {
    "id": "report-uuid",
    "student": { /* student data */ },
    "section": { /* section data */ },
    "totalMarksObtained": 445,
    "maxTotalMarks": 500,
    "positionInClass": 3,
    "classSize": 45,
    "progressRatio": 5.5,
    "metadata": {
      "totalResults": 4,
      "totalMarks": 445,
      "maxMarks": 500,
      "percentage": 89,
      "grade": "A",
      "positionInClass": 3,
      "classSize": 45,
      "progressRatio": 5.5,
      "previousTermAverage": 82.4,
      "currentTermAverage": 87.9,
      "classStatistics": {
        "average": 75.5,
        "highest": 480,
        "lowest": 320,
        "studentCount": 45
      }
    },
    "comments": [
      {
        "id": "comment-uuid",
        "commentText": "Good improvement in Mathematics",
        "performanceArea": "OVERALL",
        "teacher": { /* teacher data */ }
      }
    ]
  },
  "subjectResults": [
    {
      "id": "result-uuid",
      "studentId": "student-uuid",
      "marksObtained": 95,
      "maxMarks": 100,
      "grade": "A+",
      "classSubject": {
        "subject": {
          "id": "subject-uuid",
          "name": "Mathematics",
          "type": "CORE"
        },
        "teacher": { /* teacher data */ }
      }
    }
  ],
  "commentsByArea": [
    {
      "area": "OVERALL",
      "comments": [ /* comments for this area */ ]
    },
    {
      "area": "CONDUCT",
      "comments": [ /* comments for this area */ ]
    }
  ]
}
```

---

## Principal Bulk Approval Endpoint

### POST /api/reports/bulk-approve

Principal approves multiple reports for a section.

**Request Body:**
```json
{
  "sectionId": "section-uuid",
  "academicTermId": "term-uuid",
  "reportIds": ["report-uuid-1", "report-uuid-2"], // Optional: specific reports
  "approvalNote": "All checked" // Optional: approval note
}
```

**Success Response:**
```json
{
  "message": "Reports approved successfully",
  "approvedCount": 2,
  "reports": [
    {
      "id": "report-uuid-1",
      "status": "APPROVED",
      "approvedBy": "principal-uuid",
      "approvedAt": "2025-12-29T10:30:00.000Z",
      "student": { /* student data */ }
    },
    {
      "id": "report-uuid-2",
      "status": "APPROVED",
      "approvedBy": "principal-uuid",
      "approvedAt": "2025-12-29T10:30:00.000Z",
      "student": { /* student data */ }
    }
  ]
}
```

---

### GET /api/reports/bulk-approve

Get pending reports grouped by section for principal review.

**Query Parameters:**
- `sectionId` (optional) - Filter by specific section
- `academicTermId` (optional) - Filter by term

**Response:**
```json
[
  {
    "key": "section-uuid-term-uuid",
    "sectionId": "section-uuid",
    "academicTermId": "term-uuid",
    "section": {
      "id": "section-uuid",
      "name": "A",
      "class": { "id": "class-uuid", "name": "Class 10" }
    },
    "academicTerm": {
      "id": "term-uuid",
      "name": "First Term"
    },
    "count": 3,
    "reports": [
      {
        "id": "report-uuid",
        "student": {
          "id": "student-uuid",
          "user": { "name": "John Doe" }
        },
        "totalMarksObtained": 445,
        "maxTotalMarks": 500,
        "positionInClass": 3,
        "classSize": 45,
        "progressRatio": 5.5
      }
    ]
  }
]
```

---

## Report Comments Endpoint

### POST /api/reports/comments

Add a comment or signature to a report.

**Request Body:**
```json
{
  "reportId": "report-uuid",
  "commentText": "Excellent progress in all subjects. Keep it up!",
  "performanceArea": "OVERALL", // OVERALL, CONDUCT, PARTICIPATION, EFFORT, ATTENDANCE
  "teacherSignature": "data:image/png;base64,iVBORw0KGgoAAAANS...", // Optional
  "marksLowerBound": 80, // Optional: for template-based comments
  "marksUpperBound": 100
}
```

**Success Response (201):**
```json
{
  "id": "comment-uuid",
  "reportId": "report-uuid",
  "teacherId": "teacher-uuid",
  "commentText": "Excellent progress in all subjects. Keep it up!",
  "performanceArea": "OVERALL",
  "teacherSignature": "data:image/png;base64,...",
  "signedAt": "2025-12-29T10:35:00.000Z",
  "marksLowerBound": 80,
  "marksUpperBound": 100,
  "teacher": {
    "id": "teacher-uuid",
    "user": { "name": "Mr. Smith" }
  }
}
```

---

### GET /api/reports/comments

Get all comments for a report.

**Query Parameters:**
- `reportId` (required) - Report ID

**Response:**
```json
[
  {
    "id": "comment-uuid-1",
    "reportId": "report-uuid",
    "commentText": "Good effort in Mathematics",
    "performanceArea": "OVERALL",
    "signedAt": "2025-12-29T10:35:00.000Z",
    "teacher": {
      "id": "teacher-uuid",
      "user": { "name": "Mr. Smith" }
    }
  },
  {
    "id": "comment-uuid-2",
    "commentText": "Excellent participation in class discussions",
    "performanceArea": "PARTICIPATION",
    "teacher": { /* teacher data */ }
  }
]
```

---

### PATCH /api/reports/comments

Update an existing comment.

**Request Body:**
```json
{
  "commentId": "comment-uuid",
  "commentText": "Updated comment text",
  "performanceArea": "CONDUCT",
  "teacherSignature": "data:image/png;base64,..." // Optional
}
```

**Response:** Updated comment object

---

### DELETE /api/reports/comments

Delete a comment.

**Query Parameters:**
- `id` (required) - Comment ID

**Response:**
```json
{
  "message": "Comment deleted successfully"
}
```

---

## Status Codes Reference

| Code | Meaning | When Used |
|------|---------|-----------|
| 201 | Created | Report/comment successfully created |
| 200 | OK | Successful GET, PATCH, or DELETE |
| 400 | Bad Request | Missing fields, validation errors, invalid marks range |
| 401 | Unauthorized | User not authenticated |
| 403 | Forbidden | User doesn't have permission for this action |
| 404 | Not Found | Report, comment, or student not found |
| 500 | Server Error | Database or server error |

---

## Role-Based Access Control

### Report Generation
- **TEACHER**: Can generate only for their own sections
- **ADMIN**: Can generate for any section
- **PRINCIPAL**: Can generate for any section
- **STUDENT/PARENT**: Cannot generate

### Report Viewing
- **TEACHER**: Can view reports for their sections
- **PRINCIPAL**: Can view all reports
- **ADMIN**: Can view all reports
- **STUDENT**: Can view only their own reports
- **PARENT**: Cannot view through API (requires student access)

### Report Approval
- **PRINCIPAL**: Can approve reports
- **ADMIN**: Can approve reports
- **TEACHER**: Cannot approve (only generate)
- **STUDENT**: Cannot approve

### Comment Management
- **TEACHER**: Can add/edit/delete their own comments
- **ADMIN**: Can manage all comments
- **PRINCIPAL**: Can add comments but not edit others'
- **STUDENT**: Cannot manage comments

---

## Common Use Cases

### Case 1: Generate Report for a Single Student
```bash
curl -X POST http://localhost:3000/api/reports/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer token" \
  -d '{
    "studentId": "student-uuid",
    "sectionId": "section-uuid",
    "academicTermId": "term-uuid"
  }'
```

### Case 2: Get All Pending Reports for Principal
```bash
curl -X GET "http://localhost:3000/api/reports/bulk-approve" \
  -H "Authorization: Bearer token"
```

### Case 3: Principal Approves All Reports for a Section
```bash
curl -X POST http://localhost:3000/api/reports/bulk-approve \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer token" \
  -d '{
    "sectionId": "section-uuid",
    "academicTermId": "term-uuid"
  }'
```

### Case 4: Teacher Adds Comment with Signature
```bash
curl -X POST http://localhost:3000/api/reports/comments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer token" \
  -d '{
    "reportId": "report-uuid",
    "commentText": "Excellent work this term!",
    "performanceArea": "OVERALL",
    "teacherSignature": "data:image/png;base64,..."
  }'
```

---

## Error Handling Best Practices

1. Always check the response status code
2. Read the `error` field for descriptive error messages
3. For validation errors, check additional fields like `missingSubjects`
4. Log errors for debugging
5. Display user-friendly messages in UI

**Example Error Handling:**
```typescript
try {
  const response = await fetch('/api/reports/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(reportData)
  })

  if (!response.ok) {
    const errorData = await response.json()
    
    if (response.status === 400 && errorData.missingSubjects) {
      console.error('Missing subjects:', errorData.missingSubjects)
      // Show specific error about missing subjects
    } else {
      console.error('Error:', errorData.error)
      // Show generic error
    }
  }
} catch (error) {
  console.error('Network error:', error)
}
```
