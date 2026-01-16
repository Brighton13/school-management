import { NextResponse } from "next/server"

export async function GET() {
  const csvContent = `email,password,name,phone,employeeId,designation,department,qualification,experience,salary,joiningDate
teacher1@school.com,password123,Alice Brown,1234567890,EMP001,TEACHER,Mathematics,M.Sc Mathematics,5,50000,2020-01-15
teacher2@school.com,password123,Charlie Wilson,1234567891,EMP002,TEACHER,Science,B.Sc Physics,3,45000,2021-06-01
accountant@school.com,password123,Diana Lee,1234567892,EMP003,ACCOUNTANT,Finance,B.Com,7,60000,2019-03-10`

  return new NextResponse(csvContent, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": "attachment; filename=staff_template.csv",
    },
  })
}

