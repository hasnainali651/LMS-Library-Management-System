'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useQuery } from '@tanstack/react-query';
import {
  User,
  Mail,
  Lock,
  Phone,
  GraduationCap,
  CheckCircle2,
  Inbox,
  ArrowRight,
  UserCheck,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PasswordStrength } from '@/components/ui/PasswordStrength';
import { useRegister } from '@/hooks/useAuth';
import { useFormDraft } from '@/hooks/useFormDraft';

const strongPasswordRegex =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^_\-])[A-Za-z\d@$!%*?&#^_\-]{8,}$/;

const registerSchema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters long'),
    email: z.string().email('Please enter a valid email address'),
    password: z
      .string()
      .regex(
        strongPasswordRegex,
        'Password must be at least 8 characters and include uppercase, lowercase, number, and special character'
      ),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
    phone: z.string().optional(),
    membershipType: z.enum(['student', 'faculty', 'staff', 'public']),
    studentId: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
  .refine(
    (data) => {
      if (data.membershipType === 'student') {
        return !!data.studentId && data.studentId.trim().length > 0;
      }
      return true;
    },
    {
      message: 'Student ID is required for student membership',
      path: ['studentId'],
    }
  );

type RegisterFormData = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
  const registerMutation = useRegister();

  // Fetch membership types from /api/v1/membership-types
  const { data: membershipTypesData, isLoading: isLoadingTypes } = useQuery({
    queryKey: ['membership-types'],
    queryFn: async () => {
      try {
        const res = await api.get('/membership-types');
        return res.data?.data || res.data;
      } catch (err) {
        return null;
      }
    },
    staleTime: 5 * 60 * 1000,
  });

  const availableTypes: { id: string; name: string; displayName: string }[] =
    Array.isArray(membershipTypesData) && membershipTypesData.length > 0
      ? membershipTypesData.map((t: any) => ({
          id: t.name || t.id,
          name: t.name,
          displayName: t.displayName || t.name,
        }))
      : [
          { id: 'student', name: 'student', displayName: 'Student Patron' },
          { id: 'faculty', name: 'faculty', displayName: 'Faculty / Educator' },
          { id: 'staff', name: 'staff', displayName: 'University Staff' },
          { id: 'public', name: 'public', displayName: 'General Public Resident' },
        ];

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    getValues,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      membershipType: 'student',
    },
  });

  const { clearDraft } = useFormDraft({
    formId: 'register', anonymous: true, enabled: !registeredEmail, label: 'Patron registration',
    fields: ['name', 'email', 'phone', 'membershipType', 'studentId'],
    watch, reset, getValues,
  });

  const watchedPassword = useWatch({ control, name: 'password' });
  const watchedMembershipType = useWatch({ control, name: 'membershipType' });

  const onSubmit = (data: RegisterFormData) => {
    registerMutation.mutate(
      {
        name: data.name,
        email: data.email,
        password: data.password,
        phone: data.phone,
        membershipType: data.membershipType,
        studentId: data.studentId,
      },
      {
        onSuccess: () => {
          clearDraft();
          setRegisteredEmail(data.email);
        },
      }
    );
  };

  // Success State: "Check your email to verify" Card (no redirect)
  if (registeredEmail) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="text-center py-4 space-y-5"
      >
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 mx-auto flex items-center justify-center shadow-lg shadow-emerald-950/40">
          <Inbox className="w-8 h-8 stroke-[1.8]" />
        </div>

        <div className="space-y-1.5">
          <h2 className="font-display text-2xl font-bold text-white">
            Check Your Email
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-sm mx-auto leading-relaxed">
            We sent a verification link to{' '}
            <strong className="text-white font-mono break-all">{registeredEmail}</strong>.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 text-xs text-slate-400 text-left space-y-2">
          <p className="flex items-center gap-2 text-slate-300 font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Next steps to activate your card:</span>
          </p>
          <ul className="list-disc list-inside space-y-1 pl-1">
            <li>Click the verification link sent to your inbox.</li>
            <li>Verification links remain valid for 24 hours.</li>
            <li>Once confirmed, you will receive your digital patron barcode.</li>
          </ul>
        </div>

        <div className="pt-2">
          <Link href="/login">
            <Button variant="secondary" size="md" className="w-full">
              Proceed to Sign In
            </Button>
          </Link>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-white">
          Create Patron Account
        </h2>
        <p className="text-xs sm:text-sm text-slate-400">
          Join City Library to borrow books, access research databases, and place holds
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Full Name */}
        <div>
          <Input
            label="Full Name"
            placeholder="Jane Doe"
            required
            leftIcon={<User className="w-4 h-4 text-slate-400" />}
            error={errors.name?.message}
            {...register('name')}
          />
        </div>

        {/* Email Address */}
        <div>
          <Input
            label="Email Address"
            type="email"
            placeholder="jane@citylibrary.org"
            required
            leftIcon={<Mail className="w-4 h-4 text-slate-400" />}
            error={errors.email?.message}
            {...register('email')}
          />
        </div>

        {/* Password */}
        <div className="space-y-2">
          <Input
            label="Password"
            type="password"
            placeholder="••••••••••••"
            required
            leftIcon={<Lock className="w-4 h-4 text-slate-400" />}
            error={errors.password?.message}
            {...register('password')}
          />
          <PasswordStrength password={watchedPassword} />
        </div>

        {/* Confirm Password */}
        <div>
          <Input
            label="Confirm Password"
            type="password"
            placeholder="••••••••••••"
            required
            leftIcon={<Lock className="w-4 h-4 text-slate-400" />}
            error={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />
        </div>

        {/* Phone Number */}
        <div>
          <Input
            label="Phone Number"
            type="tel"
            placeholder="+1 (555) 000-0000"
            leftIcon={<Phone className="w-4 h-4 text-slate-400" />}
            error={errors.phone?.message}
            {...register('phone')}
          />
        </div>

        {/* Membership Type Select */}
        <div className="w-full flex flex-col gap-1.5 text-left">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1 select-none">
            Membership Type <span className="text-rose-500 font-bold">*</span>
          </label>
          <select
            aria-label="Select membership type"
            className="w-full h-10 rounded-lg text-sm bg-slate-900 text-slate-100 border border-slate-700/80 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
            {...register('membershipType')}
          >
            {availableTypes.map((type) => (
              <option key={type.id} value={type.name}>
                {type.displayName}
              </option>
            ))}
          </select>
          {errors.membershipType?.message && (
            <p className="text-xs text-rose-500 font-medium">
              {errors.membershipType.message}
            </p>
          )}
        </div>

        {/* Conditional Student ID */}
        {watchedMembershipType === 'student' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Input
              label="Student ID / Matriculation Number"
              placeholder="STU-2026-9812"
              required
              leftIcon={<GraduationCap className="w-4 h-4 text-slate-400" />}
              error={errors.studentId?.message}
              {...register('studentId')}
            />
          </motion.div>
        )}

        <Button
          type="submit"
          variant="primary"
          size="md"
          isLoading={registerMutation.isPending}
          leftIcon={<UserCheck className="w-4 h-4" />}
          className="w-full mt-2"
        >
          Create Account
        </Button>
      </form>

      <div className="text-center pt-3 border-t border-slate-800/80 text-xs text-slate-400">
        Already registered with City Library?{' '}
        <Link href="/login" className="font-semibold text-accent-400 hover:text-accent-300 hover:underline">
          Sign in here
        </Link>
      </div>
    </div>
  );
}
