"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AlertCircle, CheckCircle2, Loader2, User, Mail, Phone, Calendar, MapPin, Shield, Briefcase, GraduationCap } from "lucide-react"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"

interface ProfileData {
  id: string
  email: string
  name: string
  phone: string | null
  image: string | null
  role: string
  isActive: boolean
  createdAt: string
  student?: {
    id: string
    admissionNumber: string
    dateOfBirth: string
    gender: string
    address: string | null
    emergencyContact: string | null
    bloodGroup: string | null
    status: string
    classEnrollment: Array<{
      class: { name: string }
      section: { name: string }
      academicYear: { year: string }
    }>
  }
  staff?: {
    id: string
    employeeId: string
    designation: string
    department: string | null
    qualification: string | null
    experience: number | null
    joiningDate: string | null
    gender: string | null
    dateOfBirth: string | null
    address: string | null
    status: string
  }
  parent?: {
    id: string
    occupation: string | null
    students: Array<{
      student: {
        user: {
          name: string
          email: string
        }
      }
      relation: string
    }>
  }
  roles: Array<{
    role: {
      name: string
      description: string | null
    }
  }>
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  // Form state
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [gender, setGender] = useState("")
  const [dateOfBirth, setDateOfBirth] = useState("")
  const [address, setAddress] = useState("")
  const [emergencyContact, setEmergencyContact] = useState("")
  const [bloodGroup, setBloodGroup] = useState("")
  const [department, setDepartment] = useState("")
  const [qualification, setQualification] = useState("")

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPasswordSection, setShowPasswordSection] = useState(false)

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    try {
      const response = await fetch("/api/profile")
      if (response.ok) {
        const data = await response.json()
        setProfile(data)
        
        // Initialize form state
        setName(data.name || "")
        setPhone(data.phone || "")
        
        if (data.student) {
          setGender(data.student.gender || "")
          setDateOfBirth(data.student.dateOfBirth ? data.student.dateOfBirth.split("T")[0] : "")
          setAddress(data.student.address || "")
          setEmergencyContact(data.student.emergencyContact || "")
          setBloodGroup(data.student.bloodGroup || "")
        }
        
        if (data.staff) {
          setGender(data.staff.gender || "")
          setDateOfBirth(data.staff.dateOfBirth ? data.staff.dateOfBirth.split("T")[0] : "")
          setAddress(data.staff.address || "")
          setDepartment(data.staff.department || "")
          setQualification(data.staff.qualification || "")
        }
      } else {
        toast({
          title: "Error",
          description: "Failed to load profile",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error fetching profile:", error)
      toast({
        title: "Error",
        description: "Failed to load profile",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    // Validate password change if attempted
    if (showPasswordSection && newPassword) {
      if (newPassword !== confirmPassword) {
        toast({
          title: "Error",
          description: "New passwords do not match",
          variant: "destructive",
        })
        return
      }
      if (newPassword.length < 6) {
        toast({
          title: "Error",
          description: "New password must be at least 6 characters",
          variant: "destructive",
        })
        return
      }
      if (!currentPassword) {
        toast({
          title: "Error",
          description: "Current password is required",
          variant: "destructive",
        })
        return
      }
    }

    setSaving(true)

    try {
      const updateData: any = {
        name,
        phone,
        gender,
        dateOfBirth: dateOfBirth || undefined,
        address,
      }

      // Add profile-specific fields
      if (profile?.student) {
        updateData.emergencyContact = emergencyContact
        updateData.bloodGroup = bloodGroup
      }

      if (profile?.staff) {
        updateData.department = department
        updateData.qualification = qualification
      }

      // Add password change if attempted
      if (showPasswordSection && newPassword) {
        updateData.currentPassword = currentPassword
        updateData.newPassword = newPassword
      }

      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      })

      if (response.ok) {
        const updatedProfile = await response.json()
        setProfile(updatedProfile)
        toast({
          title: "Success",
          description: "Profile updated successfully",
        })
        
        // Clear password fields
        setCurrentPassword("")
        setNewPassword("")
        setConfirmPassword("")
        setShowPasswordSection(false)
      } else {
        const error = await response.json()
        toast({
          title: "Error",
          description: error.error || "Failed to update profile",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error updating profile:", error)
      toast({
        title: "Error",
        description: "Failed to update profile",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!profile) {
    return (
      <Card className="border-destructive">
        <CardContent className="flex items-center gap-2 pt-6">
          <AlertCircle className="h-4 w-4 text-destructive" />
          <p className="text-destructive">Failed to load profile data</p>
        </CardContent>
      </Card>
    )
  }

  const currentEnrollment = profile.student?.classEnrollment?.[0]

  return (
    <div className="space-y-6">
      <div className="mb-6 pb-4 border-b border-gray-200 dark:border-gray-800">
        <h1 className="text-2xl sm:text-3xl font-bold">My Profile</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          View and update your personal information
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Profile Summary Card */}
        <Card className="md:col-span-1">
          <CardHeader className="text-center">
            <div className="mx-auto h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <User className="h-10 w-10 text-primary" />
            </div>
            <CardTitle>{profile.name}</CardTitle>
            <CardDescription>{profile.email}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2 justify-center">
              {profile.roles.map((r, index) => (
                <Badge key={index} variant="secondary">
                  {r.role.name}
                </Badge>
              ))}
            </div>
            
            <Separator />
            
            <div className="space-y-3 text-sm">
              {profile.student && (
                <>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <GraduationCap className="h-4 w-4" />
                    <span>Admission: {profile.student.admissionNumber}</span>
                  </div>
                  {currentEnrollment && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Shield className="h-4 w-4" />
                      <span>
                        {currentEnrollment.class.name} - {currentEnrollment.section.name}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Badge variant={profile.student.status === "ACTIVE" ? "default" : "secondary"}>
                      {profile.student.status}
                    </Badge>
                  </div>
                </>
              )}
              
              {profile.staff && (
                <>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Briefcase className="h-4 w-4" />
                    <span>ID: {profile.staff.employeeId}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Shield className="h-4 w-4" />
                    <span>{profile.staff.designation}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Badge variant={profile.staff.status === "ACTIVE" ? "default" : "secondary"}>
                      {profile.staff.status}
                    </Badge>
                  </div>
                </>
              )}
              
              {profile.parent && profile.parent.students.length > 0 && (
                <div className="space-y-2">
                  <p className="font-medium">Children:</p>
                  {profile.parent.students.map((s, index) => (
                    <div key={index} className="flex items-center gap-2 text-muted-foreground">
                      <User className="h-4 w-4" />
                      <span>{s.student.user.name} ({s.relation})</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Edit Profile Card */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Edit Profile</CardTitle>
            <CardDescription>Update your personal information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Basic Information</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="pl-9"
                      placeholder="Enter your name"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="pl-9"
                      placeholder="Enter phone number"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gender">Gender</Label>
                  <Select value={gender} onValueChange={setGender}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MALE">Male</SelectItem>
                      <SelectItem value="FEMALE">Female</SelectItem>
                      <SelectItem value="OTHER">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dateOfBirth">Date of Birth</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="dateOfBirth"
                      type="date"
                      value={dateOfBirth}
                      onChange={(e) => setDateOfBirth(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Textarea
                    id="address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="pl-9 min-h-[80px]"
                    placeholder="Enter your address"
                  />
                </div>
              </div>
            </div>

            {/* Student-specific fields */}
            {profile.student && (
              <>
                <Separator />
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Student Information</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="emergencyContact">Emergency Contact</Label>
                      <Input
                        id="emergencyContact"
                        value={emergencyContact}
                        onChange={(e) => setEmergencyContact(e.target.value)}
                        placeholder="Enter emergency contact"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bloodGroup">Blood Group</Label>
                      <Select value={bloodGroup} onValueChange={setBloodGroup}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select blood group" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="A+">A+</SelectItem>
                          <SelectItem value="A-">A-</SelectItem>
                          <SelectItem value="B+">B+</SelectItem>
                          <SelectItem value="B-">B-</SelectItem>
                          <SelectItem value="AB+">AB+</SelectItem>
                          <SelectItem value="AB-">AB-</SelectItem>
                          <SelectItem value="O+">O+</SelectItem>
                          <SelectItem value="O-">O-</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Staff-specific fields */}
            {profile.staff && (
              <>
                <Separator />
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Staff Information</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="department">Department</Label>
                      <Input
                        id="department"
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        placeholder="Enter department"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="qualification">Qualification</Label>
                      <Input
                        id="qualification"
                        value={qualification}
                        onChange={(e) => setQualification(e.target.value)}
                        placeholder="Enter qualification"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Password Change Section */}
            <Separator />
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Change Password</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPasswordSection(!showPasswordSection)}
                >
                  {showPasswordSection ? "Cancel" : "Change Password"}
                </Button>
              </div>
              
              {showPasswordSection && (
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">Current Password</Label>
                    <Input
                      id="currentPassword"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter current password"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">New Password</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
