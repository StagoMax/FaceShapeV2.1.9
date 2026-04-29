import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Slider from '@react-native-community/slider';
import { useTranslation } from 'react-i18next';
import type { LiquifyBrushMetrics } from '../types/liquify';

interface LiquifyControlsPanelProps {
  smoothing: number;
  onSmoothingChange: (value: number) => void;
  strengthScale: number;
  onStrengthScaleChange: (value: number) => void;
  centerDampen: number;
  onCenterDampenChange: (value: number) => void;
  edgeBoost: number;
  onEdgeBoostChange: (value: number) => void;
  stepFactor: number;
  onStepFactorChange: (value: number) => void;
  decayCurve: number;
  onDecayCurveChange: (value: number) => void;
  falloff: number;
  onFalloffChange: (value: number) => void;
  gradientScaleMax: number;
  onGradientScaleMaxChange: (value: number) => void;
  restoreBoost: number;
  onRestoreBoostChange: (value: number) => void;
  restoreToOriginal: boolean;
  onRestoreToOriginalChange: (value: boolean) => void;
  softSaturationK: number;
  onSoftSaturationKChange: (value: number) => void;
  rippleStart: number;
  onRippleStartChange: (value: number) => void;
  rippleEnd: number;
  onRippleEndChange: (value: number) => void;
  rippleMix: number;
  onRippleMixChange: (value: number) => void;
  rippleSmooth: number;
  onRippleSmoothChange: (value: number) => void;
  performanceMode: boolean;
  onPerformanceModeChange: (value: boolean) => void;
  bwThresholdRatio: number;
  onBwThresholdRatioChange: (value: number) => void;
  bwMaskBlurFactor: number;
  onBwMaskBlurFactorChange: (value: number) => void;
  bwMaskAlphaGain: number;
  onBwMaskAlphaGainChange: (value: number) => void;
  centerResponseMin: number;
  onCenterResponseMinChange: (value: number) => void;
  centerResponseMax: number;
  onCenterResponseMaxChange: (value: number) => void;
  edgeResponseMin: number;
  onEdgeResponseMinChange: (value: number) => void;
  edgeResponseMax: number;
  onEdgeResponseMaxChange: (value: number) => void;
  stepFactorMin: number;
  onStepFactorMinChange: (value: number) => void;
  stepFactorMax: number;
  onStepFactorMaxChange: (value: number) => void;
  showWeightOverlay: boolean;
  onShowWeightOverlayChange: (value: boolean) => void;
  showVectorOverlay: boolean;
  onShowVectorOverlayChange: (value: boolean) => void;
  showBrushProfile?: boolean;
  onShowBrushProfileChange?: (value: boolean) => void;
  renderPath?: 'native' | 'skia';
  onReset?: () => void;
  onApplyGrayscaleOverlay?: () => void;
  metrics?: LiquifyBrushMetrics | null;
}

const ControlRow: React.FC<{
  label: string;
  valueLabel: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
}> = ({ label, valueLabel, min, max, step = 1, value, onChange }) => (
  <View style={styles.row}>
    <View style={styles.labelContainer}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{valueLabel}</Text>
    </View>
    <Slider
      style={styles.slider}
      minimumValue={min}
      maximumValue={max}
      step={step}
      value={value}
      onValueChange={onChange}
      minimumTrackTintColor="#007AFF"
      maximumTrackTintColor="#CFCFCF"
      thumbTintColor="#FFFFFF"
    />
  </View>
);

const LiquifyControlsPanel: React.FC<LiquifyControlsPanelProps> = ({
  smoothing,
  onSmoothingChange,
  strengthScale,
  onStrengthScaleChange,
  centerDampen,
  onCenterDampenChange,
  edgeBoost,
  onEdgeBoostChange,
  stepFactor,
  onStepFactorChange,
  decayCurve,
  onDecayCurveChange,
  falloff,
  onFalloffChange,
  gradientScaleMax,
  onGradientScaleMaxChange,
  restoreBoost,
  onRestoreBoostChange,
  restoreToOriginal,
  onRestoreToOriginalChange,
  softSaturationK,
  onSoftSaturationKChange,
  rippleStart,
  onRippleStartChange,
  rippleEnd,
  onRippleEndChange,
  rippleMix,
  onRippleMixChange,
  rippleSmooth,
  onRippleSmoothChange,
  performanceMode,
  onPerformanceModeChange,
  bwThresholdRatio,
  onBwThresholdRatioChange,
  bwMaskBlurFactor,
  onBwMaskBlurFactorChange,
  bwMaskAlphaGain,
  onBwMaskAlphaGainChange,
  centerResponseMin,
  onCenterResponseMinChange,
  centerResponseMax,
  onCenterResponseMaxChange,
  edgeResponseMin,
  onEdgeResponseMinChange,
  edgeResponseMax,
  onEdgeResponseMaxChange,
  stepFactorMin,
  onStepFactorMinChange,
  stepFactorMax,
  onStepFactorMaxChange,
  showWeightOverlay,
  onShowWeightOverlayChange,
  showVectorOverlay,
  onShowVectorOverlayChange,
  showBrushProfile = false,
  onShowBrushProfileChange,
  renderPath,
  onReset,
  onApplyGrayscaleOverlay,
  metrics,
}) => {
  const { t } = useTranslation();
  const renderPathLabel =
    renderPath === 'native'
      ? t('liquify.renderPathNative')
      : renderPath === 'skia'
        ? t('liquify.renderPathSkia')
        : '';
  const formatNumber = (value: number, digits = 3) => value.toFixed(digits);
  const metricsSections = React.useMemo(() => {
    if (!metrics) {
      return null;
    }
    return [
      {
        title: t('liquify.metricsSectionPosition'),
        rows: [
          {
            label: t('liquify.metricsLabelNormalizedCoord'),
            value: `${formatNumber(metrics.position.normalizedX)}, ${formatNumber(metrics.position.normalizedY)}`,
          },
          { label: t('liquify.metricsLabelRadiusNormalized'), value: formatNumber(metrics.radius.normalized) },
          { label: t('liquify.metricsLabelRadiusPx'), value: formatNumber(metrics.radius.pixels, 1) },
        ],
      },
      {
        title: t('liquify.metricsSectionCurve'),
        rows: [
          { label: t('liquify.metricsLabelFalloff'), value: formatNumber(metrics.falloff, 2) },
          { label: t('liquify.metricsLabelDecay'), value: formatNumber(metrics.decayCurve, 2) },
          { label: t('liquify.metricsLabelCenterWeight'), value: formatNumber(metrics.computed.centerResponse, 3) },
          { label: t('liquify.metricsLabelEdgeWeight'), value: formatNumber(metrics.computed.edgeResponse, 3) },
        ],
      },
      {
        title: t('liquify.metricsSectionDisplacement'),
        rows: [
          {
            label: t('liquify.metricsLabelDeltaUv'),
            value: `${formatNumber(metrics.delta.dxNorm)}, ${formatNumber(metrics.delta.dyNorm)}`,
          },
          { label: t('liquify.metricsLabelDeltaUvLength'), value: formatNumber(metrics.delta.lengthNorm) },
          {
            label: t('liquify.metricsLabelDeltaPx'),
            value: `${formatNumber(metrics.delta.dxPx, 2)}, ${formatNumber(metrics.delta.dyPx, 2)}`,
          },
          { label: t('liquify.metricsLabelDeltaPxLength'), value: formatNumber(metrics.delta.lengthPx, 2) },
        ],
      },
      {
        title: t('liquify.metricsSectionDynamics'),
        rows: [
          { label: t('liquify.metricsLabelPressure'), value: formatNumber(metrics.dynamics.pressure, 2) },
          { label: t('liquify.metricsLabelSpeed'), value: formatNumber(metrics.dynamics.speedPxPerSec, 1) },
          { label: t('liquify.metricsLabelDeltaTime'), value: formatNumber(metrics.dynamics.deltaTime, 3) },
          { label: t('liquify.metricsLabelStrokeDistance'), value: formatNumber(metrics.dynamics.strokeDistance, 1) },
        ],
      },
      {
        title: t('liquify.metricsSectionGpu'),
        rows: [
          { label: t('liquify.metricsLabelEffectiveStrength'), value: formatNumber(metrics.computed.effectiveStrength, 3) },
          { label: t('liquify.metricsLabelBrushBlend'), value: formatNumber(metrics.computed.brushBlend, 3) },
          { label: t('liquify.metricsLabelBrushSoftness'), value: formatNumber(metrics.computed.brushSoftness, 3) },
          { label: t('liquify.metricsLabelStepFactor'), value: formatNumber(metrics.computed.stepFactor, 3) },
        ],
      },
    ];
  }, [metrics, t]);
  return (
    <View style={styles.container}>
      {renderPathLabel || onReset ? (
        <View style={styles.renderPathRow}>
          <View style={styles.renderPathInfo}>
            <Text style={styles.renderPathTitle}>{t('liquify.renderPathTitle')}</Text>
            <Text style={styles.renderPathValue}>
              {renderPathLabel || t('liquify.renderPathUnknown')}
            </Text>
          </View>
          {onReset ? (
            <TouchableOpacity style={styles.resetButton} onPress={onReset}>
              <Text style={styles.resetButtonText}>{t('liquify.resetImage')}</Text>
            </TouchableOpacity>
          ) : null}
          {onApplyGrayscaleOverlay ? (
            <TouchableOpacity style={styles.resetButton} onPress={onApplyGrayscaleOverlay}>
              <Text style={styles.resetButtonText}>{t('liquify.grayscaleOverlay')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
      <ControlRow
        label={t('liquify.smoothing')}
        valueLabel={`${Math.round(smoothing * 100)}%`}
        min={0}
        max={1}
        step={0.05}
        value={smoothing}
        onChange={onSmoothingChange}
      />
      <ControlRow
        label={t('liquify.strengthScale')}
        valueLabel={`${strengthScale.toFixed(2)}×`}
        min={0.3}
        max={2}
        step={0.05}
        value={strengthScale}
        onChange={onStrengthScaleChange}
      />
      <ControlRow
        label={t('liquify.centerDampen')}
        valueLabel={`${Math.round(centerDampen * 100)}%`}
        min={0.1}
        max={0.9}
        step={0.05}
        value={centerDampen}
        onChange={onCenterDampenChange}
      />
      <ControlRow
        label={t('liquify.edgeBoost')}
        valueLabel={`${edgeBoost.toFixed(2)}×`}
        min={0.8}
        max={1.6}
        step={0.05}
        value={edgeBoost}
        onChange={onEdgeBoostChange}
      />
      <ControlRow
        label={t('liquify.brushFalloff')}
        valueLabel={falloff.toFixed(2)}
        min={0.2}
        max={1}
        step={0.05}
        value={falloff}
        onChange={onFalloffChange}
      />
      <ControlRow
        label={t('liquify.restoreBoost')}
        valueLabel={`${restoreBoost.toFixed(2)}×`}
        min={1}
        max={2.5}
        step={0.05}
        value={restoreBoost}
        onChange={onRestoreBoostChange}
      />
      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleButton, restoreToOriginal && styles.toggleButtonActive]}
          onPress={() => onRestoreToOriginalChange(!restoreToOriginal)}
        >
          <Text
            style={[styles.toggleButtonText, restoreToOriginal && styles.toggleButtonTextActive]}
          >
            {t('liquify.restoreToOriginal')}
          </Text>
        </TouchableOpacity>
      </View>
      <ControlRow
        label={t('liquify.centerResponseMin')}
        valueLabel={centerResponseMin.toFixed(2)}
        min={0.05}
        max={1.5}
        step={0.05}
        value={centerResponseMin}
        onChange={onCenterResponseMinChange}
      />
      <ControlRow
        label={t('liquify.centerResponseMax')}
        valueLabel={centerResponseMax.toFixed(2)}
        min={0.2}
        max={3.5}
        step={0.05}
        value={centerResponseMax}
        onChange={onCenterResponseMaxChange}
      />
      <ControlRow
        label={t('liquify.edgeResponseMin')}
        valueLabel={edgeResponseMin.toFixed(2)}
        min={0.2}
        max={2}
        step={0.05}
        value={edgeResponseMin}
        onChange={onEdgeResponseMinChange}
      />
      <ControlRow
        label={t('liquify.edgeResponseMax')}
        valueLabel={edgeResponseMax.toFixed(2)}
        min={0.5}
        max={4}
        step={0.05}
        value={edgeResponseMax}
        onChange={onEdgeResponseMaxChange}
      />
      <ControlRow
        label={t('liquify.stepFactor')}
        valueLabel={t('liquify.stepFactorUnit', { value: stepFactor.toFixed(2) })}
        min={0.2}
        max={1.5}
        step={0.05}
        value={stepFactor}
        onChange={onStepFactorChange}
      />
      <ControlRow
        label={t('liquify.stepFactorMin')}
        valueLabel={`${stepFactorMin.toFixed(2)}×`}
        min={0.01}
        max={2}
        step={0.01}
        value={stepFactorMin}
        onChange={onStepFactorMinChange}
      />
      <ControlRow
        label={t('liquify.stepFactorMax')}
        valueLabel={`${stepFactorMax.toFixed(2)}×`}
        min={0.5}
        max={5}
        step={0.05}
        value={stepFactorMax}
        onChange={onStepFactorMaxChange}
      />
      <ControlRow
        label={t('liquify.decayCurve')}
        valueLabel={decayCurve.toFixed(2)}
        min={0.5}
        max={3}
        step={0.05}
        value={decayCurve}
        onChange={onDecayCurveChange}
      />
      <ControlRow
        label={t('liquify.gradientScaleMax')}
        valueLabel={`${gradientScaleMax.toFixed(2)}×`}
        min={0.5}
        max={2}
        step={0.05}
        value={gradientScaleMax}
        onChange={onGradientScaleMaxChange}
      />
      <ControlRow
        label={t('liquify.softSaturationK')}
        valueLabel={softSaturationK.toFixed(2)}
        min={0.05}
        max={1}
        step={0.01}
        value={softSaturationK}
        onChange={onSoftSaturationKChange}
      />
      <ControlRow
        label={t('liquify.rippleStart')}
        valueLabel={rippleStart.toFixed(2)}
        min={0.5}
        max={3}
        step={0.05}
        value={rippleStart}
        onChange={onRippleStartChange}
      />
      <ControlRow
        label={t('liquify.rippleEnd')}
        valueLabel={rippleEnd.toFixed(2)}
        min={0.8}
        max={3.5}
        step={0.05}
        value={rippleEnd}
        onChange={onRippleEndChange}
      />
      <ControlRow
        label={t('liquify.rippleMix')}
        valueLabel={`${Math.round(rippleMix * 100)}%`}
        min={0}
        max={1}
        step={0.02}
        value={rippleMix}
        onChange={onRippleMixChange}
      />
      <ControlRow
        label={t('liquify.rippleSmooth')}
        valueLabel={`${Math.round(rippleSmooth * 100)}%`}
        min={0}
        max={1}
        step={0.02}
        value={rippleSmooth}
        onChange={onRippleSmoothChange}
      />
      <ControlRow
        label={t('liquify.bwThresholdRatio')}
        valueLabel={`${Math.round(bwThresholdRatio * 100)}%`}
        min={0.05}
        max={0.35}
        step={0.01}
        value={bwThresholdRatio}
        onChange={onBwThresholdRatioChange}
      />
      <ControlRow
        label={t('liquify.bwMaskBlurFactor')}
        valueLabel={`${bwMaskBlurFactor.toFixed(2)}×`}
        min={0.1}
        max={0.8}
        step={0.05}
        value={bwMaskBlurFactor}
        onChange={onBwMaskBlurFactorChange}
      />
      <ControlRow
        label={t('liquify.bwMaskAlphaGain')}
        valueLabel={`${bwMaskAlphaGain.toFixed(2)}×`}
        min={1}
        max={3}
        step={0.1}
        value={bwMaskAlphaGain}
        onChange={onBwMaskAlphaGainChange}
      />
      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleButton, showWeightOverlay && styles.toggleButtonActive]}
          onPress={() => onShowWeightOverlayChange(!showWeightOverlay)}
        >
          <Text style={[styles.toggleButtonText, showWeightOverlay && styles.toggleButtonTextActive]}>
            {t('liquify.weightHeatmap')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleButton, showVectorOverlay && styles.toggleButtonActive]}
          onPress={() => onShowVectorOverlayChange(!showVectorOverlay)}
        >
          <Text style={[styles.toggleButtonText, showVectorOverlay && styles.toggleButtonTextActive]}>
            {t('liquify.vectorDirection')}
          </Text>
        </TouchableOpacity>
        {onShowBrushProfileChange ? (
          <TouchableOpacity
            style={[styles.toggleButton, showBrushProfile && styles.toggleButtonActive]}
            onPress={() => onShowBrushProfileChange(!showBrushProfile)}
          >
            <Text
              style={[styles.toggleButtonText, showBrushProfile && styles.toggleButtonTextActive]}
            >
              {t('liquify.brushWeight')}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {metricsSections ? (
        <View style={styles.metricsContainer}>
          <Text style={styles.metricsTitle}>{t('liquify.metricsTitle')}</Text>
          {metricsSections.map((section) => (
            <View key={section.title} style={styles.metricsSection}>
              <Text style={styles.metricsSectionTitle}>{section.title}</Text>
              {section.rows.map(({ label, value }) => (
                <View key={label} style={styles.metricsRow}>
                  <Text style={styles.metricsLabel}>{label}</Text>
                  <Text style={styles.metricsValue}>{value}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
    paddingHorizontal: 18,
    paddingBottom: 8,
  },
  renderPathRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingVertical: 4,
    alignItems: 'center',
    gap: 12,
  },
  renderPathInfo: {
    flexShrink: 1,
  },
  renderPathTitle: {
    fontSize: 13,
    color: '#2C2C2C',
  },
  renderPathValue: {
    fontSize: 13,
    color: '#007AFF',
  },
  resetButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#EEF1F6',
  },
  resetButtonText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '600',
  },
  row: {
    marginBottom: 8,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D7D7D7',
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  toggleButtonText: {
    fontSize: 13,
    color: '#2C2C2C',
  },
  toggleButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  metricsContainer: {
    marginTop: 14,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#F4F6FA',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E0E3EB',
    gap: 10,
  },
  metricsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2C2C2C',
  },
  metricsSection: {
    gap: 4,
  },
  metricsSectionTitle: {
    fontSize: 12,
    color: '#6E6E73',
    fontWeight: '500',
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricsLabel: {
    fontSize: 12,
    color: '#7C7C80',
  },
  metricsValue: {
    fontSize: 12,
    color: '#1D1D1F',
    fontVariant: ['tabular-nums'],
  },
  labelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  label: {
    fontSize: 13,
    color: '#2C2C2C',
  },
  value: {
    fontSize: 12,
    color: '#666666',
  },
  slider: {
    width: '100%',
    height: 32,
  },
});

export default LiquifyControlsPanel;
