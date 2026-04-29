# Open Source Setup

这个目录是从 `FaceShapeV2.1.8` 复制出来并做过脱敏处理的可开源版本。

## 已移除的内容

- 根目录真实 `.env`
- 本地 IDE / Gradle 缓存目录
- `supabase/.temp/` 本地临时项目信息
- `apps/mobile/android_backup/app/debug.keystore`
- Expo EAS 私有 `projectId`
- Web 示例图、移动端教程视频与根目录演示视频等演示素材
- `apps/mobile/android_backup/` 旧备份工程
- `apps/mobile/platform-tools/` 平台工具二进制

## 首次运行前需要补的配置

1. 复制 `.env.example` 为 `.env`，并填入你自己的密钥。
2. 如果需要 Android 正式签名，自行创建 keystore 与 `apps/mobile/android/keystore.properties`。
3. 如果需要使用 Expo EAS，自行执行 `eas init` 或在 `apps/mobile/app.json` 中填入你自己的项目配置。

## 常用命令

```bash
npm install
npm run dev:mobile
npm run dev:web
```
