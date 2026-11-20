import { Upload, X } from 'lucide-react';
import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import type { UserSummary } from '../types/social.ts';
import { Avatar } from './Avatar.tsx';

interface EditProfileModalProps {
  user: UserSummary;
  open: boolean;
  onClose: () => void;
  onSave: (payload: {
    displayName: string;
    bio: string;
    location: string;
    website: string;
    avatarUrl: string;
    coverColor: string;
  }) => Promise<void>;
}

const COVER_SWATCHES = ['#1E3A8A', '#0F172A', '#334155', '#3F4F44', '#7C2D12', '#292524'];
const AVATAR_PRESETS = [
  '/media/avatar-elena.svg',
  '/media/avatar-marcus.svg',
  '/media/avatar-priya.svg',
  '/media/avatar-julian.svg',
  '/media/avatar-claire.svg',
];

export function EditProfileModal({ user, open, onClose, onSave }: EditProfileModalProps) {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [bio, setBio] = useState(user.bio);
  const [location, setLocation] = useState(user.location);
  const [website, setWebsite] = useState(user.website);
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl);
  const [coverColor, setCoverColor] = useState(user.coverColor || '#1E3A8A');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const handleAvatarUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please pick a valid image file.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Avatar image must be smaller than 2 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAvatarUrl(reader.result);
        setError('');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await onSave({
        displayName: displayName.trim(),
        bio: bio.trim(),
        location: location.trim(),
        website: website.trim(),
        avatarUrl,
        coverColor,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Edit profile"
      className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-xl w-full max-w-lg p-6 shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <h2 className="font-display font-bold text-lg text-slate-900">Edit Profile</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Avatar Selection */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-2">
              Profile Photo
            </label>
            <div className="flex items-center gap-4 flex-wrap">
              <Avatar src={avatarUrl} name={displayName} size="lg" />
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Photo</span>
              </button>
              <div className="flex items-center gap-1.5">
                {AVATAR_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setAvatarUrl(preset)}
                    className={`rounded-full p-0.5 border-2 transition-colors cursor-pointer ${
                      avatarUrl === preset ? 'border-blue-600' : 'border-transparent'
                    }`}
                  >
                    <img
                      src={preset}
                      alt="Preset avatar"
                      referrerPolicy="no-referrer"
                      className="w-7 h-7 rounded-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Cover Accent */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-2">
              Header Tone
            </label>
            <div className="flex items-center gap-2">
              {COVER_SWATCHES.map((swatch) => (
                <button
                  key={swatch}
                  type="button"
                  onClick={() => setCoverColor(swatch)}
                  aria-label={`Select header tone ${swatch}`}
                  style={{ backgroundColor: swatch }}
                  className={`w-7 h-7 rounded-full border-2 transition-transform cursor-pointer ${
                    coverColor === swatch
                      ? 'border-blue-500 scale-110'
                      : 'border-white ring-1 ring-slate-200'
                  }`}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Display Name
            </label>
            <input
              type="text"
              required
              minLength={2}
              maxLength={48}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Bio
            </label>
            <textarea
              rows={3}
              maxLength={220}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Location
              </label>
              <input
                type="text"
                maxLength={60}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="City, Country"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Website
              </label>
              <input
                type="text"
                maxLength={80}
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="yourdomain.com"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
              />
            </div>
          </div>

          {error && (
            <p role="alert" className="text-xs font-medium text-rose-600">
              {error}
            </p>
          )}

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors cursor-pointer"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
