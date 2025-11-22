import { NextResponse } from "next/server"

export async function GET() {
  const csvContent = `email,password,name,phone,admissionNumber,dateOfBirth,gender,address,emergencyContact
student1@school.com,password123,John Doe,1234567890,ADM001,2010-01-15,Male,123 Main St,9876543210
student2@school.com,password123,Jane Smith,1234567891,ADM002,2010-03-20,Female,456 Oak Ave,9876543211
student3@school.com,password123,Bob Johnson,1234567892,ADM003,2010-05-10,Male,789 Pine Rd,9876543212`

  return new NextResponse(csvContent, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": "attachment; filename=students_template.csv",
    },
  })
}

