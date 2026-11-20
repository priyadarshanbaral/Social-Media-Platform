import { Image as ImageIcon, X } from 'lucide-react';
import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import type { UserSummary } from '../types/social.ts';
import { Avatar } from './Avatar.tsx';

interface PostComposerProps {
  currentUser: UserSummary | null;
  onPublish: (payload: { content: string; imageUrl?: string; imageAlt?: string }) => Promise<void>;
  onRequireAuth: () => void;
  composerRef?: React.RefObject<HTMLTextAreaElement | null>;
}

const MAX_LENGTH = 500;

export function PostComposer({
  currentUser,
  onPublish,
  onRequireAuth,
  composerRef,
}: PostComposerProps) {
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageAlt, setImageAlt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file (PNG, JPG, WebP, or SVG).');
      return;
    }
    if (file.size > 2.5 * 1024 * 1024) {
      setError('Please select an image smaller than 2.5 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImageUrl(reader.result);
        setImageAlt(file.name.replace(/\.[^.]+$/, ''));
        setError('');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    const trimmed = content.trim();
    if (!trimmed && !imageUrl) {
      setError('Write a note or attach an image before publishing.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await onPublish({
        content: trimmed,
        imageUrl: imageUrl || undefined,
        imageAlt: imageAlt || undefined,
      });
      setContent('');
      setImageUrl('');
      setImageAlt('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to publish post.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between gap-4">
        <div>
          <p className="font-display font-semibold text-slate-900 text-base">
            Join the conversation
          </p>
          <p className="text-sm text-slate-600 mt-0.5">
            Sign in or switch to a community profile to publish posts, like updates, and reply.
          </p>
        </div>
        <button
          type="button"
          onClick={onRequireAuth}
          className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          Sign In
        </button>
      </div>
    );
  }

  const remaining = MAX_LENGTH - content.length;

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white border border-slate-200 rounded-xl p-5 transition-colors"
    >
      <div className="flex gap-3.5">
        <Avatar src={currentUser.avatarUrl} name={currentUser.displayName} size="md" />
        <div className="flex-1 min-w-0">
          <textarea
            ref={composerRef}
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              if (error) setError('');
            }}
            maxLength={MAX_LENGTH}
            rows={3}
            placeholder="What are you working on or thinking about today?"
            aria-label="Create a new post"
            className="w-full resize-none bg-transparent text-[15px] leading-relaxed text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />

          {imageUrl && (
            <div className="relative mt-3 rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
              <img
                src={imageUrl}
                alt={imageAlt || 'Attached post preview'}
                referrerPolicy="no-referrer"
                className="w-full max-h-72 object-cover"
              />
              <button
                type="button"
                onClick={() => {
                  setImageUrl('');
                  setImageAlt('');
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                aria-label="Remove attached image"
                className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-slate-900/80 hover:bg-slate-900 text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {error && (
            <p role="alert" className="mt-2 text-xs font-medium text-rose-600">
              {error}
            </p>
          )}

          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
                id="composer-image-input"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <ImageIcon className="w-4 h-4" />
                <span>Add Image</span>
              </button>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <span
                className={`text-xs font-mono tabular-nums ${
                  remaining < 40 ? 'text-amber-600 font-medium' : 'text-slate-400'
                }`}
              >
                {content.length}/{MAX_LENGTH}
              </span>
              <button
                type="submit"
                disabled={submitting || (!content.trim() && !imageUrl)}
                className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:cursor-not-allowed"
              >
                {submitting ? 'Publishing...' : 'Publish'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
