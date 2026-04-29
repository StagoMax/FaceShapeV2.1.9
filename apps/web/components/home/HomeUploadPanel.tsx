'use client';

import { ChangeEvent, DragEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { trackEvent } from '@/lib/analytics';
import { useI18n } from '@/lib/i18n/provider';
import { translateRuntimeError } from '@/lib/i18n/runtime';
import { prepareImage } from '@/lib/image';
import { editorDraft } from '@/lib/editorDraft';

type HomeUploadPanelProps = {
  title: string;
  subtitle: string;
  dropHint: string;
  embedded?: boolean;
  privacyLabel?: string;
  termsLabel?: string;
};

export default function HomeUploadPanel({
  title,
  subtitle,
  dropHint,
  embedded = false,
  privacyLabel,
  termsLabel,
}: HomeUploadPanelProps) {
  const { t } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const startEditorWithFile = async (file: File | null | undefined, source: 'home_picker' | 'home_drop') => {
    if (!file) {
      return;
    }

    setError(null);
    setBusy(true);
    trackEvent('upload_started', { source });
    try {
      const prepared = await prepareImage(file);
      editorDraft.save({
        currentImageDataUrl: prepared.dataUrl,
        originalImageDataUrl: prepared.dataUrl,
      });
      trackEvent('upload_success', { source });
      router.push('/editor');
    } catch (e) {
      setError(translateRuntimeError(e instanceof Error ? e.message : t('errors.unknown'), t));
    } finally {
      setBusy(false);
    }
  };

  const onPickFile = async (event: ChangeEvent<HTMLInputElement>) => {
    await startEditorWithFile(event.target.files?.[0], 'home_picker');
    event.target.value = '';
  };

  const onDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    await startEditorWithFile(event.dataTransfer.files?.[0], 'home_drop');
  };

  const panelClass = embedded
    ? 'home-uploader-card home-uploader-embedded'
    : 'card home-card home-uploader-card';
  const showLegalLinks = Boolean(privacyLabel && termsLabel);

  return (
    <section className={panelClass} aria-labelledby="upload-entry-title">
      <div className="home-uploader-head">
        <h2 id="upload-entry-title" className="home-uploader-title">
          {title}
        </h2>
        <p className="home-uploader-subtitle">{subtitle}</p>
      </div>
      <div
        className={dragging ? 'home-drop-zone home-drop-zone-active' : 'home-drop-zone'}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <label className={busy ? 'home-plus-uploader home-plus-uploader-busy' : 'home-plus-uploader'}>
          <span className="home-plus-mark">{busy ? '...' : '+'}</span>
          <input type="file" accept="image/*" hidden onChange={onPickFile} disabled={busy} />
        </label>
        <p className="drop-hint">{dropHint}</p>
      </div>

      {error ? <p className="error-text">{error}</p> : null}

      {showLegalLinks ? (
        <div className="home-uploader-foot">
          <Link href="/privacy" className="home-uploader-legal-link">
            {privacyLabel}
          </Link>
          <span className="home-uploader-legal-divider" aria-hidden="true">
            /
          </span>
          <Link href="/terms" className="home-uploader-legal-link">
            {termsLabel}
          </Link>
        </div>
      ) : null}
    </section>
  );
}
