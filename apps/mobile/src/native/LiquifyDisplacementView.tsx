import React, { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import {
  findNodeHandle,
  Platform,
  requireNativeComponent,
  UIManager,
  type NativeSyntheticEvent,
  type ViewProps,
} from 'react-native';

const VIEW_NAME = 'LiquifyDisplacementView';

export type LiquifyBrushTool = 'push' | 'pull' | 'expand' | 'shrink' | 'restore' | 'smooth';

export interface LiquifyBrushCommandPayload {
  x: number; // normalized 0-1
  y: number; // normalized 0-1
  dx: number;
  dy: number;
  radius: number; // normalized radius (0-1)
  strength: number; // 基础力度（GPU 端会结合 pressure 做轻量缩放）
  tool: LiquifyBrushTool;
  pressure?: number;
}

export interface LiquifyViewportConfig {
  viewWidth: number;
  viewHeight: number;
  destX: number;
  destY: number;
  destWidth: number;
  destHeight: number;
}

export interface LiquifyPreviewConfig {
  visible: boolean;
  size: number;
  offsetX: number;
  offsetY: number;
  centerX: number;
  centerY: number;
  spanX: number;
  spanY: number;
  cornerRadius?: number;
}

export interface LiquifyDisplacementViewProps extends ViewProps {
  sourcePath?: string;
  maxMagnitude?: number;
  viewport?: LiquifyViewportConfig;
  brushFalloff?: number;
  smoothingStrength?: number;
  smoothingIterations?: number;
  strengthScale?: number;
  centerDampen?: number;
  edgeBoost?: number;
  maxStepFactor?: number;
  decayCurve?: number;
  centerResponseMin?: number;
  centerResponseMax?: number;
  edgeResponseMin?: number;
  edgeResponseMax?: number;
  stepFactorMin?: number;
  stepFactorMax?: number;
  softSaturationK?: number;
  restoreBoost?: number;
  restoreToOriginal?: boolean;
  rippleStart?: number;
  rippleEnd?: number;
  rippleMix?: number;
  rippleSmooth?: number;
  gradientScaleMax?: number;
  performanceMode?: boolean;
  previewConfig?: LiquifyPreviewConfig;
  previewShowWeights?: boolean;
  previewShowVectors?: boolean;
  previewShowBrushProfile?: boolean;
  previewBrushCenter?: { x: number; y: number } | null;
  previewBrushRadius?: { x: number; y: number } | null;
  previewBrushFalloff?: number;
  previewBrushDecay?: number;
  onReady?: (event: NativeSyntheticEvent<never>) => void;
}

export interface LiquifyDisplacementViewHandle {
  enqueueBrush: (command: LiquifyBrushCommandPayload) => void;
  enqueueBrushBatch: (commands: LiquifyBrushCommandPayload[]) => void;
  reset: () => void;
  resetPreserveSnapshots: () => void;
  beginBatchUpdate: () => void;
  endBatchUpdate: () => void;
  saveSnapshot: (index: number) => void;
  restoreSnapshot: (index: number) => void;
  deleteSnapshot: (index: number) => void;
  saveDisplacementState: (path: string) => void;
  loadDisplacementState: (path: string) => void;
  exportWarpedImage: (path: string, maxOutputDim?: number) => void;
}

const NativeLiquifyView = requireNativeComponent<LiquifyDisplacementViewProps>(VIEW_NAME);

const LiquifyDisplacementView = forwardRef<LiquifyDisplacementViewHandle, LiquifyDisplacementViewProps>(
  (props, ref) => {
    const nativeRef = useRef(null);

    const commandConfig = useMemo(() => {
      const config = UIManager.getViewManagerConfig?.(VIEW_NAME);
      return config?.Commands ?? {};
    }, []);

    const dispatchCommand = (command: string, params: unknown[]) => {
      const handle = findNodeHandle(nativeRef.current);
      if (!handle) {
        return;
      }
      const commandId = commandConfig[command] ?? command;
      UIManager.dispatchViewManagerCommand(handle, commandId, params);
    };

    useImperativeHandle(ref, () => ({
      enqueueBrush(command: LiquifyBrushCommandPayload) {
        dispatchCommand('enqueueBrush', [command]);
      },
      enqueueBrushBatch(commands: LiquifyBrushCommandPayload[]) {
        if (!commands.length) {
          return;
        }
        dispatchCommand('enqueueBrushBatch', [commands]);
      },
      reset() {
        dispatchCommand('resetBrush', []);
      },
      resetPreserveSnapshots() {
        dispatchCommand('resetBrushPreserveSnapshots', []);
      },
      beginBatchUpdate() {
        dispatchCommand('beginBatchUpdate', []);
      },
      endBatchUpdate() {
        dispatchCommand('endBatchUpdate', []);
      },
      saveSnapshot(index: number) {
        dispatchCommand('saveSnapshot', [index]);
      },
      restoreSnapshot(index: number) {
        dispatchCommand('restoreSnapshot', [index]);
      },
      deleteSnapshot(index: number) {
        dispatchCommand('deleteSnapshot', [index]);
      },
      saveDisplacementState(path: string) {
        if (!path) {
          return;
        }
        dispatchCommand('saveDisplacementState', [path]);
      },
      loadDisplacementState(path: string) {
        if (!path) {
          return;
        }
        dispatchCommand('loadDisplacementState', [path]);
      },
      exportWarpedImage(path: string, maxOutputDim: number = 2048) {
        if (!path) {
          return;
        }
        dispatchCommand('exportWarpedImage', [path, Math.max(256, Math.round(maxOutputDim))]);
      },
    }));

    return <NativeLiquifyView ref={nativeRef} {...props} />;
  }
);

LiquifyDisplacementView.displayName = 'LiquifyDisplacementView';

export default LiquifyDisplacementView;
