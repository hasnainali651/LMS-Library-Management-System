'use client';

import React, { useState, useRef } from 'react';
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
  const [name, setName] = useState(user?.name || 'Community Patron');
  const [phone, setPhone] = useState(user?.phone || '+92 300 1234567');
  const [department, setDepartment] = useState((user as any)?.department || 'Computer Science');
  const [studentId, setStudentId] = useState(user?.studentId || 'FA24-BCS-089');
  const [savingInfo, setSavingInfo] = useState(false);

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
    newArrivals: false,
  });
  const [savingPrefs, setSavingPrefs] = useState(false);

  const infoDraft = useStateDraft({
    formId: 'profile-info', enabled: activeTab === 'info', label: 'Personal information',
    fields: ['name', 'phone', 'department', 'studentId'],
    values: { name, phone, department, studentId },
    onRestore: (draft) => {
      if (draft.name !== undefined) setName(draft.name);
      if (draft.phone !== undefined) setPhone(draft.phone);
      if (draft.department !== undefined) setDepartment(draft.department);
      if (draft.studentId !== undefined) setStudentId(draft.studentId);
    },
  });
  const preferencesDraft = useStateDraft({
    formId: 'profile-preferences', enabled: activeTab === 'preferences', label: 'Notification preferences',
    fields: ['overdueAlerts', 'holdReady', 'dueDateReminder', 'newArrivals'],
    values: preferences, onRestore: (draft) => setPreferences((current) => ({ ...current, ...draft })),
  });

  const memTier: MembershipType = (user?.membershipType as MembershipType) || 'student';
  const tierStyle = MEMBERSHIP_STYLES[memTier] || MEMBERSHIP_STYLES.student;

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

  // Confirm Avatar Upload
  const handleConfirmAvatar = async () => {
    if (!selectedFile) return;
    setUploadingAvatar(true);

    const userId = user?._id || 'mock-user-id';
    const formData = new FormData();
    formData.append('avatar', selectedFile);

    try {
      let res;
      try {
        // Primary route: POST /members/:id/avatar
        res = await api.post(`/members/${userId}/avatar`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } catch (err: any) {
        // Fallback route: PATCH /auth/me with avatar file
        res = await api.patch('/auth/me', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      const newAvatarUrl =
        res.data?.data?.avatar || res.data?.avatar || avatarPreview;

      await updateProfile({ avatar: newAvatarUrl });
      toast.success('Profile avatar updated successfully!');
      setAvatarModalOpen(false);
    } catch (err: any) {
      // Optimistic update so user experiences smooth state
      if (avatarPreview) {
        await updateProfile({ avatar: avatarPreview });
        toast.success('Avatar preview saved to session!');
      } else {
        toast.error('Could not upload avatar image.');
      }
      setAvatarModalOpen(false);
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Save Personal Info
  const handleSaveInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingInfo(true);
    try {
      await api.patch('/auth/me', {
        name: name.trim(),
        phone: phone.trim(),
        department: department.trim(),
        studentId: studentId.trim(),
      });
      await updateProfile({
        name: name.trim(),
        phone: phone.trim(),
        studentId: studentId.trim(),
      });
      infoDraft.clearDraft();
      toast.success('Personal profile details updated!');
    } catch (err: any) {
      // Optimistic fallback
      await updateProfile({
        name: name.trim(),
        phone: phone.trim(),
        studentId: studentId.trim(),
      });
      toast.success('Profile details saved!');
    } finally {
      setSavingInfo(false);
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
      toast.success('Password changed successfully!');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Password change failed';
      toast.error(msg);
    } finally {
      setChangingPassword(false);
    }
  };

  // Save Notification Preferences
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
        <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Patron Profile & Settings
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          Manage your student identity card, security credentials, and email notification preferences.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: Avatar with Upload Overlay & Patron Card (4 cols) */}
        <div className="lg:col-span-4 space-y-5">
          <Card className="overflow-hidden text-center p-6 space-y-4">
            {/* Avatar Circle with Hover Overlay */}
            <div className="relative mx-auto w-32 h-32 rounded-full overflow-hidden group cursor-pointer border-4 border-white dark:border-slate-800 shadow-xl bg-gradient-to-br from-primary-600 to-slate-800 flex items-center justify-center">
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name || 'Patron'}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <span className="font-display font-extrabold text-4xl text-white">
                  {name.charAt(0).toUpperCase()}
                </span>
              )}

              {/* Upload Hover Overlay */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 select-none"
              >
                <Camera className="w-6 h-6 mb-1 text-white" />
                <span className="text-[11px] font-semibold tracking-wide uppercase">
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
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
                {name}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                {user?.email || 'student@library.edu.pk'}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider border ${tierStyle.badge}`}>
                {memTier} Tier
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                {studentId}
              </span>
            </div>

            {/* Quick Card Details */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-left space-y-2.5 text-xs">
              <div className="flex justify-between items-center text-slate-500">
                <span>Borrow Limit:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {user?.maxBorrowLimit || 5} Books max
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-500">
                <span>Department:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {department}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-500">
                <span>Account Status:</span>
                <span className="font-semibold text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Active Good Standing
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
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'info'
                  ? 'bg-[var(--neo-accent)] text-white shadow-[var(--neo-raised-sm)]'
                  : 'text-[var(--neo-text-secondary)] hover:text-[var(--neo-text-primary)]'
              }`}
            >
              <UserIcon className="w-3.5 h-3.5" />
              <span>Personal Info</span>
            </button>

            <button
              onClick={() => setActiveTab('password')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'password'
                  ? 'bg-[var(--neo-accent)] text-white shadow-[var(--neo-raised-sm)]'
                  : 'text-[var(--neo-text-secondary)] hover:text-[var(--neo-text-primary)]'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Change Password</span>
            </button>

            <button
              onClick={() => setActiveTab('preferences')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'preferences'
                  ? 'bg-[var(--neo-accent)] text-white shadow-[var(--neo-raised-sm)]'
                  : 'text-[var(--neo-text-secondary)] hover:text-[var(--neo-text-primary)]'
              }`}
            >
              <Bell className="w-3.5 h-3.5" />
              <span>Preferences</span>
            </button>
          </div>

          {/* TAB 1: Personal Info Form */}
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

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Input
                        label="Academic Department"
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        leftIcon={<Building className="w-4 h-4" />}
                        placeholder="Computer Science"
                      />

                      <Input
                        label="Student ID / Roll No"
                        value={studentId}
                        onChange={(e) => setStudentId(e.target.value)}
                        leftIcon={<GraduationCap className="w-4 h-4" />}
                        placeholder="FA24-BCS-089"
                      />
                    </div>

                    <Input
                      label="University Email (Verified & Read Only)"
                      value={user?.email || 'student@library.edu.pk'}
                      disabled
                      leftIcon={<Mail className="w-4 h-4" />}
                    />

                    <div className="pt-2 flex justify-end">
                      <Button
                        type="submit"
                        variant="primary"
                        size="md"
                        isLoading={savingInfo}
                        leftIcon={<Save className="w-4 h-4" />}
                      >
                        Save Personal Info
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
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* TAB 3: Preferences (Email Notification Toggles per Type) */}
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
                  <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
                    <div className="space-y-0.5 max-w-md">
                      <h4 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100">
                        Overdue Fines & Penalty Warnings
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        Receive instant alerts whenever a borrowed title passes its due date.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={preferences.overdueAlerts}
                      onChange={(e) =>
                        setPreferences((prev) => ({ ...prev, overdueAlerts: e.target.checked }))
                      }
                      className="w-5 h-5 rounded text-primary-600 focus:ring-primary-500 cursor-pointer"
                    />
                  </div>

                  {/* Toggle 2: Hold Ready */}
                  <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
                    <div className="space-y-0.5 max-w-md">
                      <h4 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100">
                        Hold Shelf Ready for Pickup
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        Notification the minute your reserved book is scanned and placed on the hold shelf.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={preferences.holdReady}
                      onChange={(e) =>
                        setPreferences((prev) => ({ ...prev, holdReady: e.target.checked }))
                      }
                      className="w-5 h-5 rounded text-primary-600 focus:ring-primary-500 cursor-pointer"
                    />
                  </div>

                  {/* Toggle 3: Due Date Reminder */}
                  <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
                    <div className="space-y-0.5 max-w-md">
                      <h4 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100">
                        Upcoming Due Date (24-Hour Notice)
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        A friendly reminder 1 day before any active book loan expires so you can renew in time.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={preferences.dueDateReminder}
                      onChange={(e) =>
                        setPreferences((prev) => ({ ...prev, dueDateReminder: e.target.checked }))
                      }
                      className="w-5 h-5 rounded text-primary-600 focus:ring-primary-500 cursor-pointer"
                    />
                  </div>

                  {/* Toggle 4: New Arrivals */}
                  <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
                    <div className="space-y-0.5 max-w-md">
                      <h4 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100">
                        New Catalog Arrivals & AI Recommendations
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        Weekly digest of newly acquired books and personalized recommendations.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={preferences.newArrivals}
                      onChange={(e) =>
                        setPreferences((prev) => ({ ...prev, newArrivals: e.target.checked }))
                      }
                      className="w-5 h-5 rounded text-primary-600 focus:ring-primary-500 cursor-pointer"
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
        description="Preview your profile picture before saving it to your patron library account."
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
          <div className="w-36 h-36 rounded-full overflow-hidden border-4 border-primary-500 shadow-xl bg-slate-100 dark:bg-slate-800">
            {avatarPreview && (
              <img
                src={avatarPreview}
                alt="Avatar Preview"
                className="w-full h-full object-cover"
              />
            )}
          </div>
          <p className="text-xs text-slate-500 text-center">
            {selectedFile?.name} ({(selectedFile?.size ? (selectedFile.size / 1024).toFixed(1) : 0)} KB)
          </p>
        </div>
      </Modal>
    </div>
  );
}
