"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BulkUpload } from "@/components/bulk-upload"
import { BulkUploadClassSection } from "@/components/bulk-upload-class-section"

export default function BulkUploadPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Bulk Upload</h1>
        <p className="text-muted-foreground">
          Upload multiple records at once using Excel files with dropdown selections
        </p>
      </div>

      <Tabs defaultValue="students" className="space-y-4">
        <TabsList>
          <TabsTrigger value="students">Students</TabsTrigger>
          <TabsTrigger value="staff">Staff</TabsTrigger>
          <TabsTrigger value="sections">Sections</TabsTrigger>
          <TabsTrigger value="enrollment">Enrollment</TabsTrigger>
          <TabsTrigger value="class-section-enrollment">Class & Section Enrollment</TabsTrigger>
          <TabsTrigger value="teacher-assignments">Teacher Assignments</TabsTrigger>
        </TabsList>

        <TabsContent value="students">
          <BulkUpload
            title="Bulk Student Upload"
            description="Upload multiple students at once. Download the Excel template with dropdown selections for classes, sections, and academic years, fill it with student data, and upload the file."
            uploadEndpoint="/api/bulk/students"
            templateEndpoint="/api/bulk/students"
            templateFileName="students_template.xlsx"
          />
        </TabsContent>

        <TabsContent value="staff">
          <BulkUpload
            title="Bulk Staff Upload"
            description="Upload multiple staff members at once. Download the template, fill it with staff data, and upload the CSV file."
            uploadEndpoint="/api/bulk/staff"
            templateEndpoint="/api/bulk/staff"
            templateFileName="staff_template.csv"
          />
        </TabsContent>

        <TabsContent value="sections">
          <BulkUpload
            title="Bulk Sections Upload"
            description="Upload multiple sections at once. Download the template, fill it with section data, and upload the CSV file. Note: ClassName must match an existing class name, and ClassTeacherEmail must match an existing teacher's email (optional)."
            uploadEndpoint="/api/bulk/sections"
            templateEndpoint="/api/bulk/sections"
            templateFileName="sections_template.csv"
          />
        </TabsContent>

        <TabsContent value="enrollment">
          <BulkUpload
            title="Bulk Enrollment Upload"
            description="Enroll multiple students at once. Download the Excel template with dropdown selections for classes, sections, and academic years, then upload the file."
            uploadEndpoint="/api/bulk/enrollment"
            templateEndpoint="/api/bulk/enrollment"
            templateFileName="enrollment_template.xlsx"
          />
        </TabsContent>

        <TabsContent value="class-section-enrollment">
          <BulkUploadClassSection />
        </TabsContent>

        <TabsContent value="teacher-assignments">
          <BulkUpload
            title="Bulk Teacher Assignment Upload"
            description="Assign teachers to classes and subjects at once. Download the template, fill it with assignment data, and upload the CSV file."
            uploadEndpoint="/api/bulk/teacher-assignments"
            templateEndpoint="/api/bulk/teacher-assignments"
            templateFileName="teacher_assignments_template.csv"
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

