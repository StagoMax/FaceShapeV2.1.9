# Miri

Miri 是一个面向术前方案预览的 AI 整形模拟项目，包含：

- `apps/mobile`: Expo / React Native 移动端
- `apps/web`: Next.js Web 端
- `supabase`: 数据库迁移与 Edge Functions
- `packages/*`: 共享类型、配置与接口包

项目核心流程是先对人像做局部液化编辑，再通过后端图像生成能力产出更接近真实光影的 before / after 对比图。当前仓库已去除私有密钥与本地签名文件，适合作为开源源码基础继续整理。

## 主要能力

- Web 端在线上传与编辑人像
- 移动端图片选择、账户体系与购买流程
- Supabase 用户、积分与存储支持
- PayPal Web 支付与 Google Play 购买校验
- 基于 Seedream / OpenAI 的图像生成代理能力

## Monorepo 结构

```text
.
├── apps/
│   ├── mobile/     # Expo app
│   └── web/        # Next.js app
├── packages/
│   ├── api/
│   ├── config/
│   └── types/
├── scripts/        # 启动与环境变量辅助脚本
└── supabase/       # migrations + edge functions
```

## 环境要求

- Node.js 18+
- npm 10+
- Expo / Android Studio / Xcode（按需）
- Supabase CLI（如果要运行数据库迁移或部署函数）

## 快速开始

1. 安装依赖

```bash
npm install
```

2. 复制环境变量模板

```bash
cp .env.example .env
```

3. 填入你自己的配置

至少需要根据你要运行的模块补这些变量：

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`（仅服务端 / Edge Function）
- `SUPABASE_ACCESS_TOKEN`、`SUPABASE_PROJECT_REF`、`SUPABASE_DB_URL`（本地 Supabase CLI 操作时）
- `SEEDREAM_API_KEY` / `OPENAI_API_KEY`
- `PAYPAL_CLIENT_ID`、`PAYPAL_CLIENT_SECRET`、`PAYPAL_WEBHOOK_ID`
- `GOOGLE_PLAY_SERVICE_ACCOUNT`、`GOOGLE_PLAY_PACKAGE_NAME`

更完整说明见 [OPEN_SOURCE_SETUP.md](./OPEN_SOURCE_SETUP.md)。

## 开发命令

```bash
npm run dev:web
npm run build:web
npm run dev:mobile
npm run android
npm run ios
```

## 移动端说明

- `apps/mobile/app.config.js` 会从仓库根目录 `.env` 读取配置
- 如果需要 Android 正式签名，请自行创建 keystore 和 `apps/mobile/android/keystore.properties`
- Expo EAS 私有 `projectId` 已从开源副本中移除，如需继续使用请绑定你自己的 EAS 项目

## Web / 后端说明

- Web 端基于 Next.js App Router
- `supabase/functions/seedream-proxy` 负责图像生成代理
- `supabase/functions/paypal-*` 处理 PayPal 下单、扣款与 webhook
- `supabase/functions/verify-google-play-purchase` 处理 Google Play 购买校验与积分发放

## 注意事项

- 这是“脱敏后的源码副本”，不包含真实生产环境密钥
- 仓库中的模拟结果仅适合作为术前沟通与方案参考，不应视为医疗建议或真实手术结果保证
- 如果你准备公开发布，建议继续补充 `LICENSE`、截图、部署说明与示例数据

## License

MIT
