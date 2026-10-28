import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const CATEGORIES = [
  'Video Optimization Quality',
  '60fps & 120fps Fluidity',
  'Processing Speed & Stability',
  'HDR & Color Retention',
  'Audio & Dual-Track Cadence',
  'Feature Suggestion',
];

export const CreatorReviewModal = ({ isOpen, onClose, currentUserName, apiKey }) => {
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [message, setMessage] = useState('');
  const [name, setName] = useState(currentUserName || '');
  const [contact, setContact] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim()) {
      setError('Please share a few words about your experience.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      const headers = { 'content-type': 'application/json' };
      if (apiKey) headers['x-access-token'] = apiKey;

      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          rating,
          category,
          message: message.trim(),
          name: name.trim() || currentUserName || 'Creator',
          contact: contact.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Failed to submit feedback.');
      }

      setSubmitted(true);
    } catch (err) {
      setError(err.message || 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEmailDirectly = () => {
    const subject = encodeURIComponent(`[Obito Studio Review] ${rating}★ from ${name || 'Creator'} - ${category}`);
    const body = encodeURIComponent(
      `Creator Name: ${name || 'Creator'}\n` +
      `Rating: ${rating} / 5 Stars\n` +
      `Category: ${category}\n` +
      `Contact: ${contact || 'Not provided'}\n\n` +
      `Feedback & Satisfaction Review:\n${message}\n\n` +
      `-- Submitted via Obito Studio Portal`
    );
    window.location.href = `mailto:resume@willsonrai.com.np?subject=${subject}&body=${body}`;
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 16 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-lg rounded-2xl bg-[#0c0e16]/95 border border-white/15 p-5 sm:p-6 shadow-[0_24px_64px_rgba(0,0,0,0.8)] backdrop-blur-2xl text-white max-h-[92svh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 pb-4 border-b border-white/[0.08]">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-clash inframe-title font-medium text-base sm:text-lg text-white">
                  Creator Satisfaction Review
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-cyan-500/10 text-cyan-300 border border-cyan-500/25">
                  Direct Channel
                </span>
              </div>
              <p className="font-sans text-xs text-neutral-400 mt-1">
                Your direct feedback helps calibrate our 60fps container engine &amp; pipeline delivery.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="size-8 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 flex items-center justify-center text-neutral-400 hover:text-white transition-all cursor-pointer shrink-0"
              aria-label="Close review modal"
            >
              ✕
            </button>
          </div>

          {submitted ? (
            <div className="py-8 text-center space-y-4">
              <div className="size-14 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-2xl">
                ✓
              </div>
              <div className="space-y-1.5">
                <h3 className="font-clash inframe-title font-medium text-lg text-white">
                  Thank you for your feedback!
                </h3>
                <p className="font-sans text-xs text-neutral-400 max-w-sm mx-auto">
                  Your review has been securely saved and dropped directly to the studio engineering dashboard.
                </p>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={handleEmailDirectly}
                  className="w-full sm:w-auto px-4 py-2 rounded-lg text-xs font-medium bg-white/[0.06] hover:bg-white/[0.12] border border-white/15 text-neutral-200 transition-all cursor-pointer"
                >
                  Send Copy to Email (resume@willsonrai.com.np)
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full sm:w-auto px-5 py-2 rounded-lg text-xs font-medium bg-cyan-500 text-black hover:bg-cyan-400 font-semibold transition-all cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="pt-4 space-y-4">
              {error && (
                <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-200 text-xs">
                  {error}
                </div>
              )}

              {/* Star Rating */}
              <div className="space-y-1.5">
                <label className="block font-sans text-xs font-medium text-neutral-300">
                  Satisfaction &amp; Quality Rating
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => {
                    const active = (hoverRating || rating) >= star;
                    return (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        className="text-2xl transition-transform hover:scale-110 cursor-pointer focus:outline-none"
                        aria-label={`${star} star`}
                      >
                        <span className={active ? 'text-amber-400' : 'text-neutral-600'}>
                          ★
                        </span>
                      </button>
                    );
                  })}
                  <span className="font-mono text-xs text-neutral-400 ml-2">
                    {rating === 5 ? 'Master Grade (5/5)' : rating === 4 ? 'Great (4/5)' : `${rating}/5 Stars`}
                  </span>
                </div>
              </div>

              {/* Feedback Category */}
              <div className="space-y-1.5">
                <label className="block font-sans text-xs font-medium text-neutral-300">
                  Topic / Pipeline Area
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full h-9 rounded-lg bg-white/[0.04] border border-white/10 px-3 text-xs text-white focus:outline-none focus:border-cyan-400/50"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat} className="bg-[#0b0c12] text-white">
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Detailed Message */}
              <div className="space-y-1.5">
                <label className="block font-sans text-xs font-medium text-neutral-300">
                  Your Experience &amp; Comments
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="How did your optimized video perform on TikTok? Any thoughts on 60fps motion, color vibrancy, or audio clarity?"
                  rows={4}
                  className="w-full rounded-lg bg-white/[0.04] border border-white/10 p-3 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-400/50 resize-none leading-relaxed"
                />
              </div>

              {/* Name & Contact Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-sans text-[11px] text-neutral-400">
                    Your Name / Creator Handle (optional)
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="@handle or Name"
                    className="w-full h-8 rounded-lg bg-white/[0.04] border border-white/10 px-3 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-400/50"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-sans text-[11px] text-neutral-400">
                    Email / WhatsApp for Reply (optional)
                  </label>
                  <input
                    type="text"
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    placeholder="email@domain.com or phone"
                    className="w-full h-8 rounded-lg bg-white/[0.04] border border-white/10 px-3 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-400/50"
                  />
                </div>
              </div>

              {/* Submit Actions */}
              <div className="pt-2 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleEmailDirectly}
                  className="text-[11px] font-sans text-neutral-400 hover:text-white underline cursor-pointer"
                >
                  Send via mail client instead
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="h-9 px-4 rounded-lg text-xs font-medium bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-neutral-300 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="h-9 px-5 rounded-lg text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-black transition-all cursor-pointer disabled:opacity-50"
                  >
                    {submitting ? 'Submitting…' : 'Submit Review'}
                  </button>
                </div>
              </div>
            </form>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
