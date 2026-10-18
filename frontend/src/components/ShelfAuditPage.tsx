'use client';

import React, { useState, useEffect } from 'react';
import {
  Camera,
  Upload,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  History,
  Sparkles,
  RefreshCw,
  Library,
  ArrowRight,
  ShieldCheck,
  Search,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { useStateDraft } from '@/hooks/useFormDraft';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import toast from 'react-hot-toast';

export interface MisplacedBook {
  title: string;
  authors?: string[];
  currentLocation?: string;
  correctLocation?: string;
  confidence?: number;
}

export interface MissingBook {
  title: string;
  expectedLocation?: string;
}

export interface ShelfAuditResult {
  _id?: string;
  shelfLocation: string;
  totalDetected?: number;
  detectedBooks?: Array<{ title: string; authors?: string[]; confidence?: number }>;
  correctBooks?: Array<{ title: string; authors?: string[] }>;
  misplacedBooks?: MisplacedBook[];
  missingBooks?: MissingBook[];
  auditTimestamp?: string;
  createdAt?: string;
  notes?: string;
}

export const ShelfAuditPage: React.FC = () => {
  const userId = useAuthStore((state) => state.user?._id);
  return <ShelfAuditContent key={userId} />;
};

const ShelfAuditContent: React.FC = () => {
  const [shelfLocation, setShelfLocation] = useState('CS-12-04');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<ShelfAuditResult | null>(null);
  const [history, setHistory] = useState<ShelfAuditResult[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const { clearDraft } = useStateDraft({
    formId: 'shelf-audit', label: 'Shelf audit location (select the photo again)',
    fields: ['shelfLocation'], values: { shelfLocation },
    onRestore: (draft) => {
      if (draft.shelfLocation !== undefined) setShelfLocation(draft.shelfLocation);
    },
  });

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      setLoadingHistory(true);
      const res = await api.get('/ai/audit-history');
      const docs = res.data?.data?.docs || res.data?.data || [];
      setHistory(Array.isArray(docs) ? docs : []);
    } catch {
      // History fallback
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setResult(null);
    }
  };

  const handleRunAudit = async () => {
    if (!selectedFile) {
      toast.error('Please select or capture a shelf photo first.');
      return;
    }
    if (!shelfLocation.trim()) {
      toast.error('Please enter the shelf location (e.g. CS-12-04).');
      return;
    }

    try {
      setAnalyzing(true);
      const formData = new FormData();
      formData.append('image', selectedFile);
      formData.append('shelfLocation', shelfLocation.trim().toUpperCase());

      const res = await api.post('/ai/shelf-audit', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      clearDraft();
      const auditData = res.data?.data || res.data;
      setResult(auditData);
      toast.success('Shelf audit completed successfully!');
      fetchHistory();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Shelf audit failed. Please try again.';
      toast.error(msg);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-7xl mx-auto">
      {/* Header without eyebrow */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[var(--neo-border-light)] dark:border-[var(--neo-border-dark)]">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--neo-text-primary)]">
              Shelf Audit & Inventory Alignment
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[var(--neo-inset-bg)] text-[var(--neo-accent)] shadow-[var(--neo-inset-sm)]">
              AI Vision
            </span>
          </div>
          <p className="text-sm text-[var(--neo-text-secondary)] mt-1.5 max-w-2xl">
            Upload shelf photographs to automatically recognize book spines, verify correct shelving orders, and flag misplaced or missing catalog titles in real time.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Upload / Scanner Controls */}
        <div className="lg:col-span-5 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Camera className="w-4 h-4 text-[var(--neo-accent)]" />
                Capture or Upload Shelf Photo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--neo-text-secondary)] mb-1.5">
                  Target Shelf Location
                </label>
                <div className="relative">
                  <Library className="w-4 h-4 text-[var(--neo-text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <Input
                    value={shelfLocation}
                    onChange={(e) => setShelfLocation(e.target.value)}
                    placeholder="e.g. CS-12-04 or HIST-03-A"
                    className="pl-10 font-mono text-sm"
                  />
                </div>
                <p className="text-[11px] text-[var(--neo-text-muted)] mt-1 font-medium">
                  Shelf section format: Zone-Bay-Tier (e.g. CS-12-04).
                </p>
              </div>

              {/* Upload Dropzone */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--neo-text-secondary)] mb-1.5">
                  Shelf Image (JPEG, PNG, WebP)
                </label>
                <label className="relative flex flex-col items-center justify-center p-6 border border-dashed border-[var(--neo-border-light)] dark:border-[var(--neo-border-dark)] hover:border-[var(--neo-accent)] rounded-2xl cursor-pointer bg-[var(--neo-inset-bg)] shadow-[var(--neo-inset)] transition-all group">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleFileChange}
                  />

                  {previewUrl ? (
                    <div className="relative w-full aspect-video rounded-xl overflow-hidden shadow-[var(--neo-raised-sm)] border border-[var(--neo-border-light)] dark:border-[var(--neo-border-dark)]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={previewUrl}
                        alt="Shelf preview"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="text-xs font-semibold text-white bg-black/70 px-3 py-1.5 rounded-xl backdrop-blur shadow-[var(--neo-raised-sm)]">
                          Change Image
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center text-center p-4">
                      <div className="w-12 h-12 rounded-2xl bg-[var(--neo-surface)] text-[var(--neo-accent)] flex items-center justify-center mb-3 shadow-[var(--neo-raised-sm)] border border-[var(--neo-border-light)] dark:border-[var(--neo-border-dark)] group-hover:scale-105 transition-transform">
                        <Upload className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-semibold text-[var(--neo-text-primary)]">
                        Select shelf photo to inspect
                      </p>
                      <p className="text-xs text-[var(--neo-text-muted)] mt-1">
                        High-resolution spine photos yield optimal OCR matching
                      </p>
                    </div>
                  )}
                </label>
              </div>

              <Button
                onClick={handleRunAudit}
                disabled={!selectedFile || analyzing}
                className="w-full"
                size="lg"
                leftIcon={analyzing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-amber-300" />}
              >
                {analyzing ? 'Analyzing Shelf Spines...' : 'Run Shelf Audit'}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Audit Results & Overview */}
        <div className="lg:col-span-7 space-y-6">
          <AnimatePresence mode="wait">
            {analyzing ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="rounded-2xl border border-[var(--neo-border-light)] dark:border-[var(--neo-border-dark)] bg-[var(--neo-card)] shadow-[var(--neo-raised)] p-8 text-center space-y-4"
              >
                <div className="w-16 h-16 rounded-2xl bg-[var(--neo-inset-bg)] text-[var(--neo-accent)] flex items-center justify-center mx-auto shadow-[var(--neo-inset-sm)] border border-[var(--neo-border-light)] dark:border-[var(--neo-border-dark)] animate-pulse">
                  <Sparkles className="w-8 h-8 text-amber-400" />
                </div>
                <h3 className="font-display text-lg font-bold text-[var(--neo-text-primary)]">
                  AI Analyzing Spines...
                </h3>
                <p className="text-xs text-[var(--neo-text-secondary)] max-w-md mx-auto">
                  Extracting book titles, authors, and classification stickers from shelf photograph and comparing against inventory database.
                </p>
                <div className="w-48 h-2 bg-[var(--neo-inset-bg)] shadow-[var(--neo-inset-sm)] rounded-full mx-auto overflow-hidden">
                  <div className="h-full bg-[var(--neo-accent)] rounded-full animate-progress" />
                </div>
              </motion.div>
            ) : result ? (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                {/* Result KPI Summary */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl border border-[var(--neo-border-light)] dark:border-[var(--neo-border-dark)] bg-[var(--neo-card)] shadow-[var(--neo-raised-sm)]">
                    <span className="text-[11px] font-semibold text-[var(--neo-text-muted)] block uppercase">
                      Detected
                    </span>
                    <span className="font-display text-2xl font-bold tabular-nums text-[var(--neo-text-primary)]">
                      {result.detectedBooks?.length ?? result.totalDetected ?? 0}
                    </span>
                  </div>
                  <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 shadow-[var(--neo-raised-sm)]">
                    <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 block uppercase">
                      Correct
                    </span>
                    <span className="font-display text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                      {result.correctBooks?.length ?? 0}
                    </span>
                  </div>
                  <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 shadow-[var(--neo-raised-sm)]">
                    <span className="text-[11px] font-semibold text-rose-700 dark:text-rose-300 block uppercase">
                      Misplaced
                    </span>
                    <span className="font-display text-2xl font-bold tabular-nums text-rose-700 dark:text-rose-300">
                      {result.misplacedBooks?.length ?? 0}
                    </span>
                  </div>
                </div>

                {/* Misplaced Books Alert List */}
                {result.misplacedBooks && result.misplacedBooks.length > 0 && (
                  <Card className="border-rose-500/30 bg-rose-500/5">
                    <CardHeader>
                      <CardTitle className="text-sm font-bold text-rose-700 dark:text-rose-300 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                        Misplaced Titles Requiring Reshelving ({result.misplacedBooks.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {result.misplacedBooks.map((item, idx) => (
                        <div
                          key={idx}
                          className="p-3.5 rounded-xl border border-[var(--neo-border-light)] dark:border-[var(--neo-border-dark)] bg-[var(--neo-surface)] shadow-[var(--neo-raised-sm)] flex items-start justify-between gap-4"
                        >
                          <div>
                            <h4 className="text-sm font-bold text-[var(--neo-text-primary)]">
                              {item.title}
                            </h4>
                            <p className="text-xs text-[var(--neo-text-secondary)]">
                              Found on: <span className="font-mono font-semibold text-rose-600 dark:text-rose-400">{item.currentLocation || shelfLocation}</span>
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-[11px] text-[var(--neo-text-muted)] block uppercase">Belongs at</span>
                            <span className="font-mono text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded-md border border-emerald-500/30">
                              {item.correctLocation || 'Main Stack'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Missing Titles */}
                {result.missingBooks && result.missingBooks.length > 0 && (
                  <Card className="border-amber-500/30 bg-amber-500/5">
                    <CardHeader>
                      <CardTitle className="text-sm font-bold text-amber-700 dark:text-amber-300 flex items-center gap-2">
                        <HelpCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        Expected Books Not Detected on Shelf ({result.missingBooks.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {result.missingBooks.map((item, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-xl border border-[var(--neo-border-light)] dark:border-[var(--neo-border-dark)] bg-[var(--neo-surface)] text-xs font-medium text-[var(--neo-text-primary)] flex items-center justify-between shadow-[var(--neo-raised-sm)]"
                        >
                          <span>{item.title}</span>
                          <span className="font-mono text-[11px] text-amber-600 dark:text-amber-400 font-bold">Expected: {item.expectedLocation || shelfLocation}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </motion.div>
            ) : (
              <div className="rounded-2xl border border-[var(--neo-border-light)] dark:border-[var(--neo-border-dark)] bg-[var(--neo-card)] shadow-[var(--neo-raised)] p-12 text-center">
                <div className="w-12 h-12 rounded-xl bg-[var(--neo-inset-bg)] text-[var(--neo-text-muted)] flex items-center justify-center mx-auto mb-3 shadow-[var(--neo-inset-sm)] border border-[var(--neo-border-light)] dark:border-[var(--neo-border-dark)]">
                  <ShieldCheck className="w-6 h-6 text-[var(--neo-accent)]" />
                </div>
                <h3 className="font-display text-base font-bold text-[var(--neo-text-primary)]">
                  Ready to Inspect Shelf
                </h3>
                <p className="text-xs text-[var(--neo-text-secondary)] max-w-sm mx-auto mt-1">
                  Upload a photo to see live detection results, shelf integrity scores, and reshelving instructions.
                </p>
              </div>
            )}
          </AnimatePresence>

          {/* Past Shelf Audits History */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <History className="w-4 h-4 text-[var(--neo-text-muted)]" />
                  Recent Audit Records
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={fetchHistory}
                  leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                  className="text-xs"
                >
                  Refresh
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingHistory ? (
                <div className="space-y-3">
                  <Skeleton className="h-12 w-full rounded-lg" />
                  <Skeleton className="h-12 w-full rounded-lg" />
                </div>
              ) : history.length === 0 ? (
                <p className="text-xs text-[var(--neo-text-muted)] text-center py-6">
                  No shelf audits recorded yet. Run your first audit above!
                </p>
              ) : (
                <div className="divide-y divide-[var(--neo-border-light)] dark:divide-[var(--neo-border-dark)] text-xs">
                  {history.slice(0, 5).map((item, idx) => (
                    <div key={idx} className="py-3 flex items-center justify-between">
                      <div>
                        <span className="font-mono font-bold text-[var(--neo-text-primary)] mr-2">
                          {item.shelfLocation}
                        </span>
                        <span className="text-[var(--neo-text-muted)]">
                          {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'Recent'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[var(--neo-text-secondary)]">
                          {item.misplacedBooks?.length || 0} misplaced
                        </span>
                        <Badge
                          status={(item.misplacedBooks?.length || 0) === 0 ? 'available' : 'overdue'}
                        >
                          {(item.misplacedBooks?.length || 0) === 0 ? 'Aligned' : 'Action Needed'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
