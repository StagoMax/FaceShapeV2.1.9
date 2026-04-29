const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = (config) =>
  withDangerousMod(config, ['android', async (modConfig) => {
    const envPaths = {
      ANDROID_SDK_ROOT: process.env.ANDROID_SDK_ROOT,
      ANDROID_HOME: process.env.ANDROID_HOME,
      EXPO_ANDROID_SDK_PATH: process.env.EXPO_ANDROID_SDK_PATH,
    };
    console.log('[with-local-properties] generating local.properties with env:', envPaths);

    const preferredPaths = [
      envPaths.ANDROID_SDK_ROOT,
      envPaths.ANDROID_HOME,
      envPaths.EXPO_ANDROID_SDK_PATH,
    ].filter(Boolean);

    let sdkPath = preferredPaths.find((candidate) => {
      try {
        return candidate && fs.existsSync(candidate);
      } catch (error) {
        console.warn('[with-local-properties] 无法访问路径:', candidate, error);
        return false;
      }
    });

    if (!sdkPath) {
      sdkPath = '/home/expo/Android/Sdk';
      console.warn('[with-local-properties] 使用默认 SDK 路径:', sdkPath);
    } else {
      console.log('[with-local-properties] 使用 SDK 路径:', sdkPath);
    }

    const localPropertiesPath = path.join(
      modConfig.modRequest.projectRoot,
      'android',
      'local.properties'
    );

    const normalizedPath = sdkPath.replace(/\\/g, '\\\\');
    const contents = `sdk.dir=${normalizedPath}\n`;

    await fs.promises.mkdir(path.dirname(localPropertiesPath), { recursive: true });
    await fs.promises.writeFile(localPropertiesPath, contents);

    return modConfig;
  }]);
