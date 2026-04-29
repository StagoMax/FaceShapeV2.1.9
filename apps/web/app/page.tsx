import type { Metadata } from 'next';
import type { LanguageCode } from '@miriai/types';
import Link from 'next/link';
import HomeUploadPanel from '@/components/home/HomeUploadPanel';
import { resolveRequestLanguage } from '@/lib/i18n/request';
import { LANGUAGE_TAGS, OPEN_GRAPH_LOCALES } from '@/lib/i18n/shared';
import { getSiteSeoCopy, SITE_NAME, toAbsoluteUrl } from '@/lib/seo';

type HomeFaq = {
  question: string;
  answer: string;
};

type HomeFeature = {
  title: string;
  body: string;
};

type HomeHighlight = {
  title: string;
  body: string;
};

type HomeCopy = {
  metaTitle: string;
  metaDescription: string;
  kicker: string;
  heroTitle: string;
  heroSubtitle: string;
  heroPrimaryCta: string;
  heroSecondaryCta: string;
  heroTrustNote: string;
  highlights: HomeHighlight[];
  demoKicker: string;
  demoTitle: string;
  demoSubtitle: string;
  demoBullets: string[];
  demoWatchLabel: string;
  demoNote: string;
  showcaseTitle: string;
  showcaseSubtitle: string;
  showcaseAssetHint: string;
  beforeLabel: string;
  afterLabel: string;
  beforeHint: string;
  afterHint: string;
  showcaseNote: string;
  priceBarTitle: string;
  priceBarBody: string;
  priceBarHint: string;
  priceBarCta: string;
  privacyCta: string;
  termsCta: string;
  uploadTitle: string;
  uploadSubtitle: string;
  dropHint: string;
  featureTitle: string;
  features: HomeFeature[];
  faqTitle: string;
  faqItems: HomeFaq[];
  footerPrimaryCta: string;
  footerProductTitle: string;
  footerProductEditor: string;
  footerSupportTitle: string;
  footerSupportEmailLabel: string;
  footerSupportResponse: string;
  footerLegalTitle: string;
  footerSummary: string;
  footerPrivacy: string;
  footerTerms: string;
  footerAccountDeletion: string;
  footerBottomNote: string;
  footerRights: string;
  appDescription: string;
  appFeatures: string[];
};

const HOME_COPY: Record<LanguageCode, HomeCopy> = {
  zh: {
    metaTitle: '整容模拟：鼻整形 / 下巴整形 / 轮廓整形术前预览',
    metaDescription:
      '上传照片后即可模拟鼻整形、下巴整形与轮廓整形后的大致变化，生成 AI before/after 对比图，用于术前方案比较与咨询准备。',
    kicker: 'AI 整容模拟',
    heroTitle: '上传照片，先做整容模拟',
    heroSubtitle:
      'Miri 可用于模拟鼻整形、下巴整形和轮廓整形后的大致外观变化，再生成更接近真实光影的 before/after 对比图，帮助你在咨询前先看效果、比方案。',
    heroPrimaryCta: '上传照片开始整容模拟',
    heroSecondaryCta: '查看整容模拟示例',
    heroTrustNote: '每次生成消耗 1 积分，编辑过程会自动保存。',
    highlights: [
      {
        title: '鼻整形模拟',
        body: '可先模拟鼻梁、鼻尖与鼻背线条调整后的整体变化，再决定咨询方向。',
      },
      {
        title: '下巴与轮廓模拟',
        body: '快速比较下巴长度、前后位置与轮廓走向，提前看比例变化。',
      },
      {
        title: '术前方案比较',
        body: '把抽象的“想做成什么样”变成 before/after 对比，更方便做手术方案比较。',
      },
    ],
    demoKicker: '操作演示',
    demoTitle: '先看整容模拟工作流，再决定要不要试',
    demoSubtitle:
      '这支短片会直接示范桌面端的操作流程：上传照片、液化出想要的术后方向，最后生成更接近真实光影的 before / after 整容模拟图。',
    demoBullets: ['先上传一张人像', '调整鼻子、下巴或轮廓到理想术后方向', '生成并比较整容模拟结果'],
    demoWatchLabel: '在 YouTube 上观看',
    demoNote: '若播放器无法载入，可直接前往 YouTube 开启影片。',
    showcaseTitle: '整容模拟 Before / After 示例',
    showcaseSubtitle: '真实案例展示同一张照片在模拟前后的外观差异，帮助你在术前先比较方案方向。',
    showcaseAssetHint: '左侧为术前原图，右侧为 AI 整容模拟结果。',
    beforeLabel: 'Before',
    afterLabel: 'After',
    beforeHint: '术前原图',
    afterHint: '整容模拟结果',
    showcaseNote: '结果用于术前方案参考与咨询准备，不代表真实手术结果。',
    priceBarTitle: '模拟成本',
    priceBarBody: '1 preview = 1 credit',
    priceBarHint: '先用 Starter 套餐测试整容模拟流程，再决定是否升级。',
    priceBarCta: '查看积分套餐',
    privacyCta: '隐私政策',
    termsCta: '服务条款',
    uploadTitle: '上传照片，立即开始整容模拟',
    uploadSubtitle: '支持 JPG / PNG。上传后先液化出理想术后方向，再一键生成 Before / After 对比。',
    dropHint: '支持拖拽上传图片',
    featureTitle: '3 个核心整容模拟场景',
    features: [
      {
        title: '鼻整形模拟',
        body: '模拟鼻梁高度、鼻尖形状和侧面线条变化，提前看隆鼻或鼻整形后的大致感觉。',
      },
      {
        title: '下巴整形模拟',
        body: '快速比较下巴前后位置与长度变化，提前评估垫下巴或下巴调整后的比例效果。',
      },
      {
        title: '轮廓整形模拟',
        body: '在更接近真实光影下比较下颌线与轮廓走向，预览轮廓整形后的整体协调性。',
      },
    ],
    faqTitle: '常见问题',
    faqItems: [
      {
        question: '和普通滤镜或美颜有什么区别？',
        answer:
          '普通美颜主要做磨皮和滤镜，而 Miri 是先调整鼻子、下巴或轮廓的几何方向，再生成更接近真实光影的整容模拟对比图。',
      },
      {
        question: '可以模拟哪些整形项目？',
        answer:
          '目前更适合做鼻整形、下巴整形和轮廓整形相关的术前模拟。你可以先液化出理想术后方向，再生成 before/after 对比图。',
      },
      {
        question: '模拟结果能 100% 代表真实术后效果吗？',
        answer:
          '不能。所有结果用于术前方案比较、整容模拟与咨询参考，不构成医疗建议、诊断或真实手术结果保证。',
      },
    ],
    footerPrimaryCta: '立即开始整容模拟',
    footerProductTitle: '产品',
    footerProductEditor: '在线编辑器',
    footerSupportTitle: '支持',
    footerSupportEmailLabel: '联系邮箱',
    footerSupportResponse: '工作日 24 小时内回复',
    footerLegalTitle: '法务',
    footerSummary: '上传照片后，模拟鼻子、下巴和轮廓整形变化的 AI 整容模拟工具。',
    footerPrivacy: '隐私政策',
    footerTerms: '服务条款',
    footerAccountDeletion: '账号删除',
    footerBottomNote: '结果用于术前方案比较与整容模拟参考，不代表真实手术结果。',
    footerRights: '保留所有权利。',
    appDescription:
      'AI 整容模拟工具：上传照片后模拟鼻整形、下巴整形与轮廓整形变化，并生成更接近真实光影的 before/after 对比图。',
    appFeatures: [
      '模拟鼻整形、下巴整形与轮廓整形变化',
      'AI 根据编辑后的结构重建真实光影',
      '适合术前方案比较与咨询准备',
      '上传照片后可在线编辑并导出 before/after 对比',
    ],
  },
  'zh-TW': {
    metaTitle: '整形模擬：鼻整形 / 下巴整形 / 輪廓整形術前預覽',
    metaDescription:
      '上傳照片後即可模擬鼻整形、下巴整形與輪廓整形後的大致變化，生成 AI before/after 對比圖，用於術前方案比較與諮詢準備。',
    kicker: 'AI 整形模擬',
    heroTitle: '上傳照片，先做整形模擬',
    heroSubtitle:
      'Miri 可用來模擬鼻整形、下巴整形和輪廓整形後的大致外觀變化，再生成更接近真實光影的 before/after 對比圖，幫助你在諮詢前先看效果、比方案。',
    heroPrimaryCta: '上傳照片開始整形模擬',
    heroSecondaryCta: '查看整形模擬示例',
    heroTrustNote: '每次生成消耗 1 積分，編輯過程會自動保存。',
    highlights: [
      {
        title: '鼻整形模擬',
        body: '可先模擬鼻樑、鼻尖與鼻背線條調整後的整體變化，再決定諮詢方向。',
      },
      {
        title: '下巴與輪廓模擬',
        body: '快速比較下巴長度、前後位置與輪廓走向，提前看比例改變。',
      },
      {
        title: '術前方案比較',
        body: '把抽象的「想做成什麼樣」變成 before/after 對比，更方便比較整形方案。',
      },
    ],
    demoKicker: '操作示範',
    demoTitle: '先看整形模擬工作流程，再決定要不要試',
    demoSubtitle:
      '這支短片會直接示範桌面端的操作流程：上傳照片、液化出想要的術後方向，最後生成更接近真實光影的 before / after 整形模擬圖。',
    demoBullets: ['先上傳一張人像', '調整鼻子、下巴或輪廓到理想術後方向', '生成並比較整形模擬結果'],
    demoWatchLabel: '在 YouTube 上觀看',
    demoNote: '若播放器無法載入，可直接前往 YouTube 開啟影片。',
    showcaseTitle: '整形模擬 Before / After 示例',
    showcaseSubtitle: '真實案例展示同一張照片在模擬前後的外觀差異，幫助你在術前先比較方案方向。',
    showcaseAssetHint: '左側為術前原圖，右側為 AI 整形模擬結果。',
    beforeLabel: 'Before',
    afterLabel: 'After',
    beforeHint: '術前原圖',
    afterHint: '整形模擬結果',
    showcaseNote: '結果用於術前方案參考與諮詢準備，不代表真實手術結果。',
    priceBarTitle: '模擬成本',
    priceBarBody: '1 preview = 1 credit',
    priceBarHint: '先用 Starter 方案測試整形模擬流程，再決定是否升級。',
    priceBarCta: '查看積分方案',
    privacyCta: '隱私政策',
    termsCta: '服務條款',
    uploadTitle: '上傳照片，立即開始整形模擬',
    uploadSubtitle: '支援 JPG / PNG。上傳後先液化出理想術後方向，再一鍵生成 Before / After 比較。',
    dropHint: '支援拖曳上傳圖片',
    featureTitle: '3 個核心整形模擬場景',
    features: [
      {
        title: '鼻整形模擬',
        body: '模擬鼻樑高度、鼻尖形狀與側面線條變化，提前看隆鼻或鼻整形後的大致感覺。',
      },
      {
        title: '下巴整形模擬',
        body: '快速比較下巴前後位置與長度變化，提前評估墊下巴或下巴調整後的比例效果。',
      },
      {
        title: '輪廓整形模擬',
        body: '在更接近實拍的光影下比較下顎線與輪廓走向，預覽輪廓整形後的整體協調性。',
      },
    ],
    faqTitle: '常見問題',
    faqItems: [
      {
        question: '和一般濾鏡或美顏有什麼差別？',
        answer:
          '一般美顏多半處理磨皮、膚色與整體濾鏡感，而 Miri 會先微調五官幾何與臉部輪廓，再依新結構重建光影與局部質感，更適合做風格比較與效果預覽。',
      },
      {
        question: '可以模擬哪些整形項目？',
        answer:
          '目前更適合做鼻整形、下巴整形與輪廓整形相關的術前模擬。你可以先液化出理想術後方向，再生成 before/after 對比圖。',
      },
      {
        question: '模擬結果能 100% 代表真實術後效果嗎？',
        answer:
          '不能。所有結果用於術前方案比較、整形模擬與諮詢參考，不構成醫療建議、診斷或真實手術結果保證。',
      },
    ],
    footerPrimaryCta: '立即開始整形模擬',
    footerProductTitle: '產品',
    footerProductEditor: '線上編輯器',
    footerSupportTitle: '支援',
    footerSupportEmailLabel: '聯絡信箱',
    footerSupportResponse: '工作日 24 小時內回覆',
    footerLegalTitle: '法務',
    footerSummary: '上傳照片後，模擬鼻子、下巴和輪廓整形變化的 AI 整形模擬工具。',
    footerPrivacy: '隱私政策',
    footerTerms: '服務條款',
    footerAccountDeletion: '帳號刪除',
    footerBottomNote: '結果用於術前方案比較與整形模擬參考，不代表真實手術結果。',
    footerRights: '保留所有權利。',
    appDescription:
      'AI 整形模擬工具：上傳照片後模擬鼻整形、下巴整形與輪廓整形變化，並生成更接近真實光影的 before/after 對比圖。',
    appFeatures: [
      '模擬鼻整形、下巴整形與輪廓整形變化',
      'AI 依編輯後的結構重建真實光影',
      '適合術前方案比較與諮詢準備',
      '上傳照片後可線上編輯並匯出 before/after 對比',
    ],
  },
  en: {
    metaTitle: 'Cosmetic Surgery Simulator for Nose, Chin, and Contour Before/After',
    metaDescription:
      'Upload a portrait and simulate rhinoplasty, chin augmentation, and contour surgery changes with AI-generated before/after previews for pre-surgery comparison.',
    kicker: 'AI Surgery Simulator',
    heroTitle: 'Simulate cosmetic surgery before consultation',
    heroSubtitle:
      'Miri lets you simulate rhinoplasty, chin augmentation, and contour surgery changes on your own portrait, then generate photo-like before/after previews to compare surgery directions before consultation.',
    heroPrimaryCta: 'Upload a Portrait',
    heroSecondaryCta: 'View Surgery Simulation Examples',
    heroTrustNote: 'Every generation costs 1 credit, and your editing state is preserved.',
    highlights: [
      {
        title: 'Rhinoplasty Simulation',
        body: 'Test bridge, tip, and profile changes first so you can compare rhinoplasty directions before consultation.',
      },
      {
        title: 'Chin And Contour Simulation',
        body: 'Preview chin projection, length, and contour changes on your own portrait before choosing a direction.',
      },
      {
        title: 'Pre-Surgery Comparison',
        body: 'Turn vague ideas into before/after surgery simulation references that are easier to compare and discuss.',
      },
    ],
    demoKicker: 'Walkthrough',
    demoTitle: 'See the surgery simulation workflow first',
    demoSubtitle:
      'Watch the desktop flow in one short video: upload a portrait, shape your desired post-surgery direction, and generate a realistic before/after surgery simulation preview.',
    demoBullets: ['Upload a portrait', 'Liquify nose, chin, or contour toward the desired post-surgery look', 'Generate and compare the surgery simulation result'],
    demoWatchLabel: 'Watch on YouTube',
    demoNote: 'Best viewed on desktop. The player opens on YouTube if inline playback is blocked.',
    showcaseTitle: 'Cosmetic Surgery Before / After Simulation',
    showcaseSubtitle: 'A real example showing the same portrait before and after surgery simulation generation for pre-surgery comparison.',
    showcaseAssetHint: 'Original portrait on the left, AI surgery simulation on the right.',
    beforeLabel: 'Before',
    afterLabel: 'After',
    beforeHint: 'Original portrait',
    afterHint: 'Surgery simulation',
    showcaseNote: 'Outputs are for pre-surgery comparison and consultation reference, not guarantees of surgical outcomes.',
    priceBarTitle: 'Simulation Cost',
    priceBarBody: '1 preview = 1 credit',
    priceBarHint: 'Start with a starter package to test the surgery simulation workflow first.',
    priceBarCta: 'See Credit Packages',
    privacyCta: 'Privacy Policy',
    termsCta: 'Terms of Service',
    uploadTitle: 'Upload a Portrait and Start Surgery Simulation',
    uploadSubtitle: 'Supports JPG / PNG. Shape the desired post-surgery direction first, then generate a before/after simulation in one flow.',
    dropHint: 'Drag and drop an image to upload',
    featureTitle: '3 Core Surgery Simulation Scenarios',
    features: [
      {
        title: 'Rhinoplasty Simulation',
        body: 'Simulate bridge height, tip shape, and profile line changes to preview a rhinoplasty-style result on your own portrait.',
      },
      {
        title: 'Chin Augmentation Simulation',
        body: 'Compare chin length and projection changes quickly to preview how chin augmentation may alter facial proportion.',
      },
      {
        title: 'Contour Surgery Simulation',
        body: 'Evaluate jawline and contour changes under rebuilt lighting to preview overall facial harmony after contour surgery.',
      },
    ],
    faqTitle: 'FAQ',
    faqItems: [
      {
        question: 'How is this different from normal beauty filters?',
        answer:
          'Most beauty filters mainly smooth skin or shift color tone. Miri adjusts facial geometry first, then rebuilds light and shadow from the edited shape for stronger look comparison.',
      },
      {
        question: 'What cosmetic procedures can I simulate here?',
        answer:
          'It works best for rhinoplasty-style changes, chin augmentation previews, and contour surgery direction checks. You edit the desired post-surgery geometry first, then generate the comparison.',
      },
      {
        question: 'Does the simulation guarantee a real surgical result?',
        answer:
          'No. Results are for surgery simulation, pre-surgery comparison, and consultation reference only. They are not medical advice, diagnosis, or guarantees of surgical outcomes.',
      },
    ],
    footerPrimaryCta: 'Start Simulation',
    footerProductTitle: 'Product',
    footerProductEditor: 'Online Editor',
    footerSupportTitle: 'Support',
    footerSupportEmailLabel: 'Support Email',
    footerSupportResponse: 'Response within 24 hours on business days',
    footerLegalTitle: 'Legal',
    footerSummary: 'AI cosmetic surgery simulator for nose, chin, and contour before/after comparison.',
    footerPrivacy: 'Privacy Policy',
    footerTerms: 'Terms of Service',
    footerAccountDeletion: 'Account Deletion',
    footerBottomNote: 'Results are for surgery simulation and consultation reference only, not guaranteed surgical outcomes.',
    footerRights: 'All rights reserved.',
    appDescription:
      'AI cosmetic surgery simulator that lets users preview rhinoplasty, chin augmentation, and contour surgery changes with realistic before/after outputs.',
    appFeatures: [
      'Simulate rhinoplasty, chin augmentation, and contour surgery changes',
      'AI relighting based on edited facial geometry',
      'Useful for pre-surgery comparison and consultation preparation',
      'Online upload, edit, and before/after export workflow',
    ],
  },
  ja: {
    metaTitle: '美容整形シミュレーション：鼻整形・顎整形・輪郭整形の術前比較',
    metaDescription:
      '写真をアップロードして鼻整形・顎整形・輪郭整形の変化をシミュレーションし、AI の before/after 比較画像を生成して術前比較に使えます。',
    kicker: 'AI 整形シミュレーション',
    heroTitle: '写真をアップロードして、先に整形シミュレーション',
    heroSubtitle:
      'Miri では鼻整形・顎整形・輪郭整形後の大まかな変化を自分の写真で試し、実写に近い光の before/after を生成できます。カウンセリング前に方向を比較したい人向けの整形シミュレーションです。',
    heroPrimaryCta: '写真をアップロード',
    heroSecondaryCta: '整形シミュレーション例を見る',
    heroTrustNote: '生成は 1 回あたり 1 クレジット。編集中の状態は保持されます。',
    highlights: [
      {
        title: '鼻整形シミュレーション',
        body: '鼻筋・鼻先・横顔ラインの変化を先に比較し、鼻整形の方向を整理できます。',
      },
      {
        title: '顎と輪郭のシミュレーション',
        body: '顎の長さや前後位置、輪郭ラインの変化をまとめて比較できます。',
      },
      {
        title: '術前比較がしやすい',
        body: '曖昧なイメージを before/after の比較画像にして、整形案を比べやすくします。',
      },
    ],
    demoKicker: 'デモ',
    demoTitle: 'まずは整形シミュレーションの流れを確認',
    demoSubtitle:
      'この短い動画では、写真のアップロードから、理想の術後方向の調整、そして自然な before / after 整形シミュレーション生成までをデスクトップ操作で紹介します。',
    demoBullets: ['まずは写真をアップロード', '鼻・顎・輪郭を理想の術後方向に調整', '整形シミュレーション結果を生成して比較'],
    demoWatchLabel: 'YouTube で見る',
    demoNote: 'デスクトップでの視聴がおすすめです。インライン再生できない場合は YouTube で開いてください。',
    showcaseTitle: '整形シミュレーション Before / After 例',
    showcaseSubtitle: '同じ写真の術前原図と整形シミュレーション後を比較し、カウンセリング前に案を見比べやすくしています。',
    showcaseAssetHint: '左が術前原図、右が AI 整形シミュレーションです。',
    beforeLabel: 'Before',
    afterLabel: 'After',
    beforeHint: '術前原図',
    afterHint: '整形シミュレーション',
    showcaseNote: '結果は術前比較とカウンセリング参考用であり、実際の手術結果を保証するものではありません。',
    priceBarTitle: 'シミュレーション費用',
    priceBarBody: '1 preview = 1 credit',
    priceBarHint: 'まずは Starter パッケージで整形シミュレーションの流れを試せます。',
    priceBarCta: 'クレジットプランを見る',
    privacyCta: 'プライバシーポリシー',
    termsCta: '利用規約',
    uploadTitle: '写真をアップロードして整形シミュレーション開始',
    uploadSubtitle: 'JPG / PNG 対応。理想の術後方向に調整したあと、before/after をワンクリック生成できます。',
    dropHint: '画像をドラッグ&ドロップしてアップロード',
    featureTitle: '3 つの主要整形シミュレーション',
    features: [
      {
        title: '鼻整形シミュレーション',
        body: '鼻筋の高さ、鼻先の形、横顔ラインの変化を比較し、鼻整形後の大まかな印象を先に確認できます。',
      },
      {
        title: '顎整形シミュレーション',
        body: '顎の長さや前後位置を比較し、顎整形後の比率変化を術前に確認しやすくします。',
      },
      {
        title: '輪郭整形シミュレーション',
        body: '顎線や輪郭ラインの変化を自然な光で比較し、輪郭整形後の全体バランスを見やすくします。',
      },
    ],
    faqTitle: 'よくある質問',
    faqItems: [
      {
        question: '普通の美顔フィルターと何が違いますか？',
        answer:
          '一般的な美顔フィルターは主に肌補正や色味調整が中心ですが、Miri は顔の形状を先に整え、その構造に合わせて光と影を再構築するため、見え方の比較に向いています。',
      },
      {
        question: 'どんな整形シミュレーションに向いていますか？',
        answer:
          '鼻整形、顎整形、輪郭整形の術前比較に向いています。理想の術後方向を先に調整し、その後 before/after を生成して比較できます。',
      },
      {
        question: 'シミュレーションは実際の術後結果を保証しますか？',
        answer:
          'いいえ。結果は整形シミュレーション、術前比較、カウンセリング参考用であり、医療上の助言、診断、実際の手術結果保証ではありません。',
      },
    ],
    footerPrimaryCta: '今すぐシミュレーション',
    footerProductTitle: 'プロダクト',
    footerProductEditor: 'オンラインエディタ',
    footerSupportTitle: 'サポート',
    footerSupportEmailLabel: 'サポートメール',
    footerSupportResponse: '営業日 24 時間以内に返信',
    footerLegalTitle: '法務',
    footerSummary: '鼻整形・顎整形・輪郭整形の変化を比較できる AI 整形シミュレーション。',
    footerPrivacy: 'プライバシーポリシー',
    footerTerms: '利用規約',
    footerAccountDeletion: 'アカウント削除',
    footerBottomNote: '結果は術前比較と整形シミュレーション参考用であり、実際の手術結果を保証するものではありません。',
    footerRights: 'All rights reserved.',
    appDescription:
      '鼻整形・顎整形・輪郭整形の変化を自分の写真で試し、自然な before/after を生成できる AI 整形シミュレーションツール。',
    appFeatures: [
      '鼻整形・顎整形・輪郭整形の変化をシミュレーション',
      '編集後の形状に合わせて AI が光を再構築',
      '術前比較とカウンセリング準備に活用可能',
      'アップロードから編集、before/after 書き出しまで Web で完結',
    ],
  },
};

const toJsonLd = (data: unknown) => JSON.stringify(data).replace(/</g, '\\u003c');
const DEMO_VIDEO_ID = 'SL3Fk5wYC9M';
const DEMO_VIDEO_URL = `https://youtu.be/${DEMO_VIDEO_ID}`;
const DEMO_EMBED_URL = `https://www.youtube-nocookie.com/embed/${DEMO_VIDEO_ID}?rel=0&modestbranding=1&playsinline=1`;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await resolveRequestLanguage();
  const copy = HOME_COPY[locale];
  const siteCopy = getSiteSeoCopy(locale);

  return {
    title: copy.metaTitle,
    description: copy.metaDescription,
    keywords: siteCopy.keywords,
    alternates: {
      canonical: '/',
    },
    openGraph: {
      locale: OPEN_GRAPH_LOCALES[locale],
      title: `${SITE_NAME} | ${copy.metaTitle}`,
      description: copy.metaDescription,
      url: '/',
      images: [
        {
          url: '/icon.png',
          width: 512,
          height: 512,
          alt: `${SITE_NAME} AI surgery simulator`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${SITE_NAME} | ${copy.metaTitle}`,
      description: copy.metaDescription,
      images: ['/icon.png'],
    },
  };
}

export default async function HomePage() {
  const locale = await resolveRequestLanguage();
  const copy = HOME_COPY[locale];
  const langTag = LANGUAGE_TAGS[locale];
  const currentYear = new Date().getFullYear();

  const appJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: SITE_NAME,
    url: toAbsoluteUrl('/'),
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'Web',
    inLanguage: [langTag],
    description: copy.appDescription,
    featureList: copy.appFeatures,
  };

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    inLanguage: langTag,
    mainEntity: copy.faqItems.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };

  return (
    <main className="app-main home-seo-main" lang={langTag}>
      <section className="home-hero">
        <div className="home-hero-upload-shell">
          <div className="home-hero-upload-card">
            <HomeUploadPanel
              title={copy.uploadTitle}
              subtitle={copy.uploadSubtitle}
              dropHint={copy.dropHint}
              privacyLabel={copy.privacyCta}
              termsLabel={copy.termsCta}
              embedded
            />
          </div>
        </div>

        <div className="home-hero-grid">
          <div className="home-hero-copy">
            <p className="kicker">{copy.kicker}</p>
            <h1 className="title">{copy.heroTitle}</h1>
            <p className="subtitle">{copy.heroSubtitle}</p>
          </div>

          <div className="home-hero-video-shell" aria-label={copy.demoWatchLabel}>
            <div className="home-demo-player">
              <iframe
                src={DEMO_EMBED_URL}
                title={`${SITE_NAME} demo video`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </div>
          </div>
        </div>

        <div className="home-highlight-grid" aria-label={copy.featureTitle}>
          {copy.highlights.map((item, index) => (
            <article className="home-highlight-card" key={item.title}>
              <span className="home-highlight-index">{`${index + 1}`.padStart(2, '0')}</span>
              <h2>{item.title}</h2>
              <p>{item.body}</p>
            </article>
          ))}
        </div>

      </section>

      <section className="card home-intent-showcase" aria-labelledby="home-intent-showcase-title" id="home-intent-showcase">
        <div className="home-intent-showcase-head">
          <h2 id="home-intent-showcase-title" className="home-section-title">
            {copy.showcaseTitle}
          </h2>
          <p>{copy.showcaseSubtitle}</p>
        </div>
        <div className="home-intent-media-grid">
          <article className="home-intent-media-frame home-intent-media-before" aria-label={copy.beforeLabel}>
            <div className="home-intent-media-tag">{copy.beforeLabel}</div>
            <div className="home-intent-media-visual">
              <span className="home-intent-media-copy">{copy.beforeHint}</span>
            </div>
            <p>{copy.beforeHint}</p>
          </article>
          <article className="home-intent-media-frame home-intent-media-after" aria-label={copy.afterLabel}>
            <div className="home-intent-media-tag">{copy.afterLabel}</div>
            <div className="home-intent-media-visual">
              <span className="home-intent-media-copy">{copy.afterHint}</span>
            </div>
            <p>{copy.afterHint}</p>
          </article>
        </div>
        <div className="home-intent-showcase-foot">
          <p className="home-intent-showcase-asset">{copy.showcaseAssetHint}</p>
          <p className="home-intent-showcase-note">{copy.showcaseNote}</p>
        </div>
      </section>

      <section className="card home-info-card" aria-labelledby="feature-title">
        <h2 id="feature-title" className="home-section-title">
          {copy.featureTitle}
        </h2>
        <div className="home-feature-grid">
          {copy.features.map((feature) => (
            <article className="home-feature-item home-intent-scenario" key={feature.title}>
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="card home-faq-card" aria-labelledby="faq-title">
        <h2 id="faq-title" className="home-section-title">
          {copy.faqTitle}
        </h2>
        <div className="home-faq-list">
          {copy.faqItems.map((item) => (
            <details className="home-faq-item" key={item.question}>
              <summary>{item.question}</summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <footer className="home-footer">
        <div className="home-footer-shell">
          <div className="home-footer-top">
            <div className="home-footer-brand">
              <div className="home-footer-logo">{SITE_NAME}</div>
              <p className="home-footer-summary">{copy.footerSummary}</p>
            </div>
            <Link href="/editor" className="home-footer-cta">
              {copy.footerPrimaryCta}
            </Link>
          </div>

          <div className="home-footer-grid">
            <div className="home-footer-col">
              <h3>{copy.footerProductTitle}</h3>
              <Link href="/editor" className="home-footer-link">
                {copy.footerProductEditor}
              </Link>
            </div>

            <div className="home-footer-col">
              <h3>{copy.footerSupportTitle}</h3>
              <p className="home-footer-meta">{copy.footerSupportEmailLabel}</p>
              <a className="home-footer-link" href="mailto:support@miriai.app">
                support@miriai.app
              </a>
              <p className="home-footer-meta">{copy.footerSupportResponse}</p>
            </div>

            <div className="home-footer-col">
              <h3>{copy.footerLegalTitle}</h3>
              <Link href="/privacy" className="home-footer-link">
                {copy.footerPrivacy}
              </Link>
              <Link href="/terms" className="home-footer-link">
                {copy.footerTerms}
              </Link>
              <Link href="/account-deletion" className="home-footer-link">
                {copy.footerAccountDeletion}
              </Link>
            </div>
          </div>

          <div className="home-footer-bottom-row">
            <p className="home-footer-bottom-text">
              © {currentYear} {SITE_NAME}. {copy.footerRights}
            </p>
            <p className="home-footer-bottom-text">{copy.footerBottomNote}</p>
          </div>
        </div>
      </footer>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toJsonLd(appJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toJsonLd(faqJsonLd) }} />
    </main>
  );
}
