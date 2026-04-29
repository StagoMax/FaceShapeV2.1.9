'use client';

const EDITOR_DRAFT_KEY = 'miri_web_editor_draft_image_v2';

export type EditorDraftState = {
  version: 1;
  currentImageDataUrl: string;
  originalImageDataUrl: string;
};

export const editorDraft = {
  save(draft: Omit<EditorDraftState, 'version'>) {
    if (typeof window === 'undefined') {
      return;
    }
    const payload: EditorDraftState = {
      version: 1,
      currentImageDataUrl: draft.currentImageDataUrl,
      originalImageDataUrl: draft.originalImageDataUrl,
    };
    window.sessionStorage.setItem(EDITOR_DRAFT_KEY, JSON.stringify(payload));
  },
  load(): Omit<EditorDraftState, 'version'> | null {
    if (typeof window === 'undefined') {
      return null;
    }
    const raw = window.sessionStorage.getItem(EDITOR_DRAFT_KEY);
    if (!raw) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw) as EditorDraftState | null;
      if (!parsed?.currentImageDataUrl) {
        return null;
      }
      return {
        currentImageDataUrl: parsed.currentImageDataUrl,
        originalImageDataUrl: parsed.originalImageDataUrl ?? parsed.currentImageDataUrl,
      };
    } catch {
      return {
        currentImageDataUrl: raw,
        originalImageDataUrl: raw,
      };
    }
  },
  clear() {
    if (typeof window === 'undefined') {
      return;
    }
    window.sessionStorage.removeItem(EDITOR_DRAFT_KEY);
  },
};
