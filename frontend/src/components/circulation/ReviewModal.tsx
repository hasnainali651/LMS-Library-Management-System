'use client';

import React, { useState } from 'react';
import { Star, MessageSquare } from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { useStateDraft } from '@/hooks/useFormDraft';
import { useAuthStore } from '@/store/authStore';

export interface ReviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookId: string;
  bookTitle: string;
  author?: string;
  coverImage?: string;
  onSuccess?: () => void;
}

export const ReviewModal: React.FC<ReviewModalProps> = (props) => {
  const userId = useAuthStore((state) => state.user?._id);
  return props.open ? <ReviewForm key={`${userId}:${props.bookId}`} {...props} /> : null;
};

const ReviewForm: React.FC<ReviewModalProps> = ({
  open,
  onOpenChange,
  bookId,
  bookTitle,
  author,
  coverImage,
  onSuccess,
}) => {
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [comment, setComment] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const { clearDraft } = useStateDraft({
    formId: 'book-review',
    entityId: bookId,
    enabled: open && !!bookId,
    label: `Review: ${bookTitle}`,
    fields: ['rating', 'comment'],
    values: { rating, comment },
    onRestore: (draft) => {
      if (draft.rating !== undefined) setRating(draft.rating);
      if (draft.comment !== undefined) setComment(draft.comment);
    },
  });

  const activeRating = hoverRating !== null ? hoverRating : rating;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rating) {
      toast.error('Please select a star rating (1-5).');
      return;
    }

    setSubmitting(true);
    try {
      await api.post(`/books/${bookId}/reviews`, {
        rating,
        comment: comment.trim(),
      });
      clearDraft();
      toast.success(`Review for "${bookTitle}" submitted!`);
      onSuccess?.();
      onOpenChange(false);
      setComment('');
      setRating(5);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Could not post review';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const ratingDescriptions: Record<number, string> = {
    1: 'Poor — Did not enjoy it',
    2: 'Fair — Had some flaws',
    3: 'Good — Worth reading',
    4: 'Very Good — Highly recommend',
    5: 'Masterpiece — An absolute favorite',
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Write Book Review"
      description="Share your insights and rating with community readers."
      maxWidth="md"
      footer={
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            isLoading={submitting}
            leftIcon={<MessageSquare className="w-4 h-4" />}
          >
            Submit Review
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Book Header */}
        <div className="flex items-center gap-3 p-3 rounded-[var(--neo-r-sm)] bg-[var(--neo-surface)] border border-[var(--neo-border-light)] [box-shadow:var(--neo-flat)]">
          {coverImage ? (
            <img src={coverImage} alt={bookTitle} className="w-10 h-14 object-cover rounded shadow-sm" />
          ) : (
            <div className="w-10 h-14 rounded bg-[var(--neo-card)] text-[var(--neo-accent)] flex items-center justify-center border border-[var(--neo-border-light)]">
              <Star className="w-4 h-4" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h4 className="font-bold text-sm text-[var(--neo-text)] truncate">{bookTitle}</h4>
            {author && <p className="text-xs text-[var(--neo-text-2)] truncate">by {author}</p>}
          </div>
        </div>

        {/* Rating Stars Pod */}
        <div className="p-4 rounded-[var(--neo-r-sm)] bg-[var(--neo-card)] [box-shadow:var(--neo-raised-sm)] border border-[var(--neo-border-light)] text-center space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-[var(--neo-text-2)] block">
            Your Rating
          </label>
          <div className="flex items-center justify-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(null)}
                className="neo-btn p-2 rounded-full text-amber-400 hover:scale-110 active:scale-95 transition-all"
                aria-label={`Rate ${star} star`}
              >
                <Star
                  className={`w-6 h-6 ${
                    star <= activeRating
                      ? 'fill-amber-400 stroke-amber-400'
                      : 'fill-transparent stroke-[var(--neo-text-3)]'
                  }`}
                />
              </button>
            ))}
          </div>
          <p className="text-xs font-medium text-[var(--neo-accent)]">
            {ratingDescriptions[activeRating] || 'Select your rating'}
          </p>
        </div>

        {/* Review Text Inset Well */}
        <div className="space-y-1.5 text-left">
          <label className="text-xs font-semibold uppercase tracking-wider text-[var(--neo-text-2)] block">
            Written Review (Optional)
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={4}
            placeholder="What did you think of the characters, pacing, or insights in this book?..."
            className="neo-input w-full p-3.5 text-sm resize-none rounded-[var(--neo-r-sm)] outline-none"
          />
        </div>
      </form>
    </Modal>
  );
};
