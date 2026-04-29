const path = require('path');
const dotenv = require('dotenv');
const baseConfig = require('./app.json');

dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

module.exports = () => {
  const { SUPABASE_URL, SUPABASE_ANON_KEY, APP_VARIANT } = process.env;
  const isDebug = APP_VARIANT === 'debug';
  const baseName = baseConfig.expo?.name ?? 'Miri';
  const baseScheme = baseConfig.expo?.scheme ?? 'miri';
  const baseBundleId = baseConfig.expo?.ios?.bundleIdentifier ?? 'app.miriai.miri';
  const basePackage = baseConfig.expo?.android?.package ?? 'app.miriai.miri';
  const debugSuffix = '.debug';
  const debugNameSuffix = ' Debug';

  return {
    ...baseConfig,
    expo: {
      ...baseConfig.expo,
      name: isDebug ? `${baseName}${debugNameSuffix}` : baseName,
      scheme: isDebug ? `${baseScheme}-debug` : baseScheme,
      ios: {
        ...(baseConfig.expo?.ios ?? {}),
        bundleIdentifier: isDebug ? `${baseBundleId}${debugSuffix}` : baseBundleId,
      },
      android: {
        ...(baseConfig.expo?.android ?? {}),
        package: isDebug ? `${basePackage}${debugSuffix}` : basePackage,
      },
      plugins: [...(baseConfig.expo?.plugins ?? []), 'expo-localization'],
      extra: {
        ...(baseConfig.expo?.extra ?? {}),
        supabaseUrl: SUPABASE_URL,
        supabaseAnonKey: SUPABASE_ANON_KEY,
      },
    },
  };
};
