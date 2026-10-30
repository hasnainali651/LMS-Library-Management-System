'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { signIn } from 'next-auth/react';
import {
  User as UserIcon,
  Mail,
  Lock,
  Phone,
  GraduationCap,
  Building2,
  BookOpen,
  CheckCircle2,
  Inbox,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PasswordStrength } from '@/components/ui/PasswordStrength';
import { useAuthStore } from '@/store/authStore';

const strongPasswordRegex =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^_\-])[A-Za-z\d@$!%*?&#^_\-]{8,}$/;

const step1Schema = z
  .object({
    name: z.string().min(2, 'Full name must be at least 2 characters long'),
    email: z.string().email('Please enter a valid email address'),
    phone: z
      .string()
      .optional()
      .refine(
        (val) => !val || /^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/.test(val),
        'Please enter a valid phone number (e.g. +92 300 1234567)'
      ),
    password: z
      .string()
      .regex(
        strongPasswordRegex,
        'Password must be at least 8 characters and include uppercase, lowercase, number, and special character'
      ),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type Step1FormData = z.infer<typeof step1Schema>;

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

const GENRE_INTERESTS = [
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

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setUser, setAccessToken } = useAuthStore();

  const [step, setStep] = useState<number>(1);
  const [sessionId, setSessionId] = useState<string>('');
  const [authSource, setAuthSource] = useState<string>('LOCAL');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [completedEmail, setCompletedEmail] = useState<string | null>(null);
  const [isStaffPending, setIsStaffPending] = useState<boolean>(false);

  // Step 2 Form States
  const [patronType, setPatronType] = useState<'student' | 'faculty' | 'staff' | 'public'>('student');
  const [institution, setInstitution] = useState<string>('National University of Sciences & Technology (NUST)');
  const [department, setDepartment] = useState<string>('Computer Science & Information Technology');
  const [studentId, setStudentId] = useState<string>('');

  // Step 3 Form States
  const [selectedInterests, setSelectedInterests] = useState<string[]>([
    'Artificial Intelligence & Machine Learning',
    'Software Architecture & System Design',
  ]);

  // Step 1 Form
  const {
    register: registerStep1,
    handleSubmit: handleStep1Submit,
    control: step1Control,
    formState: { errors: step1Errors },
  } = useForm<Step1FormData>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
    },
  });

  const watchedPassword = useWatch({ control: step1Control, name: 'password' });

  // Handle URL query parameters (e.g. from OAuth redirect)
  useEffect(() => {
    const urlSessionId = searchParams.get('sessionId');
    const urlStep = searchParams.get('step');
    const urlSource = searchParams.get('source');

    if (urlSessionId) {
      setSessionId(urlSessionId);
      if (urlStep) setStep(Number(urlStep));
      if (urlSource) setAuthSource(urlSource);
    }
  }, [searchParams]);

  // Step 1 Submit: Starts Redis session
  const onStep1Submit = async (data: Step1FormData) => {
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const res = await api.post('/auth/onboarding/start', {
        name: data.name,
        email: data.email,
        phone: data.phone,
        password: data.password,
        source: 'LOCAL',
      });

      const resData = res.data?.data || res.data;
      setSessionId(resData.sessionId);
      setAuthSource('LOCAL');
      setStep(2);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to initialize registration.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 2 Submit: Saves Patron Classification & Academic info to Redis
  const onStep2Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (patronType === 'student' && !studentId.trim()) {
      setErrorMessage('Please provide your Student ID or Roll Number (e.g. FA24-BCS-042).');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.patch('/auth/onboarding/step', {
        sessionId,
        step: 2,
        data: {
          patronType,
          institution,
          department,
          studentId: studentId.trim(),
        },
      });

      setStep(3);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to update academic profile.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 3 Submit: Completes onboarding, creates MongoDB user, clears Redis session
  const onStep3Submit = async () => {
    setErrorMessage(null);

    if (selectedInterests.length < 1) {
      setErrorMessage('Please select at least one reading topic to personalize catalog recommendations.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.post('/auth/onboarding/complete', {
        sessionId,
        finalData: {
          institution,
          department,
          studentId: studentId.trim(),
          interests: selectedInterests,
          patronType,
        },
      });

      const resData = res.data?.data || res.data;
      const user = resData.user;
      const accessToken = resData.accessToken;

      if (user && accessToken) {
        setUser(user);
        setAccessToken(accessToken);
      }

      setIsStaffPending(Boolean(resData.isStaffPending));
      setCompletedEmail(user?.email || 'your registered email');

      // If user came via OAuth, their email is already verified; route to dashboard after brief toast
      if (authSource === 'GOOGLE' || authSource === 'FACEBOOK') {
        router.push('/dashboard');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to complete registration.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOAuthSignUp = async (provider: 'GOOGLE' | 'FACEBOOK') => {
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      // Trigger real NextAuth OAuth flow; /oauth-callback handles the backend call
      // and will redirect new users back to /register?step=2&source=PROVIDER
      await signIn(provider.toLowerCase(), {
        callbackUrl: '/oauth-callback',
        redirect: true,
      });
      // signIn with redirect:true navigates away; code below only runs on error
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred during third-party sign-up.');
      setIsSubmitting(false);
    }
  };

  const toggleInterest = (interest: string) => {
    setSelectedInterests((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest]
    );
  };

  // Completion State
  if (completedEmail) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="text-center py-4 space-y-5"
      >
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center shadow-md">
          <Inbox className="w-8 h-8 stroke-[1.8]" />
        </div>

        <div className="space-y-1.5">
          <h2 className="font-display text-2xl font-bold text-[var(--neo-text)]">
            Account Created Successfully!
          </h2>
          <p className="text-xs sm:text-sm text-[var(--neo-text-2)] max-w-sm mx-auto leading-relaxed">
            We dispatched a verification link to{' '}
            <strong className="text-[var(--neo-text)] font-mono break-all">{completedEmail}</strong>.
          </p>
        </div>

        {isStaffPending && (
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-700 dark:text-amber-300 text-left space-y-1">
            <p className="font-semibold flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>Staff Verification Required</span>
            </p>
            <p>
              Your account has been registered with staff privileges. An administrator must verify and approve
              your staff credentials before circulation management is enabled.
            </p>
          </div>
        )}

        <div className="p-4 rounded-xl bg-[var(--neo-inset-bg)] border border-[var(--neo-border-light)] dark:border-[var(--neo-border-dark)] text-xs text-[var(--neo-text-2)] text-left space-y-2">
          <p className="flex items-center gap-2 text-[var(--neo-text)] font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Next steps for full library card access:</span>
          </p>
          <ul className="list-disc list-inside space-y-1 pl-1">
            <li>Open the verification email and click the confirmation link.</li>
            <li>Email verification is required before borrowing books or placing holds.</li>
            <li>Your personalized catalog feed has been configured with your academic department.</li>
          </ul>
        </div>

        <div className="pt-2 flex flex-col gap-2">
          <Link href="/dashboard">
            <Button variant="primary" size="md" className="w-full">
              Proceed to Library Dashboard
            </Button>
          </Link>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Step Header */}
      <div className="text-center space-y-2">
        <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-[var(--neo-text)]">
          Join the Academic Library
        </h2>
        <p className="text-xs sm:text-sm text-[var(--neo-text-2)]">
          Step {step} of 3: {step === 1 && 'Account Credentials'}
          {step === 2 && 'Patron Classification & Department'}
          {step === 3 && 'Personalized Reading Interests'}
        </p>

        {/* Tactile Step Progress Bar */}
        <div className="flex items-center justify-center gap-2 pt-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                s === step
                  ? 'w-10 bg-[var(--neo-accent)]'
                  : s < step
                  ? 'w-6 bg-emerald-500'
                  : 'w-6 bg-[var(--neo-border-light)] dark:bg-[var(--neo-border-dark)]'
              }`}
            />
          ))}
        </div>
      </div>

      {errorMessage && (
        <div className="p-3 rounded-[var(--neo-r-sm)] bg-rose-500/10 border border-rose-500/25 text-xs text-rose-600 dark:text-rose-400 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* STEP 1: Basic Credentials */}
      {step === 1 && (
        <div className="space-y-4">
          {/* OAuth Buttons */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => handleOAuthSignUp('GOOGLE')}
              disabled={isSubmitting}
              className="w-full h-10 px-4 rounded-[var(--neo-r-md)] border border-[var(--neo-border-light)] dark:border-[var(--neo-border-dark)] bg-[var(--neo-card)] hover:bg-[var(--neo-surface)] text-[var(--neo-text)] font-semibold text-xs sm:text-sm transition-all flex items-center justify-center gap-3 [box-shadow:var(--neo-raised-sm)] active:translate-y-0.5"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Sign up with Google</span>
            </button>

            <button
              type="button"
              onClick={() => handleOAuthSignUp('FACEBOOK')}
              disabled={isSubmitting}
              className="w-full h-10 px-4 rounded-[var(--neo-r-md)] border border-[#1877F2]/30 bg-[#1877F2]/10 hover:bg-[#1877F2]/20 text-[#1877F2] dark:text-[#4294ff] font-semibold text-xs sm:text-sm transition-all flex items-center justify-center gap-3 [box-shadow:var(--neo-raised-sm)] active:translate-y-0.5"
            >
              <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
              <span>Sign up with Facebook</span>
            </button>
          </div>

          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[var(--neo-border-light)] dark:border-[var(--neo-border-dark)]" />
            </div>
            <span className="relative bg-[var(--neo-card)] px-3 text-[11px] uppercase tracking-wider font-semibold text-[var(--neo-text-3)]">
              Or register with email
            </span>
          </div>

          <form onSubmit={handleStep1Submit(onStep1Submit)} className="space-y-3.5">
            <div>
              <Input
                label="Full Name"
                placeholder="Muhammad Usman"
                required
                leftIcon={<UserIcon className="w-4 h-4 text-[var(--neo-text-3)]" />}
                error={step1Errors.name?.message}
                {...registerStep1('name')}
              />
            </div>

            <div>
              <Input
                label="Email Address"
                type="email"
                placeholder="usman.khan@nust.edu.pk"
                required
                leftIcon={<Mail className="w-4 h-4 text-[var(--neo-text-3)]" />}
                error={step1Errors.email?.message}
                {...registerStep1('email')}
              />
            </div>

            <div>
              <Input
                label="Mobile Number (Optional)"
                type="tel"
                placeholder="+92 300 1234567"
                leftIcon={<Phone className="w-4 h-4 text-[var(--neo-text-3)]" />}
                error={step1Errors.phone?.message}
                {...registerStep1('phone')}
              />
            </div>

            <div className="space-y-1.5">
              <Input
                label="Password"
                type="password"
                placeholder="••••••••••••"
                required
                leftIcon={<Lock className="w-4 h-4 text-[var(--neo-text-3)]" />}
                error={step1Errors.password?.message}
                {...registerStep1('password')}
              />
              <PasswordStrength password={watchedPassword} />
            </div>

            <div>
              <Input
                label="Confirm Password"
                type="password"
                placeholder="••••••••••••"
                required
                leftIcon={<Lock className="w-4 h-4 text-[var(--neo-text-3)]" />}
                error={step1Errors.confirmPassword?.message}
                {...registerStep1('confirmPassword')}
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isSubmitting}
              rightIcon={<ArrowRight className="w-4 h-4" />}
              className="w-full mt-3"
            >
              Continue to Academic Details
            </Button>
          </form>
        </div>
      )}

      {/* STEP 2: Academic & Patron Details */}
      {step === 2 && (
        <form onSubmit={onStep2Submit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-[var(--neo-text-2)] select-none">
              Patron Classification <span className="text-[var(--neo-danger)]">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'student', label: '🎓 Student Scholar' },
                { id: 'faculty', label: '🏛️ Faculty / Educator' },
                { id: 'staff', label: '📚 Librarian / Staff' },
                { id: 'public', label: '👥 General Resident' },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setPatronType(item.id as any)}
                  className={`p-2.5 rounded-[var(--neo-r-sm)] border text-left text-xs font-bold transition-all ${
                    patronType === item.id
                      ? 'border-[var(--neo-accent)] bg-[var(--neo-accent)]/10 text-[var(--neo-accent)] [box-shadow:var(--neo-raised-sm)]'
                      : 'border-[var(--neo-border-light)] dark:border-[var(--neo-border-dark)] text-[var(--neo-text-2)] hover:text-[var(--neo-text)]'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            {patronType === 'staff' && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                Note: Librarian & staff accounts require verification by an administrator before circulation privileges are active.
              </p>
            )}
          </div>

          {/* University / College */}
          <div className="space-y-1.5 text-left">
            <label className="text-xs font-semibold uppercase tracking-wider text-[var(--neo-text-2)] select-none flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-[var(--neo-text-3)]" />
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

          {/* Academic Department */}
          <div className="space-y-1.5 text-left">
            <label className="text-xs font-semibold uppercase tracking-wider text-[var(--neo-text-2)] select-none flex items-center gap-1.5">
              <GraduationCap className="w-3.5 h-3.5 text-[var(--neo-text-3)]" />
              <span>Academic Department (For Recommendations)</span>
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

          {/* Roll Number / Student ID */}
          <div>
            <Input
              label={
                patronType === 'staff'
                  ? 'Employee ID / Staff Number'
                  : patronType === 'faculty'
                  ? 'Faculty ID Number'
                  : 'Roll Number / Student ID'
              }
              placeholder={patronType === 'student' ? 'FA24-BCS-042' : 'EMP-2026-901'}
              required={patronType === 'student'}
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              leftIcon={<GraduationCap className="w-4 h-4 text-[var(--neo-text-3)]" />}
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={() => setStep(1)}
              leftIcon={<ArrowLeft className="w-4 h-4" />}
            >
              Back
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isSubmitting}
              rightIcon={<ArrowRight className="w-4 h-4" />}
              className="flex-1"
            >
              Continue to Interests
            </Button>
          </div>
        </form>
      )}

      {/* STEP 3: Reading Interests for Suggestions */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="space-y-1 text-left">
            <label className="text-xs font-semibold uppercase tracking-wider text-[var(--neo-text-2)] select-none flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-[var(--neo-text-3)]" />
              <span>Select Reading Interests</span>
            </label>
            <p className="text-[11px] text-[var(--neo-text-3)]">
              Our suggestion algorithm uses these tags to prioritize textbooks, research papers, and literary works in your library feed.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {GENRE_INTERESTS.map((genre) => {
              const isSelected = selectedInterests.includes(genre);
              return (
                <button
                  key={genre}
                  type="button"
                  onClick={() => toggleInterest(genre)}
                  className={`px-3 py-2 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 select-none ${
                    isSelected
                      ? 'bg-[var(--neo-accent)] text-white shadow-sm ring-2 ring-[var(--neo-accent)]/30'
                      : 'bg-[var(--neo-card)] text-[var(--neo-text-2)] hover:text-[var(--neo-text)] border border-[var(--neo-border-light)] dark:border-[var(--neo-border-dark)]'
                  }`}
                >
                  {isSelected && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                  <span>{genre}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 pt-4">
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={() => setStep(2)}
              leftIcon={<ArrowLeft className="w-4 h-4" />}
            >
              Back
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={onStep3Submit}
              isLoading={isSubmitting}
              leftIcon={<Sparkles className="w-4 h-4" />}
              className="flex-1"
            >
              Complete Library Registration
            </Button>
          </div>
        </div>
      )}

      {/* Footer Link */}
      <div className="text-center pt-3 border-t border-[var(--neo-shadow-dark)]/25 text-xs text-[var(--neo-text-3)]">
        Already have a library account?{' '}
        <Link href="/login" className="font-bold text-[var(--neo-accent)] hover:underline ml-1">
          Sign in here
        </Link>
      </div>
    </div>
  );
}
