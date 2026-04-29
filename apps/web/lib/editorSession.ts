'use client';

import type { EditorTool } from '@/store/slices/editorSlice';

const EDITOR_SESSION_KEY = 'miri_web_editor_session_v1';
const FLOAT32_CHUNK_SIZE = 0x8000;

export type EditorDisplacementSnapshot = {
  cols: number;
  rows: number;
  deformX: Float32Array;
  deformY: Float32Array;
};

export type EditorSessionState = {
  originalImageDataUrl?: string | null;
  sourceImageDataUrl: string;
  outputImageDataUrl?: string | null;
  tool: EditorTool;
  brushSize: number;
  strength: number;
  displacement: EditorDisplacementSnapshot | null;
};

type StoredEditorSessionState = {
  version: 1 | 2;
  originalImageDataUrl?: string | null;
  sourceImageDataUrl: string;
  outputImageDataUrl?: string | null;
  tool: EditorTool;
  brushSize: number;
  strength: number;
  displacement: {
    cols: number;
    rows: number;
    deformX: string;
    deformY: string;
  } | null;
};

const float32ToBase64 = (values: Float32Array) => {
  const bytes = new Uint8Array(values.buffer, values.byteOffset, values.byteLength);
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += FLOAT32_CHUNK_SIZE) {
    const chunk = bytes.subarray(offset, offset + FLOAT32_CHUNK_SIZE);
    binary += String.fromCharCode(...chunk);
  }
  return window.btoa(binary);
};

const base64ToFloat32 = (encoded: string) => {
  const binary = window.atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  if (bytes.byteLength % 4 !== 0) {
    return null;
  }
  return new Float32Array(bytes.buffer.slice(0));
};

const encodeDisplacement = (snapshot: EditorDisplacementSnapshot | null) => {
  if (!snapshot) {
    return null;
  }
  return {
    cols: snapshot.cols,
    rows: snapshot.rows,
    deformX: float32ToBase64(snapshot.deformX),
    deformY: float32ToBase64(snapshot.deformY),
  };
};

const decodeDisplacement = (
  snapshot: StoredEditorSessionState['displacement']
): EditorDisplacementSnapshot | null => {
  if (!snapshot) {
    return null;
  }
  const deformX = base64ToFloat32(snapshot.deformX);
  const deformY = base64ToFloat32(snapshot.deformY);
  if (!deformX || !deformY) {
    return null;
  }
  const expectedLength = snapshot.cols * snapshot.rows;
  if (deformX.length !== expectedLength || deformY.length !== expectedLength) {
    return null;
  }
  return {
    cols: snapshot.cols,
    rows: snapshot.rows,
    deformX,
    deformY,
  };
};

export const editorSession = {
  save(session: EditorSessionState) {
    if (typeof window === 'undefined') {
      return;
    }
    const payload: StoredEditorSessionState = {
      version: 2,
      originalImageDataUrl: session.originalImageDataUrl ?? session.sourceImageDataUrl,
      sourceImageDataUrl: session.sourceImageDataUrl,
      outputImageDataUrl: session.outputImageDataUrl ?? null,
      tool: session.tool,
      brushSize: session.brushSize,
      strength: session.strength,
      displacement: encodeDisplacement(session.displacement),
    };
    try {
      window.sessionStorage.setItem(EDITOR_SESSION_KEY, JSON.stringify(payload));
    } catch {
      // Ignore quota/storage failures and keep the editor usable.
    }
  },
  load(): EditorSessionState | null {
    if (typeof window === 'undefined') {
      return null;
    }
    try {
      const raw = window.sessionStorage.getItem(EDITOR_SESSION_KEY);
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw) as StoredEditorSessionState | null;
      if (!parsed || (parsed.version !== 1 && parsed.version !== 2) || !parsed.sourceImageDataUrl) {
        return null;
      }
      return {
        originalImageDataUrl: parsed.originalImageDataUrl ?? parsed.sourceImageDataUrl,
        sourceImageDataUrl: parsed.sourceImageDataUrl,
        outputImageDataUrl: parsed.outputImageDataUrl ?? null,
        tool: parsed.tool ?? 'push',
        brushSize: parsed.brushSize ?? 45,
        strength: parsed.strength ?? 1,
        displacement: decodeDisplacement(parsed.displacement),
      };
    } catch {
      return null;
    }
  },
  clear() {
    if (typeof window === 'undefined') {
      return;
    }
    window.sessionStorage.removeItem(EDITOR_SESSION_KEY);
  },
};
