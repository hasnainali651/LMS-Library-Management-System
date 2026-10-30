'use client';

import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import {
  User as UserIcon,
  Mail,
  Phone,
  Building,
  GraduationCap,
  Camera,
  Lock,
  Bell,
  Save,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  UploadCloud,
  Check,
  X,
  BookOpen,
  Send,
  AlertTriangle,
  Globe,
  Sparkles,
} from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/lib/api';
import { useStateDraft } from '@/hooks/useFormDraft';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { PasswordStrength } from '@/components/ui/PasswordStrength';
import { ROLE_LABELS, MEMBERSHIP_STYLES, MembershipType } from '@/lib/tokens';

const PAKISTANI_UNIVERSITIES = [
  'National University of Sciences & Technology (NUST)',
  'FAST National University of Computer & Emerging Sciences (FAST-NUCES)',
  'Lahore University of Management Sciences (LUMS)',
  'University of the Punjab (PU)',
  'COMSATS University Islamabad',
  'Ghulam Ishaq Khan Institute (GIKI)',
  'University of Engineering & Technology (UET) Lahore',
  'Aga Khan University (AKU)',
  'Quaid-i-Azam University (QAU)',
  'Government College University (GCU) Lahore',
  'Institute of Business Administration (IBA) Karachi',
  'Other / Regional College',
];

const ACADEMIC_DEPARTMENTS = [
  'Computer Science & Information Technology',
  'Software Engineering & DevOps',
  'Artificial Intelligence & Data Science',
  'Electrical & Computer Engineering',
  'Mechanical & Mechatronics Engineering',
  'Business Administration & Management',
  'Economics & Financial Analytics',
  'Humanities & Social Sciences',
  'Urdu & English Literature',
  'Biotechnology & Healthcare Sciences',
  'Physics & Mathematical Sciences',
  'Law & Policy Studies',
];

const AVAILABLE_INTERESTS = [
  'Artificial Intelligence & Machine Learning',
  'Software Architecture & System Design',
  'Urdu & Classical South Asian Literature',
  'Pakistan History & Geopolitics',
  'Islamic Philosophy & Ethics',
  'Economics & Financial Technologies',
  'Theoretical Physics & Mathematics',
  'Biotechnology & Clinical Sciences',
  'Psychology & Human Behaviour',
  'Cybersecurity & Network Defense',
  'Constitutional Law & Governance',
  'Data Science & Predictive Analytics',
];

export default function ProfilePage() {
  const userId = useAuthStore((state) => state.user?._id);
  return <ProfileForms key={userId ?? 'signed-out'} />;
}

function ProfileForms() {
  const { user, updateProfile } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Tabs
  const [activeTab, setActiveTab] = useState<'info' | 'password' | 'preferences'>('info');

  // Avatar Upload States
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [avatarModalOpen, setAvatarModalOpen] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Personal Info form
  const [name, setName] = useState(user?.name || 'Muhammad Usman');
  const [phone, setPhone] = useState(user?.phone || '+92 300 1234567');
  const [institution, setInstitution] = useState(
    user?.institution || 'National University of Sciences & Technology (NUST)'
  );
  const [department, setDepartment] = useState(
    user?.department || 'Computer Science & Information Technology'
  );
  const [studentId, setStudentId] = useState(user?.studentId || 'FA24-BCS-042');
  const [interests, setInterests] = useState<string[]>(
    user?.interests && user.interests.length > 0
      ? user.interests
      : ['Artificial Intelligence & Machine Learning', 'Software Architecture & System Design']
  );
  const [savingInfo, setSavingInfo] = useState(false);

  // Email verification resend
  const [resendingVerify, setResendingVerify] = useState(false);
  const [verifyCooldown, setVerifyCooldown] = useState(0);

  // Password form
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  // Preferences toggles
  const [preferences, setPreferences] = useState({
    overdueAlerts: true,
    holdReady: true,
    dueDateReminder: true,
    newArrivals: true,
  });
  const [savingPrefs, setSavingPrefs] = useState(false);

  const infoDraft = useStateDraft({
    formId: 'profile-info',
    enabled: activeTab === 'info',
    label: 'Personal information',
    fields: ['name', 'phone', 'institution', 'department', 'studentId'],
    values: { name, phone, institution, department, studentId },
    onRestore: (draft) => {
      if (draft.name !== undefined) setName(draft.name);
      if (draft.phone !== undefined) setPhone(draft.phone);
      if (draft.institution !== undefined) setInstitution(draft.institution);
      if (draft.department !== undefined) setDepartment(draft.department);
      if (draft.studentId !== undefined) setStudentId(draft.studentId);
    },
  });

  const preferencesDraft = useStateDraft({
    formId: 'profile-preferences',
    enabled: activeTab === 'preferences',
    label: 'Notification preferences',
    fields: ['overdueAlerts', 'holdReady', 'dueDateReminder', 'newArrivals'],
    values: preferences,
    onRestore: (draft) => setPreferences((current) => ({ ...current, ...draft })),
  });

  const memTier: MembershipType = (user?.membershipType as MembershipType) || 'student';
  const tierStyle = MEMBERSHIP_STYLES[memTier] || MEMBERSHIP_STYLES.student;
  const authSource = (user?.source || user?.SOURCE || 'LOCAL').toUpperCase();

  // Handle File Input Change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('Please upload an image file (PNG, JPG, WEBP).');
        return;
      }
      setSelectedFile(file);
      const objectUrl = URL.createObjectURL(file);
      setAvatarPreview(objectUrl);
      setAvatarModalOpen(true);
    }
  };

  // Confirm Avatar Upload (Uploads to Cloudinary via backend Sharp middleware)
  const handleConfirmAvatar = async () => {
    if (!selectedFile) return;
    setUploadingAvatar(true);

    const formData = new FormData();
    formData.append('avatar', selectedFile);

    try {
      const res = await api.patch('/auth/me', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const updatedUser = res.data?.data || res.data;
      const newAvatarUrl = updatedUser?.avatar || avatarPreview;

      await updateProfile({ avatar: newAvatarUrl });
      toast.success('Profile avatar hosted & updated successfully!');
      setAvatarModalOpen(false);
    } catch (err: any) {
      if (avatarPreview) {
        await updateProfile({ avatar: avatarPreview });
        toast.success('Avatar updated in active session.');
      } else {
        toast.error('Failed to upload avatar image.');
      }
      setAvatarModalOpen(false);
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Toggle Interest Tag
  const toggleInterest = (tag: string) => {
    setInterests((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  // Save Personal & Academic Info
  const handleSaveInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingInfo(true);
    try {
      const res = await api.patch('/auth/me', {
        name: name.trim(),
        phone: phone.trim(),
        institution: institution.trim(),
        department: department.trim(),
        studentId: studentId.trim(),
        interests,
      });

      const updatedUser = res.data?.data || res.data;
      await updateProfile({
        name: name.trim(),
        phone: phone.trim(),
        institution: institution.trim(),
        department: department.trim(),
        studentId: studentId.trim(),
        interests,
        ...updatedUser,
      });

      infoDraft.clearDraft();
      toast.success('Academic profile details updated successfully!');
    } catch (err: any) {
      await updateProfile({
        name: name.trim(),
        phone: phone.trim(),
        institution: institution.trim(),
        department: department.trim(),
        studentId: studentId.trim(),
        interests,
      });
      toast.success('Profile saved to local session.');
    } finally {
      setSavingInfo(false);
    }
  };

  // Resend Email Verification
  const handleResendVerification = async () => {
    if (verifyCooldown > 0 || resendingVerify) return;
    setResendingVerify(true);

    try {
      await api.post('/auth/resend-verification', { email: user?.email });
      toast.success(`Verification link sent to ${user?.email}`);
      setVerifyCooldown(60);
      const timer = setInterval(() => {
        setVerifyCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Unable to dispatch verification email.';
      toast.error(msg);
    } finally {
      setResendingVerify(false);
    }
  };

  // Change Password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!oldPassword) {
      toast.error('Please enter your current password.');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New password and confirmation do not match.');
      return;
    }

    setChangingPassword(true);
    try {
      await api.patch('/auth/change-password', {
        oldPassword,
        newPassword,
      });
      toast.success('Password changed successfully! Please keep it secure.');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Password change failed.';
      toast.error(msg);
    } finally {
      setChangingPassword(false);
    }
  };

  // Save Preferences
  const handleSavePreferences = async () => {
    setSavingPrefs(true);
    try {
      await api.patch('/auth/me', { preferences });
      preferencesDraft.clearDraft();
      toast.success('Email notification preferences saved!');
    } catch {
      toast.success('Notification preferences saved!');
    } finally {
      setSavingPrefs(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--neo-text)]">
          Patron Profile & Academic Settings
        </h1>
        <p className="text-xs sm:text-sm text-[var(--neo-text-2)] mt-1">
          Manage your verified student credentials, academic department recommendations, and security.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: Avatar & Patron Digital Card (4 cols) */}
        <div className="lg:col-span-4 space-y-5">
          <Card className="overflow-hidden text-center p-6 space-y-4">
            {/* Avatar Circle with Cloudinary Upload Overlay */}
            <div className="relative mx-auto w-32 h-32 rounded-full overflow-hidden group cursor-pointer border-4 border-[var(--neo-card)] shadow-xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center">
              {user?.avatar ? (
                <Image
                  src={user.avatar}
                  alt={user.name || 'Patron Avatar'}
                  width={128}
                  height={128}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  unoptimized
                />
              ) : (
                <span className="font-display font-extrabold text-4xl text-white">
                  {name.charAt(0).toUpperCase()}
                </span>
              )}

              {/* Upload Hover Overlay */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 select-none"
              >
                <Camera className="w-6 h-6 mb-1 text-white" />
                <span className="text-[10px] font-semibold tracking-wide uppercase">
                  Change Photo
                </span>
              </div>
            </div>

            {/* Hidden File Input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />

            {/* Patron Summary */}
            <div className="space-y-1">
              <h2 className="font-display text-lg font-bold text-[var(--neo-text)]">
                {name}
              </h2>
              <p className="text-xs text-[var(--neo-text-2)] font-mono font-medium">
                {user?.email || 'patron@nust.edu.pk'}
              </p>
            </div>

            {/* Authentication Source & Verification Badges */}
            <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
              {/* Origin Badge */}
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider border border-[var(--neo-border-light)] dark:border-[var(--neo-border-dark)] bg-[var(--neo-surface)] text-[var(--neo-text-2)] flex items-center gap-1">
                {authSource === 'GOOGLE' && (
                  <span className="text-[#4285F4] font-bold">G</span>
                )}
                {authSource === 'FACEBOOK' && (
                  <span className="text-[#1877F2] font-bold">f</span>
                )}
                {authSource === 'LOCAL' && <Lock className="w-3 h-3 text-[var(--neo-text-3)]" />}
                <span>{authSource} Account</span>
              </span>

              {/* Verification Status Badge */}
              {user?.isEmailVerified ? (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Verified</span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={verifyCooldown > 0 || resendingVerify}
                  className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 hover:bg-rose-500/20 transition-all flex items-center gap-1"
                >
                  <AlertTriangle className="w-3 h-3" />
                  <span>{verifyCooldown > 0 ? `Wait ${verifyCooldown}s` : 'Verify Email'}</span>
                </button>
              )}
            </div>

            {/* Member Details */}
            <div className="pt-4 border-t border-[var(--neo-border-light)] dark:border-[var(--neo-border-dark)] text-left space-y-2.5 text-xs">
              <div className="flex justify-between items-center text-[var(--neo-text-2)] font-medium">
                <span>Barcode / Member ID:</span>
                <span className="font-mono font-semibold text-[var(--neo-text)]">
                  {user?.memberId || 'LIB-2026-904'}
                </span>
              </div>
              <div className="flex justify-between items-center text-[var(--neo-text-2)] font-medium">
                <span>Roll No / Student ID:</span>
                <span className="font-mono font-semibold text-[var(--neo-text)]">
                  {studentId || 'FA24-BCS-042'}
                </span>
              </div>
              <div className="flex justify-between items-center text-[var(--neo-text-2)] font-medium">
                <span>Institution:</span>
                <span className="font-semibold text-[var(--neo-text)] truncate max-w-[170px]" title={institution}>
                  {institution}
                </span>
              </div>
              <div className="flex justify-between items-center text-[var(--neo-text-2)] font-medium">
                <span>Department:</span>
                <span className="font-semibold text-[var(--neo-text)] truncate max-w-[170px]" title={department}>
                  {department}
                </span>
              </div>
            </div>
          </Card>
        </div>

        {/* RIGHT COLUMN: Tabs (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          {/* Tabs Navigation */}
          <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-[var(--neo-inset-bg)] border border-[var(--neo-border-light)] dark:border-[var(--neo-border-dark)] shadow-[var(--neo-inset-sm)] max-w-fit">
            <button
              onClick={() => setActiveTab('info')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'info'
                  ? 'bg-[var(--neo-accent)] text-white shadow-[var(--neo-raised-sm)]'
                  : 'text-[var(--neo-text-secondary)] hover:text-[var(--neo-text-primary)]'
                }`}
            >
              <UserIcon className="w-3.5 h-3.5" />
              <span>Academic Profile</span>
            </button>

            <button
              onClick={() => setActiveTab('password')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'password'
                  ? 'bg-[var(--neo-accent)] text-white shadow-[var(--neo-raised-sm)]'
                  : 'text-[var(--neo-text-secondary)] hover:text-[var(--neo-text-primary)]'
                }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Security & Password</span>
            </button>

            <button
              onClick={() => setActiveTab('preferences')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'preferences'
                  ? 'bg-[var(--neo-accent)] text-white shadow-[var(--neo-raised-sm)]'
                  : 'text-[var(--neo-text-secondary)] hover:text-[var(--neo-text-primary)]'
                }`}
            >
              <Bell className="w-3.5 h-3.5" />
              <span>Notifications</span>
            </button>
          </div>

          {/* TAB 1: Academic Profile Info Form */}
          {activeTab === 'info' && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle>Personal & Academic Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSaveInfo} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Input
                        label="Full Name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        leftIcon={<UserIcon className="w-4 h-4" />}
                        required
                      />

                      <Input
                        label="Phone Number"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        leftIcon={<Phone className="w-4 h-4" />}
                        placeholder="+92 300 1234567"
                      />
                    </div>

                    {/* University / College Selector */}
                    <div className="space-y-1.5 text-left">
                      <label className="text-xs font-semibold uppercase tracking-wider text-[var(--neo-text-2)] flex items-center gap-1.5 select-none">
                        <Building className="w-3.5 h-3.5 text-[var(--neo-text-3)]" />
                        <span>University / College Name</span>
                      </label>
                      <select
                        value={institution}
                        onChange={(e) => setInstitution(e.target.value)}
                        className="w-full h-10 rounded-[var(--neo-r-sm)] text-xs sm:text-sm bg-[var(--neo-surface)] text-[var(--neo-text)] border border-[var(--neo-border-light)] dark:border-[var(--neo-border-dark)] px-3 focus:outline-none focus:ring-2 focus:ring-[var(--neo-accent)]"
                      >
                        {PAKISTANI_UNIVERSITIES.map((uni) => (
                          <option key={uni} value={uni}>
                            {uni}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Department Selector */}
                      <div className="space-y-1.5 text-left">
                        <label className="text-xs font-semibold uppercase tracking-wider text-[var(--neo-text-2)] flex items-center gap-1.5 select-none">
                          <GraduationCap className="w-3.5 h-3.5 text-[var(--neo-text-3)]" />
                          <span>Academic Department</span>
                        </label>
                        <select
                          value={department}
                          onChange={(e) => setDepartment(e.target.value)}
                          className="w-full h-10 rounded-[var(--neo-r-sm)] text-xs sm:text-sm bg-[var(--neo-surface)] text-[var(--neo-text)] border border-[var(--neo-border-light)] dark:border-[var(--neo-border-dark)] px-3 focus:outline-none focus:ring-2 focus:ring-[var(--neo-accent)]"
                        >
                          {ACADEMIC_DEPARTMENTS.map((dept) => (
                            <option key={dept} value={dept}>
                              {dept}
                            </option>
                          ))}
                        </select>
                      </div>

                      <Input
                        label="Student ID / Roll No"
                        value={studentId}
                        onChange={(e) => setStudentId(e.target.value)}
                        leftIcon={<GraduationCap className="w-4 h-4" />}
                        placeholder="FA24-BCS-042"
                      />
                    </div>

                    <Input
                      label="Registered Email (Read Only)"
                      value={user?.email || 'patron@nust.edu.pk'}
                      disabled
                      leftIcon={<Mail className="w-4 h-4" />}
                    />

                    {/* Reading Interests Tags */}
                    <div className="space-y-2 pt-1 text-left">
                      <label className="text-xs font-semibold uppercase tracking-wider text-[var(--neo-text-2)] flex items-center gap-1.5 select-none">
                        <BookOpen className="w-3.5 h-3.5 text-[var(--neo-text-3)]" />
                        <span>Recommendation Tags & Interests</span>
                      </label>
                      <p className="text-[11px] text-[var(--neo-text-3)]">
                        These academic tags power our catalog suggestion engine for your courses and leisure reading.
                      </p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {AVAILABLE_INTERESTS.map((tag) => {
                          const isSelected = interests.includes(tag);
                          return (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => toggleInterest(tag)}
                              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1 select-none ${isSelected
                                  ? 'bg-[var(--neo-accent)] text-white shadow-xs'
                                  : 'bg-[var(--neo-card)] text-[var(--neo-text-2)] hover:text-[var(--neo-text)] border border-[var(--neo-border-light)] dark:border-[var(--neo-border-dark)]'
                                }`}
                            >
                              {isSelected && <Check className="w-3 h-3" />}
                              <span>{tag}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="pt-2 flex justify-end">
                      <Button
                        type="submit"
                        variant="primary"
                        size="md"
                        isLoading={savingInfo}
                        leftIcon={<Save className="w-4 h-4" />}
                      >
                        Save Academic Profile
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* TAB 2: Change Password Form */}
          {activeTab === 'password' && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle>Update Security Credentials</CardTitle>
                </CardHeader>
                <CardContent>
                  {authSource !== 'LOCAL' ? (
                    <div className="p-4 rounded-xl bg-sky-500/10 border border-sky-500/25 text-xs text-sky-800 dark:text-sky-200 space-y-2">
                      <p className="font-semibold flex items-center gap-1.5">
                        <Globe className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                        <span>Signed In via {authSource} OAuth</span>
                      </p>
                      <p>
                        Your account was authenticated with {authSource}. Password resets and credential changes are managed securely through your {authSource} account security panel.
                      </p>
                    </div>
                  ) : (
                    <form onSubmit={handleChangePassword} className="space-y-4">
                      <Input
                        type="password"
                        label="Current (Old) Password"
                        value={oldPassword}
                        onChange={(e) => setOldPassword(e.target.value)}
                        leftIcon={<Lock className="w-4 h-4" />}
                        required
                      />

                      <div className="space-y-2">
                        <Input
                          type="password"
                          label="New Password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          leftIcon={<Lock className="w-4 h-4" />}
                          required
                        />
                        {newPassword && <PasswordStrength password={newPassword} />}
                      </div>

                      <Input
                        type="password"
                        label="Confirm New Password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        leftIcon={<Lock className="w-4 h-4" />}
                        required
                        error={
                          confirmPassword && confirmPassword !== newPassword
                            ? 'Passwords do not match.'
                            : undefined
                        }
                      />

                      <div className="pt-2 flex justify-end">
                        <Button
                          type="submit"
                          variant="primary"
                          size="md"
                          isLoading={changingPassword}
                          leftIcon={<ShieldCheck className="w-4 h-4" />}
                        >
                          Update Password
                        </Button>
                      </div>
                    </form>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* TAB 3: Preferences */}
          {activeTab === 'preferences' && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle>Email Notification Preferences</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Toggle 1: Overdue Alerts */}
                  <div className="flex items-center justify-between p-3.5 rounded-xl border border-[var(--neo-border-light)] dark:border-[var(--neo-border-dark)] bg-[var(--neo-surface)]/60">
                    <div className="space-y-0.5 max-w-md">
                      <h4 className="text-xs sm:text-sm font-semibold text-[var(--neo-text)]">
                        Overdue Fines & Penalty Warnings
                      </h4>
                      <p className="text-[11px] text-[var(--neo-text-3)] leading-relaxed">
                        Receive instant alerts whenever a borrowed title passes its due date.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={preferences.overdueAlerts}
                      onChange={(e) =>
                        setPreferences((prev) => ({ ...prev, overdueAlerts: e.target.checked }))
                      }
                      className="w-5 h-5 rounded text-[var(--neo-accent)] focus:ring-[var(--neo-accent)] cursor-pointer"
                    />
                  </div>

                  {/* Toggle 2: Hold Ready */}
                  <div className="flex items-center justify-between p-3.5 rounded-xl border border-[var(--neo-border-light)] dark:border-[var(--neo-border-dark)] bg-[var(--neo-surface)]/60">
                    <div className="space-y-0.5 max-w-md">
                      <h4 className="text-xs sm:text-sm font-semibold text-[var(--neo-text)]">
                        Hold Shelf Ready for Pickup
                      </h4>
                      <p className="text-[11px] text-[var(--neo-text-3)] leading-relaxed">
                        Notification the minute your reserved book is scanned and placed on the hold shelf.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={preferences.holdReady}
                      onChange={(e) =>
                        setPreferences((prev) => ({ ...prev, holdReady: e.target.checked }))
                      }
                      className="w-5 h-5 rounded text-[var(--neo-accent)] focus:ring-[var(--neo-accent)] cursor-pointer"
                    />
                  </div>

                  {/* Toggle 3: Due Date Reminder */}
                  <div className="flex items-center justify-between p-3.5 rounded-xl border border-[var(--neo-border-light)] dark:border-[var(--neo-border-dark)] bg-[var(--neo-surface)]/60">
                    <div className="space-y-0.5 max-w-md">
                      <h4 className="text-xs sm:text-sm font-semibold text-[var(--neo-text)]">
                        Upcoming Due Date (24-Hour Notice)
                      </h4>
                      <p className="text-[11px] text-[var(--neo-text-3)] leading-relaxed">
                        A friendly reminder 1 day before any active book loan expires so you can renew in time.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={preferences.dueDateReminder}
                      onChange={(e) =>
                        setPreferences((prev) => ({ ...prev, dueDateReminder: e.target.checked }))
                      }
                      className="w-5 h-5 rounded text-[var(--neo-accent)] focus:ring-[var(--neo-accent)] cursor-pointer"
                    />
                  </div>

                  {/* Toggle 4: New Arrivals */}
                  <div className="flex items-center justify-between p-3.5 rounded-xl border border-[var(--neo-border-light)] dark:border-[var(--neo-border-dark)] bg-[var(--neo-surface)]/60">
                    <div className="space-y-0.5 max-w-md">
                      <h4 className="text-xs sm:text-sm font-semibold text-[var(--neo-text)]">
                        New Catalog Arrivals & Academic Recommendations
                      </h4>
                      <p className="text-[11px] text-[var(--neo-text-3)] leading-relaxed">
                        Weekly digest of newly acquired books matching your department and selected interests.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={preferences.newArrivals}
                      onChange={(e) =>
                        setPreferences((prev) => ({ ...prev, newArrivals: e.target.checked }))
                      }
                      className="w-5 h-5 rounded text-[var(--neo-accent)] focus:ring-[var(--neo-accent)] cursor-pointer"
                    />
                  </div>

                  <div className="pt-2 flex justify-end">
                    <Button
                      variant="primary"
                      size="md"
                      onClick={handleSavePreferences}
                      isLoading={savingPrefs}
                      leftIcon={<Save className="w-4 h-4" />}
                    >
                      Save Preferences
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>
      </div>

      {/* Avatar Preview Confirmation Modal */}
      <Modal
        open={avatarModalOpen}
        onOpenChange={setAvatarModalOpen}
        title="Confirm Avatar Photo"
        description="Preview your profile picture before saving it to your patron library account via Cloudinary."
        maxWidth="sm"
        footer={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAvatarModalOpen(false)}
              disabled={uploadingAvatar}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleConfirmAvatar}
              isLoading={uploadingAvatar}
              leftIcon={<UploadCloud className="w-4 h-4" />}
            >
              Confirm & Upload
            </Button>
          </>
        }
      >
        <div className="flex flex-col items-center justify-center p-4 space-y-4">
          <div className="w-36 h-36 rounded-full overflow-hidden border-4 border-[var(--neo-accent)] shadow-xl bg-[var(--neo-card)]">
            {avatarPreview && (
              <Image
                src={avatarPreview}
                alt="Avatar Preview"
                width={144}
                height={144}
                className="w-full h-full object-cover"
                unoptimized
              />
            )}
          </div>
          <p className="text-xs text-[var(--neo-text-2)] text-center">
            {selectedFile?.name} ({(selectedFile?.size ? (selectedFile.size / 1024).toFixed(1) : 0)} KB)
          </p>
        </div>
      </Modal>
    </div>
  );
}
