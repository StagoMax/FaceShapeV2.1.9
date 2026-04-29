'use client';

import { ChangeEvent, DragEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { CREDITS, LEGAL_VERSIONS } from '@miriai/config';
import LiquifyCanvas, { type LiquifyCanvasHandle } from '@/components/editor/LiquifyCanvas';
import { trackEvent } from '@/lib/analytics';
import { callSeedreamProxy, getClientCountryCode } from '@/lib/seedream';
import { useI18n } from '@/lib/i18n/provider';
import { translateRuntimeError } from '@/lib/i18n/runtime';
import { editorSession, type EditorDisplacementSnapshot } from '@/lib/editorSession';
import { prepareImage } from '@/lib/image';
import { buildConsentRecordNow, legalConsent } from '@/lib/legalConsent';
import { editorDraft } from '@/lib/editorDraft';
import { supabase } from '@/lib/supabase';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  selectAuthLoading,
  selectUser,
  setUserCredits,
  setUserProfilePartial,
} from '@/store/slices/authSlice';
import {
  selectEditorState,
  setBrushSize,
  setEditorError,
  setEditorGenerating,
  setEditorTool,
  setOriginalImageDataUrl,
  setOutputImageDataUrl,
  setSourceImageDataUrl,
} from '@/store/slices/editorSlice';

const MIN_BRUSH_SIZE = 20;
const MAX_BRUSH_SIZE = 180;
const DEFAULT_BRUSH_SIZE = 45;
const MIN_STRENGTH = 0.4;
const MAX_STRENGTH = 3;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3;
const WHEEL_ZOOM_STEP = 0.08;
const EDITOR_NEXT_QUERY = 'next=%2Feditor';
const ENABLE_AI_DEBUG_PANEL = false;
const SHARE_FILENAME_PREFIX = 'miri-before-after';

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const isHttpUrl = (value: string) => /^https?:\/\//i.test(value);

type GenerateDebugInfo = {
  requestedAt: string;
  requestImage: string;
  requestImageSource:
    | 'exportOpenAiImageDataUrl'
    | 'exportGenerateDataUrl'
    | 'outputImageDataUrl'
    | 'exportDataUrl';
  requestSize: string;
  serverPrompt?: string;
  modelAlias?: string;
  modelId?: string;
  responseImage?: string;
  responseAt?: string;
  errorMessage?: string;
};

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Failed to read blob'));
    reader.readAsDataURL(blob);
  });

const normalizeImageToDataUrl = async (input: string) => {
  if (!input || !isHttpUrl(input)) {
    return input;
  }
  const response = await fetch(input);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status}`);
  }
  return blobToDataUrl(await response.blob());
};

const loadImageElement = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load comparison image'));
    image.src = src;
  });

const buildComparisonBlob = async ({
  beforeDataUrl,
  afterDataUrl,
  beforeLabel,
  afterLabel,
}: {
  beforeDataUrl: string;
  afterDataUrl: string;
  beforeLabel: string;
  afterLabel: string;
}) => {
  const [beforeImage, afterImage] = await Promise.all([
    loadImageElement(beforeDataUrl),
    loadImageElement(afterDataUrl),
  ]);

  const panelWidth = Math.max(beforeImage.width, afterImage.width);
  const panelHeight = Math.max(beforeImage.height, afterImage.height);
  const panelGap = Math.max(24, Math.round(panelWidth * 0.04));
  const outerPadding = Math.max(30, Math.round(panelWidth * 0.05));
  const labelTopPadding = 70;

  const canvas = document.createElement('canvas');
  canvas.width = panelWidth * 2 + panelGap + outerPadding * 2;
  canvas.height = panelHeight + labelTopPadding + outerPadding;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Failed to create comparison canvas');
  }

  context.fillStyle = '#f6f3ed';
  context.fillRect(0, 0, canvas.width, canvas.height);

  const drawPanel = (image: HTMLImageElement, panelLeft: number) => {
    const panelTop = labelTopPadding;
    context.fillStyle = '#ffffff';
    context.fillRect(panelLeft, panelTop, panelWidth, panelHeight);

    const imageScale = Math.min(panelWidth / image.width, panelHeight / image.height);
    const drawWidth = image.width * imageScale;
    const drawHeight = image.height * imageScale;
    const drawX = panelLeft + (panelWidth - drawWidth) / 2;
    const drawY = panelTop + (panelHeight - drawHeight) / 2;
    context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
  };

  const beforeLeft = outerPadding;
  const afterLeft = outerPadding + panelWidth + panelGap;
  drawPanel(beforeImage, beforeLeft);
  drawPanel(afterImage, afterLeft);

  context.font = '700 36px "Space Grotesk", "Manrope", sans-serif';
  context.fillStyle = '#ef5f37';
  context.fillText(beforeLabel, beforeLeft, 48);
  context.fillText(afterLabel, afterLeft, 48);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }
        reject(new Error('Failed to export comparison image'));
      },
      'image/jpeg',
      0.92
    );
  });
};

export default function EditorPage() {
  const { t } = useI18n();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectUser);
  const authLoading = useAppSelector(selectAuthLoading);
  const editor = useAppSelector(selectEditorState);

  const canvasRef = useRef<LiquifyCanvasHandle | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const pendingGenerateRef = useRef(false);
  const fittedImageRef = useRef<string | null>(null);
  const firstLiquifyTrackedRef = useRef(false);

  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [showGenerateGateModal, setShowGenerateGateModal] = useState(false);
  const [generateGateReason, setGenerateGateReason] = useState<'login' | 'credits' | null>(null);
  const [zoom, setZoom] = useState(1);
  const [strength, setStrength] = useState(1);
  const [restoredDisplacement, setRestoredDisplacement] = useState<EditorDisplacementSnapshot | null>(null);
  const [generateDebug, setGenerateDebug] = useState<GenerateDebugInfo | null>(null);
  const [showDebugPanel, setShowDebugPanel] = useState(true);
  const [exportingComparison, setExportingComparison] = useState(false);

  const showOriginalPreview = useCallback(() => {
    setShowOriginal(true);
  }, []);

  const hideOriginalPreview = useCallback(() => {
    setShowOriginal(false);
  }, []);

  useEffect(() => {
    const body = document.body;
    body.classList.add('editor-page-lock');

    const nav = document.querySelector<HTMLElement>('.app-nav');
    const syncNavHeight = () => {
      const navHeight = nav?.getBoundingClientRect().height ?? 0;
      body.style.setProperty('--editor-nav-height', `${Math.round(navHeight)}px`);
    };

    syncNavHeight();
    window.addEventListener('resize', syncNavHeight);

    return () => {
      body.classList.remove('editor-page-lock');
      body.style.removeProperty('--editor-nav-height');
      window.removeEventListener('resize', syncNavHeight);
    };
  }, []);

  useEffect(() => {
    const session = editorSession.load();
    const sessionRestoreImage = session?.displacement
      ? session.sourceImageDataUrl
      : (session?.outputImageDataUrl ?? null);
    const sessionOriginalImage = session?.originalImageDataUrl ?? sessionRestoreImage;
    if (
      session &&
      sessionRestoreImage &&
      (!editor.sourceImageDataUrl ||
        editor.sourceImageDataUrl === session.sourceImageDataUrl ||
        editor.sourceImageDataUrl === sessionRestoreImage)
    ) {
      setRestoredDisplacement(session.displacement);
      dispatch(setEditorTool(session.tool));
      dispatch(setBrushSize(clamp(session.brushSize, MIN_BRUSH_SIZE, MAX_BRUSH_SIZE)));
      setStrength(clamp(session.strength, MIN_STRENGTH, MAX_STRENGTH));
      if (!editor.sourceImageDataUrl) {
        dispatch(setOriginalImageDataUrl(sessionOriginalImage));
        dispatch(setSourceImageDataUrl(sessionRestoreImage));
        dispatch(setOutputImageDataUrl(sessionRestoreImage));
      }
      return;
    }

    setRestoredDisplacement(null);
    if (!editor.sourceImageDataUrl) {
      const draft = editorDraft.load();
      if (draft) {
        dispatch(setOriginalImageDataUrl(draft.originalImageDataUrl));
        dispatch(setSourceImageDataUrl(draft.currentImageDataUrl));
        dispatch(setOutputImageDataUrl(draft.currentImageDataUrl));
      }
    }
  }, [dispatch, editor.sourceImageDataUrl]);

  const updateBrushSize = useCallback(
    (next: number) => {
      dispatch(setBrushSize(clamp(next, MIN_BRUSH_SIZE, MAX_BRUSH_SIZE)));
    },
    [dispatch]
  );

  const updateZoom = useCallback((next: number) => {
    setZoom(clamp(next, MIN_ZOOM, MAX_ZOOM));
  }, []);

  const updateStrength = useCallback((next: number) => {
    setStrength(clamp(next, MIN_STRENGTH, MAX_STRENGTH));
  }, []);

  const zoomByWheel = useCallback((delta: number) => {
    setZoom((current) => clamp(current + delta, MIN_ZOOM, MAX_ZOOM));
  }, []);

  const handleSuggestInitialZoom = useCallback(
    (next: number) => {
      const imageKey = editor.sourceImageDataUrl;
      if (!imageKey) {
        return;
      }
      if (fittedImageRef.current === imageKey) {
        return;
      }
      setZoom(clamp(next, MIN_ZOOM, MAX_ZOOM));
      fittedImageRef.current = imageKey;
    },
    [editor.sourceImageDataUrl]
  );

  useEffect(() => {
    if (!editor.sourceImageDataUrl) {
      fittedImageRef.current = null;
    }
  }, [editor.sourceImageDataUrl]);

  const persistEditorSession = useCallback(() => {
    const sourceImageDataUrl = editor.sourceImageDataUrl;
    const originalImageDataUrl = editor.originalImageDataUrl ?? sourceImageDataUrl;
    const displacement = canvasRef.current?.exportSession();
    const outputImageDataUrl = editor.outputImageDataUrl || canvasRef.current?.exportDataUrl() || sourceImageDataUrl;
    if (!sourceImageDataUrl || !displacement) {
      if (!sourceImageDataUrl) {
        editorSession.clear();
      }
      if (outputImageDataUrl) {
        editorDraft.save({
          currentImageDataUrl: outputImageDataUrl,
          originalImageDataUrl: originalImageDataUrl ?? outputImageDataUrl,
        });
      }
      return;
    }
    editorSession.save({
      originalImageDataUrl,
      sourceImageDataUrl,
      outputImageDataUrl,
      tool: editor.tool,
      brushSize: editor.brushSize,
      strength,
      displacement,
    });
  }, [editor.brushSize, editor.originalImageDataUrl, editor.outputImageDataUrl, editor.sourceImageDataUrl, editor.tool, strength]);

  const uploadFile = useCallback(
    async (file: File, source: 'picker' | 'drop') => {
      dispatch(setEditorError(null));
      trackEvent('upload_started', { source });
      try {
        const prepared = await prepareImage(file);
        dispatch(setBrushSize(DEFAULT_BRUSH_SIZE));
        setRestoredDisplacement(null);
        firstLiquifyTrackedRef.current = false;
        editorSession.clear();
        dispatch(setOriginalImageDataUrl(prepared.dataUrl));
        dispatch(setSourceImageDataUrl(prepared.dataUrl));
        dispatch(setOutputImageDataUrl(prepared.dataUrl));
        editorDraft.save({
          currentImageDataUrl: prepared.dataUrl,
          originalImageDataUrl: prepared.dataUrl,
        });
        trackEvent('upload_success', { source });
      } catch (error) {
        dispatch(setEditorError(translateRuntimeError(error instanceof Error ? error.message : t('editor.invalidImage'), t)));
      }
    },
    [dispatch, t]
  );

  const openFilePicker = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.value = '';
      inputRef.current.click();
    }
  }, []);

  const startNewSession = useCallback(() => {
    dispatch(setEditorError(null));
    dispatch(setBrushSize(DEFAULT_BRUSH_SIZE));
    dispatch(setOriginalImageDataUrl(null));
    dispatch(setSourceImageDataUrl(null));
    dispatch(setOutputImageDataUrl(null));
    setRestoredDisplacement(null);
    editorSession.clear();
    editorDraft.clear();
    setCanUndo(false);
    setCanRedo(false);
    setShowOriginal(false);
    firstLiquifyTrackedRef.current = false;
    fittedImageRef.current = null;
    window.requestAnimationFrame(() => {
      openFilePicker();
    });
  }, [dispatch, openFilePicker]);

  const onPickFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      await uploadFile(file, 'picker');
    }
    event.target.value = '';
  };

  const onDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      await uploadFile(file, 'drop');
    }
  };

  const openGenerateGate = useCallback(
    (reason: 'login' | 'credits') => {
      pendingGenerateRef.current = false;
      setShowConsentModal(false);
      persistEditorSession();
      setGenerateGateReason(reason);
      setShowGenerateGateModal(true);
      trackEvent('paywall_viewed', { reason });
    },
    [persistEditorSession]
  );

  const continueToLogin = useCallback(() => {
    pendingGenerateRef.current = false;
    setShowGenerateGateModal(false);
    setGenerateGateReason(null);
    persistEditorSession();
    router.push(`/login?${EDITOR_NEXT_QUERY}`);
  }, [persistEditorSession, router]);

  const continueToPurchase = useCallback(() => {
    pendingGenerateRef.current = false;
    setShowGenerateGateModal(false);
    setGenerateGateReason(null);
    persistEditorSession();
    trackEvent('purchase_started', { source: 'editor_paywall' });
    router.push(`/purchase?${EDITOR_NEXT_QUERY}`);
  }, [persistEditorSession, router]);

  const ensureGenerateCredits = useCallback(async () => {
    if (authLoading) {
      return false;
    }
    if (!user || user.is_anonymous) {
      openGenerateGate('login');
      return false;
    }
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      let accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        const refreshed = await supabase.auth.refreshSession();
        accessToken = refreshed.data.session?.access_token;
      }
      if (!accessToken) {
        openGenerateGate('login');
        return false;
      }
    } catch {
      openGenerateGate('login');
      return false;
    }
    if ((user.credits ?? 0) < CREDITS.COSTS.AI_EDIT) {
      openGenerateGate('credits');
      return false;
    }
    return true;
  }, [authLoading, openGenerateGate, user]);

  const hasServerConsent = useMemo(() => {
    if (!user?.ai_consent_at) {
      return false;
    }
    return (
      user.privacy_policy_version === LEGAL_VERSIONS.PRIVACY_POLICY &&
      user.terms_of_service_version === LEGAL_VERSIONS.TERMS_OF_SERVICE
    );
  }, [user?.ai_consent_at, user?.privacy_policy_version, user?.terms_of_service_version]);

  const ensureConsent = useCallback(async () => {
    if (legalConsent.hasValidConsent()) {
      return true;
    }
    if (hasServerConsent) {
      legalConsent.save(buildConsentRecordNow());
      return true;
    }
    return false;
  }, [hasServerConsent]);

  const performGenerate = useCallback(async () => {
    const countryCode = getClientCountryCode();
    const isUsOpenAiRegion = countryCode === 'US';
    const exportedOpenAiImageDataUrl = isUsOpenAiRegion
      ? canvasRef.current?.exportOpenAiImageDataUrl()
      : null;
    const exportedGenerateMaskDataUrl = isUsOpenAiRegion
      ? canvasRef.current?.exportGenerateMaskDataUrl()
      : null;
    const exportedGenerateDataUrl = !isUsOpenAiRegion
      ? canvasRef.current?.exportGenerateDataUrl()
      : null;
    const fallbackOutputDataUrl = editor.outputImageDataUrl;
    const fallbackCanvasDataUrl = canvasRef.current?.exportDataUrl();
    const imageForGenerate =
      exportedOpenAiImageDataUrl ||
      exportedGenerateDataUrl ||
      fallbackOutputDataUrl ||
      fallbackCanvasDataUrl;
    const requestImageSource: GenerateDebugInfo['requestImageSource'] = exportedGenerateDataUrl
      ? 'exportGenerateDataUrl'
      : exportedOpenAiImageDataUrl
        ? 'exportOpenAiImageDataUrl'
        : fallbackOutputDataUrl
          ? 'outputImageDataUrl'
          : 'exportDataUrl';
    if (!imageForGenerate) {
      dispatch(setEditorError(t('editor.noImage')));
      return;
    }
    if (!canvasRef.current?.hasLiquifyChanges()) {
      dispatch(setEditorError(t('editor.needLiquifyFirst')));
      return;
    }
    const canGenerate = await ensureGenerateCredits();
    if (!canGenerate) {
      return;
    }

    const accepted = await ensureConsent();
    if (!accepted) {
      pendingGenerateRef.current = true;
      setShowConsentModal(true);
      return;
    }

    dispatch(setEditorGenerating(true));
    dispatch(setEditorError(null));
    setGenerateDebug({
      requestedAt: new Date().toISOString(),
      requestImage: imageForGenerate,
      requestImageSource,
      requestSize: '2K',
    });
    try {
      const result = await callSeedreamProxy({
        image: imageForGenerate,
        mask: exportedOpenAiImageDataUrl ? (exportedGenerateMaskDataUrl ?? undefined) : undefined,
        size: '2K',
        includeDebug: true,
        countryCode: countryCode ?? undefined,
      });
      const normalized = await normalizeImageToDataUrl(result.image);
      const originalImageDataUrl =
        editor.originalImageDataUrl ??
        editor.sourceImageDataUrl ??
        normalized;
      setRestoredDisplacement(null);
      editorSession.clear();
      dispatch(setSourceImageDataUrl(normalized));
      dispatch(setOutputImageDataUrl(normalized));
      editorDraft.save({
        currentImageDataUrl: normalized,
        originalImageDataUrl,
      });
      setGenerateDebug((prev) =>
        prev
          ? {
              ...prev,
              responseImage: normalized,
              responseAt: new Date().toISOString(),
              serverPrompt: result.debug?.prompt,
              modelAlias: result.debug?.modelAlias ?? result.modelAlias,
              modelId: result.debug?.modelId,
            }
          : prev
      );
      if (typeof result.newCredits === 'number') {
        dispatch(setUserCredits(result.newCredits));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : t('errors.unknown');
      setGenerateDebug((prev) => (prev ? { ...prev, errorMessage: message } : prev));
      const errorCode = error instanceof Error ? (error as Error & { code?: string }).code : undefined;
      if (errorCode === 'insufficient_credits' || message.toLowerCase().includes('insufficient_credits')) {
        openGenerateGate('credits');
        return;
      }
      dispatch(setEditorError(translateRuntimeError(message, t) ?? t('errors.unknown')));
    } finally {
      dispatch(setEditorGenerating(false));
    }
  }, [
    dispatch,
    editor.originalImageDataUrl,
    editor.outputImageDataUrl,
    editor.sourceImageDataUrl,
    ensureGenerateCredits,
    ensureConsent,
    openGenerateGate,
    t,
  ]);

  const download = useCallback(() => {
    const dataUrl = canvasRef.current?.exportDataUrl() || editor.outputImageDataUrl;
    if (!dataUrl) {
      return;
    }
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `miri-${Date.now()}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [editor.outputImageDataUrl]);

  const exportComparison = useCallback(async () => {
    const beforeDataUrl = editor.originalImageDataUrl ?? editor.sourceImageDataUrl;
    const afterDataUrl = canvasRef.current?.exportDataUrl() || editor.outputImageDataUrl;

    if (!beforeDataUrl || !afterDataUrl) {
      dispatch(setEditorError(t('editor.comparisonUnavailable')));
      return;
    }

    setExportingComparison(true);
    dispatch(setEditorError(null));

    try {
      const blob = await buildComparisonBlob({
        beforeDataUrl,
        afterDataUrl,
        beforeLabel: t('editor.beforeLabel'),
        afterLabel: t('editor.afterLabel'),
      });
      const filename = `${SHARE_FILENAME_PREFIX}-${Date.now()}.jpg`;
      const file = new File([blob], filename, { type: 'image/jpeg' });

      if (
        typeof navigator !== 'undefined' &&
        navigator.share &&
        navigator.canShare &&
        navigator.canShare({ files: [file] })
      ) {
        try {
          await navigator.share({
            files: [file],
            title: t('common.appName'),
            text: t('editor.comparisonShareText'),
          });
          trackEvent('share_exported', { method: 'web_share' });
          return;
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') {
            return;
          }
        }
      }

      const blobUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = blobUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(blobUrl);
      trackEvent('share_exported', { method: 'download' });
    } catch (error) {
      const message = error instanceof Error ? error.message : t('errors.unknown');
      dispatch(setEditorError(translateRuntimeError(message, t) ?? t('errors.unknown')));
    } finally {
      setExportingComparison(false);
    }
  }, [dispatch, editor.originalImageDataUrl, editor.outputImageDataUrl, editor.sourceImageDataUrl, t]);

  const handleGenerateClick = useCallback(() => {
    trackEvent('generate_clicked');
    void performGenerate();
  }, [performGenerate]);

  const acceptConsent = async () => {
    const record = buildConsentRecordNow();
    legalConsent.save(record);

    try {
      if (user?.id) {
        const { data, error } = await supabase
          .from('user_profiles')
          .update({
            ai_consent_at: record.acceptedAt,
            privacy_policy_version: record.privacyVersion,
            terms_of_service_version: record.termsVersion,
          })
          .eq('id', user.id)
          .select()
          .single();

        if (!error && data) {
          dispatch(
            setUserProfilePartial({
              ai_consent_at: data.ai_consent_at,
              privacy_policy_version: data.privacy_policy_version,
              terms_of_service_version: data.terms_of_service_version,
            })
          );
        }
      }
    } catch {
      // keep local consent
    }

    setShowConsentModal(false);
    if (pendingGenerateRef.current) {
      pendingGenerateRef.current = false;
      await performGenerate();
    }
  };

  const isTextEntryTarget = useCallback((target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) {
      return false;
    }
    const editable = target.closest('input, textarea, [contenteditable="true"]');
    if (!editable) {
      return false;
    }
    if (editable instanceof HTMLInputElement) {
      const textLikeTypes = new Set([
        'text',
        'search',
        'email',
        'url',
        'tel',
        'password',
        'number',
      ]);
      return textLikeTypes.has(editable.type);
    }
    return true;
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTextEntryTarget(event.target)) {
        return;
      }

      const key = event.key.toLowerCase();
      const code = event.code;
      const withMeta = event.metaKey || event.ctrlKey;

      if (withMeta && (key === 'z' || code === 'KeyZ')) {
        event.preventDefault();
        if (event.shiftKey) {
          canvasRef.current?.redo();
        } else {
          canvasRef.current?.undo();
        }
        return;
      }

      if (withMeta && (key === 'y' || code === 'KeyY')) {
        event.preventDefault();
        canvasRef.current?.redo();
        return;
      }

      if (withMeta && (key === '0' || code === 'Digit0' || code === 'Numpad0')) {
        event.preventDefault();
        setZoom(1);
        return;
      }

      if (key === '0' || code === 'Digit0' || code === 'Numpad0') {
        event.preventDefault();
        showOriginalPreview();
        return;
      }

      if (key === '1' || code === 'Digit1' || code === 'Numpad1') {
        event.preventDefault();
        dispatch(setEditorTool('push'));
        return;
      }

      if (key === '2' || code === 'Digit2' || code === 'Numpad2') {
        event.preventDefault();
        dispatch(setEditorTool('restore'));
        return;
      }

      if (key === '[' || code === 'BracketLeft') {
        event.preventDefault();
        updateBrushSize(editor.brushSize - 6);
        return;
      }

      if (key === ']' || code === 'BracketRight') {
        event.preventDefault();
        updateBrushSize(editor.brushSize + 6);
        return;
      }

      if (key === ';' || code === 'Semicolon') {
        event.preventDefault();
        updateStrength(strength - 0.1);
        return;
      }

      if (key === "'" || code === 'Quote') {
        event.preventDefault();
        updateStrength(strength + 0.1);
        return;
      }

      if (key === 'n' || code === 'KeyN') {
        event.preventDefault();
        startNewSession();
        return;
      }

      if (key === '-' || key === '_' || code === 'Minus' || code === 'NumpadSubtract') {
        event.preventDefault();
        updateZoom(zoom - 0.1);
        return;
      }

      if (key === '=' || key === '+' || code === 'Equal' || code === 'NumpadAdd') {
        event.preventDefault();
        updateZoom(zoom + 0.1);
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (isTextEntryTarget(event.target)) {
        return;
      }

      if (event.key === '0' || event.code === 'Digit0' || event.code === 'Numpad0') {
        hideOriginalPreview();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [
    editor.brushSize,
    hideOriginalPreview,
    isTextEntryTarget,
    openFilePicker,
    showOriginalPreview,
    startNewSession,
    strength,
    updateBrushSize,
    updateStrength,
    updateZoom,
    zoom,
  ]);

  return (
    <main className="app-main editor-page">
      <div className="card editor-shell">
        <input ref={inputRef} type="file" accept="image/*" hidden onChange={onPickFile} />

        <div className="editor-headbar">
          <div className="editor-head-left">
            <button className="button button-secondary" onClick={startNewSession}>
              {t('editor.new')}
            </button>
          </div>
          <div className="editor-head-right">
            <button
              className="button button-secondary"
              onClick={download}
              disabled={!editor.outputImageDataUrl}
            >
              {t('editor.download')}
            </button>
            <button
              className="button button-secondary"
              onClick={() => void exportComparison()}
              disabled={editor.generating || exportingComparison || !editor.outputImageDataUrl}
            >
              {exportingComparison ? t('common.processing') : t('editor.shareComparison')}
            </button>
            <button
              className="button"
              onClick={handleGenerateClick}
              disabled={editor.generating || !editor.outputImageDataUrl}
            >
              {editor.generating ? t('editor.generating') : t('editor.generate')}
            </button>
          </div>
        </div>

        <div className="editor-workspace">
          <aside className="editor-tool-rail">
            <button
              className={editor.tool === 'push' ? 'tool-chip tool-chip-active' : 'tool-chip'}
              onClick={() => dispatch(setEditorTool('push'))}
              title="1"
            >
              {t('editor.toolPush')}
            </button>
            <button
              className={editor.tool === 'restore' ? 'tool-chip tool-chip-active' : 'tool-chip'}
              onClick={() => dispatch(setEditorTool('restore'))}
              title="2"
            >
              {t('editor.toolRestore')}
            </button>
            <button
              className="tool-icon-chip"
              onClick={() => canvasRef.current?.undo()}
              disabled={!canUndo}
              title="Ctrl/Cmd+Z"
              aria-label={t('editor.undo')}
            >
              <Image
                src="/editor/undo.png"
                width={19}
                height={19}
                alt=""
                aria-hidden
                className={canUndo ? 'tool-icon-image' : 'tool-icon-image tool-icon-image-disabled'}
              />
            </button>
            <button
              className="tool-icon-chip"
              onClick={() => canvasRef.current?.redo()}
              disabled={!canRedo}
              title="Shift+Ctrl/Cmd+Z"
              aria-label={t('editor.redo')}
            >
              <Image
                src="/editor/redo.png"
                width={19}
                height={19}
                alt=""
                aria-hidden
                className={canRedo ? 'tool-icon-image' : 'tool-icon-image tool-icon-image-disabled'}
              />
            </button>
          </aside>

          <section className="editor-stage">
            {!editor.sourceImageDataUrl ? (
              <div
                className={dragging ? 'drop-zone drop-zone-active' : 'drop-zone'}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
              >
                <p>{t('editor.uploadHint')}</p>
                <button className="button upload-button" onClick={openFilePicker}>
                  {t('editor.new')}
                </button>
              </div>
            ) : (
              <>
                <LiquifyCanvas
                  ref={canvasRef}
                  comparisonImageDataUrl={editor.originalImageDataUrl ?? editor.sourceImageDataUrl}
                  imageDataUrl={editor.sourceImageDataUrl}
                  tool={editor.tool}
                  brushSize={editor.brushSize}
                  strength={strength}
                  showOriginal={showOriginal}
                  initialDisplacement={restoredDisplacement}
                  zoom={zoom}
                  onWheelZoom={(direction) => zoomByWheel(direction * WHEEL_ZOOM_STEP)}
                  onSuggestInitialZoom={handleSuggestInitialZoom}
                  onHistoryChange={({ canUndo: nextUndo, canRedo: nextRedo }) => {
                    setCanUndo(nextUndo);
                    setCanRedo(nextRedo);
                  }}
                  onOutputChange={(dataUrl) => {
                    dispatch(setOutputImageDataUrl(dataUrl));
                    if (dataUrl) {
                      editorDraft.save({
                        currentImageDataUrl: dataUrl,
                        originalImageDataUrl:
                          editor.originalImageDataUrl ??
                          editor.sourceImageDataUrl ??
                          dataUrl,
                      });
                    }
                    const displacement = canvasRef.current?.exportSession();
                    if (editor.sourceImageDataUrl && displacement) {
                      editorSession.save({
                        originalImageDataUrl:
                          editor.originalImageDataUrl ??
                          editor.sourceImageDataUrl,
                        sourceImageDataUrl: editor.sourceImageDataUrl,
                        outputImageDataUrl: dataUrl,
                        tool: editor.tool,
                        brushSize: editor.brushSize,
                        strength,
                        displacement,
                      });
                    }

                    if (
                      !firstLiquifyTrackedRef.current &&
                      canvasRef.current?.hasLiquifyChanges()
                    ) {
                      firstLiquifyTrackedRef.current = true;
                      trackEvent('first_liquify');
                    }
                  }}
                />
                <button
                  className={showOriginal ? 'editor-original-toggle editor-original-toggle-active' : 'editor-original-toggle'}
                  type="button"
                  aria-pressed={showOriginal}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.currentTarget.setPointerCapture(event.pointerId);
                    showOriginalPreview();
                  }}
                  onPointerUp={(event) => {
                    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                      event.currentTarget.releasePointerCapture(event.pointerId);
                    }
                    hideOriginalPreview();
                  }}
                  onPointerCancel={(event) => {
                    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                      event.currentTarget.releasePointerCapture(event.pointerId);
                    }
                    hideOriginalPreview();
                  }}
                >
                  {t('editor.viewOriginal')}
                </button>
              </>
            )}
          </section>

          <aside className="editor-sidepanel">
            <div className="panel-block">
              <div className="panel-title">{t('editor.brush')}</div>
              <input
                type="range"
                min={MIN_BRUSH_SIZE}
                max={MAX_BRUSH_SIZE}
                step={1}
                value={editor.brushSize}
                onChange={(event) => updateBrushSize(Number(event.target.value))}
              />
              <div className="panel-value">{editor.brushSize}</div>
            </div>
            <div className="panel-block">
              <div className="panel-title">{t('editor.zoom')}</div>
              <input
                type="range"
                min={Math.round(MIN_ZOOM * 100)}
                max={Math.round(MAX_ZOOM * 100)}
                step={1}
                value={Math.round(zoom * 100)}
                onChange={(event) => updateZoom(Number(event.target.value) / 100)}
              />
              <div className="panel-value">{Math.round(zoom * 100)}%</div>
            </div>
            <div className="panel-block">
              <div className="panel-title">{t('editor.strength')}</div>
              <input
                type="range"
                min={Math.round(MIN_STRENGTH * 100)}
                max={Math.round(MAX_STRENGTH * 100)}
                step={1}
                value={Math.round(strength * 100)}
                onChange={(event) => updateStrength(Number(event.target.value) / 100)}
              />
              <div className="panel-value">{strength.toFixed(2)}x</div>
            </div>
            <div className="panel-block">
              <div className="panel-title">{t('editor.shortcuts')}</div>
              <div className="shortcut-list">
                <div className="shortcut-mouse-row">
                  <span className="shortcut-mouse-icon" aria-hidden>
                    <span className="shortcut-mouse-wheel" />
                  </span>
                  {t('editor.zoom')}
                </div>
                <div><kbd>1</kbd>/<kbd>2</kbd> {t('editor.toolPush')}/{t('editor.toolRestore')}</div>
                <div><kbd>[</kbd>/<kbd>]</kbd> {t('editor.shortcutBrush')}</div>
                <div><kbd>;</kbd>/<kbd>'</kbd> {t('editor.shortcutStrength')}</div>
                <div><kbd>Ctrl/Cmd+Z</kbd> {t('editor.shortcutUndo')}</div>
                <div><kbd>Shift+Ctrl/Cmd+Z</kbd> {t('editor.shortcutRedo')}</div>
                <div><kbd>0</kbd> {t('editor.shortcutOriginal')}</div>
                <div><kbd>N</kbd> {t('editor.new')}</div>
              </div>
            </div>
          </aside>
        </div>

        {editor.error ? <p className="error-text">{editor.error}</p> : null}
        {ENABLE_AI_DEBUG_PANEL && generateDebug ? (
          <div className="editor-debug-card">
            <div className="editor-debug-head">
              <strong>{t('editor.debugTitle')}</strong>
              <button
                className="button button-secondary"
                type="button"
                onClick={() => setShowDebugPanel((prev) => !prev)}
              >
                {showDebugPanel ? t('common.hide') : t('common.show')}
              </button>
            </div>
            {showDebugPanel ? (
              <>
                <div className="editor-debug-meta">
                  <div><strong>{t('editor.requestSource')}:</strong> {generateDebug.requestImageSource}</div>
                  <div><strong>{t('editor.requestSize')}:</strong> {generateDebug.requestSize}</div>
                  <div><strong>{t('editor.requestedAt')}:</strong> {generateDebug.requestedAt}</div>
                  <div><strong>{t('editor.modelAlias')}:</strong> {generateDebug.modelAlias ?? '-'}</div>
                  <div><strong>{t('editor.modelId')}:</strong> {generateDebug.modelId ?? '-'}</div>
                  <div><strong>{t('editor.responseAt')}:</strong> {generateDebug.responseAt ?? '-'}</div>
                  <div className="editor-debug-prompt"><strong>{t('editor.serverPrompt')}:</strong> {generateDebug.serverPrompt ?? '-'}</div>
                  {generateDebug.errorMessage ? (
                    <div className="editor-debug-error"><strong>{t('editor.errorLabel')}:</strong> {generateDebug.errorMessage}</div>
                  ) : null}
                </div>
                <div className="editor-debug-images">
                  <div>
                    <div className="editor-debug-title">{t('editor.preprocessedImage')}</div>
                    <img className="editor-debug-image" src={generateDebug.requestImage} alt="preprocessed" />
                  </div>
                  <div>
                    <div className="editor-debug-title">{t('editor.returnedImage')}</div>
                    {generateDebug.responseImage ? (
                      <img className="editor-debug-image" src={generateDebug.responseImage} alt="generated" />
                    ) : (
                      <div className="editor-debug-placeholder">{t('editor.waitingForResponse')}</div>
                    )}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      {editor.generating ? (
        <div className="editor-mask">
          <div className="editor-spinner" />
          <p>{t('editor.generating')}</p>
          <p>{t('editor.generatingHint')}</p>
        </div>
      ) : null}

      {showGenerateGateModal && generateGateReason ? (
        <div className="modal-overlay">
          <div className="modal-card">
            <h2>
              {generateGateReason === 'login'
                ? t('editor.gateTitleLogin')
                : t('editor.gateTitleCredits')}
            </h2>
            <p>{t('editor.gateBodySaved')}</p>
            <p>{t('editor.gateBodyCost')}</p>
            <p>
              {generateGateReason === 'login'
                ? t('editor.gateBodyLogin')
                : t('editor.gateBodyPurchase')}
            </p>
            <div className="modal-actions">
              {generateGateReason === 'login' ? (
                <button className="button" onClick={continueToLogin}>
                  {t('editor.gateLoginCta')}
                </button>
              ) : (
                <button className="button" onClick={continueToPurchase}>
                  {t('editor.gatePurchaseCta')}
                </button>
              )}
              <button
                className="button button-secondary"
                onClick={() => {
                  pendingGenerateRef.current = false;
                  setShowGenerateGateModal(false);
                  setGenerateGateReason(null);
                }}
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showConsentModal ? (
        <div className="modal-overlay">
          <div className="modal-card">
            <h2>{t('editor.consentTitle')}</h2>
            <p>{t('editor.consentBody')}</p>
            <div className="modal-links">
              <a href="/privacy" target="_blank" rel="noreferrer">
                {t('editor.openPrivacy')}
              </a>
              <a href="/terms" target="_blank" rel="noreferrer">
                {t('editor.openTerms')}
              </a>
            </div>
            <div className="modal-actions">
              <button className="button" onClick={() => void acceptConsent()}>
                {t('editor.agreeAndContinue')}
              </button>
              <button
                className="button button-secondary"
                onClick={() => {
                  pendingGenerateRef.current = false;
                  setShowConsentModal(false);
                }}
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
