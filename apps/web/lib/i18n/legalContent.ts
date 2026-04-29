import type { LanguageCode } from '@miriai/types';

type LegalBlock =
  | { type: 'p'; text: string }
  | { type: 'h3'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'contact'; label: string; value: string; href?: string }
  | { type: 'lines'; lines: string[] }
  | { type: 'links'; items: Array<{ label: string; href: string }> };

type LegalSection = {
  title: string;
  blocks: LegalBlock[];
};

export type LegalDocument = {
  metadataTitle: string;
  metadataDescription: string;
  kicker: string;
  title: string;
  effectiveDate?: string;
  lastUpdated?: string;
  sections: LegalSection[];
};

const privacyDocuments: Record<LanguageCode, LegalDocument> = {
  zh: {
    metadataTitle: '隐私政策',
    metadataDescription: 'Miri 隐私政策：了解面部图片、AI 生成内容、数据处理与保留周期。',
    kicker: '政策文件',
    title: '隐私政策',
    effectiveDate: '生效日期：2026 年 1 月 19 日',
    lastUpdated: '最后更新：2026 年 1 月 19 日',
    sections: [
      {
        title: '1. 简介',
        blocks: [
          {
            type: 'p',
            text:
              '本隐私政策适用于佛山市星航贸易有限公司提供并控制的 Miri 移动应用、网站及相关服务。我们致力于保护你的隐私，并说明我们如何收集、使用、共享和处理个人数据。',
          },
          {
            type: 'p',
            text:
              '请注意：我们的运营主体位于中国，但核心个人数据，尤其是用户上传内容和面部相关数据，可能会在新加坡及其他司法辖区的安全服务器上处理与存储。',
          },
        ],
      },
      {
        title: '2. 我们收集哪些信息',
        blocks: [
          { type: 'h3', text: '2.1 你主动提供的信息' },
          {
            type: 'ul',
            items: [
              '用户内容：你上传、生成、查看的照片、图片、提示词等内容，其中可能包含面部图像。',
              '沟通信息：你向我们反馈、求助或咨询时提供的内容。',
              '账号信息：如你选择注册账号，我们可能收集用户名、邮箱地址或第三方登录信息。',
            ],
          },
          { type: 'h3', text: '2.2 自动收集的信息' },
          {
            type: 'ul',
            items: [
              '技术数据：设备型号、系统版本、系统语言、设备标识符、IP 地址等。',
              '使用数据：功能使用情况、会话时长、崩溃日志、你使用过的编辑效果等。',
            ],
          },
          { type: 'h3', text: '2.3 来自其他来源的信息' },
          {
            type: 'p',
            text:
              '如果你使用 Apple、Google 等第三方账号登录，我们可能会根据该服务的授权范围接收头像、昵称等资料。',
          },
        ],
      },
      {
        title: '3. 我们如何使用这些信息',
        blocks: [
          {
            type: 'ul',
            items: [
              '提供和运行服务，包括图像编辑、液化和 AI 生成功能。',
              '进行面部几何与关键点处理，仅用于实现对应功能，不用于身份识别或认证。',
              '在聚合或匿名化基础上改进产品、修复问题并开发新能力。',
              '防范欺诈、滥用、攻击和其他安全风险。',
              '履行法律、监管和合规义务。',
            ],
          },
        ],
      },
      {
        title: '4. 我们如何共享信息',
        blocks: [
          {
            type: 'p',
            text: '我们不会出售你的个人数据。仅会在以下场景披露必要信息：',
          },
          { type: 'h3', text: '4.1 服务提供商' },
          {
            type: 'ul',
            items: [
              '云基础设施：我们使用 AWS 新加坡区与 Google Cloud 新加坡区进行托管和计算。',
              'AI 技术伙伴：我们会将必要的用户内容发送给 BytePlus 及其关联方用于图像推理，但不会允许其将该数据用于独立训练。',
            ],
          },
          { type: 'h3', text: '4.2 法定义务' },
          {
            type: 'p',
            text:
              '在我们基于善意认为有必要遵守法律义务、执行服务条款或保护用户、公众与公司安全时，可能向执法机构、监管部门或第三方披露信息。',
          },
          { type: 'h3', text: '4.3 业务转让' },
          {
            type: 'p',
            text:
              '如果公司发生并购、重组、破产或资产出售，你的信息可能作为交易的一部分被转移。',
          },
        ],
      },
      {
        title: '5. 国际数据传输',
        blocks: [
          {
            type: 'p',
            text:
              '你的个人数据主要存储在新加坡，也可能在我们的服务商所在国家和地区处理，例如美国。我们会采用标准合同条款等适当保护措施以保障跨境传输安全。',
          },
        ],
      },
      {
        title: '6. 数据保留政策',
        blocks: [
          {
            type: 'ul',
            items: [
              '用户内容与面部数据：我们执行“短期处理”策略，原始图片和生成结果通常会在处理完成后 24 小时内从云端删除。',
              '使用日志与技术数据：仅在改进服务、解决争议、履行法律义务所需期间保留。',
            ],
          },
        ],
      },
      {
        title: '7. 数据安全',
        blocks: [
          {
            type: 'p',
            text:
              '我们采用管理、技术和物理层面的安全措施，包括传输加密与静态加密，以减少未经授权访问、丢失、滥用和篡改的风险。但互联网传输无法保证绝对安全。',
          },
        ],
      },
      {
        title: '8. 你的权利',
        blocks: [
          {
            type: 'ul',
            items: [
              '访问权：了解我们持有哪些关于你的数据。',
              '删除权：请求删除你的个人数据。',
              '更正权：更正不准确或不完整的数据。',
              '撤回同意：在适用情况下撤回数据处理同意。',
            ],
          },
          { type: 'p', text: '如需行使这些权利，请联系我们：' },
          { type: 'contact', label: '邮箱', value: 'support@miriai.app', href: 'mailto:support@miriai.app' },
        ],
      },
      {
        title: '9. 儿童隐私',
        blocks: [
          {
            type: 'p',
            text:
              '本服务不面向 13 岁以下儿童，或你所在地区规定的更高年龄门槛以下的未成年人。若我们发现误收集了相关数据，会及时删除。',
          },
        ],
      },
      {
        title: '10. 政策更新',
        blocks: [
          {
            type: 'p',
            text:
              '我们可能不时更新本政策。如有重大变更，我们会通过更新页面顶部日期或在应用内公告等方式进行通知。',
          },
        ],
      },
      {
        title: '11. 联系我们',
        blocks: [
          { type: 'contact', label: '邮箱', value: 'support@miriai.app', href: 'mailto:support@miriai.app' },
          { type: 'lines', lines: ['公司：佛山市星航贸易有限公司', '地址：中国广东省佛山市禅城区祖庙街道汾江中路 121 号 9E-1-B456 室。'] },
        ],
      },
      {
        title: '12. 附录：特定法域补充说明',
        blocks: [
          {
            type: 'ul',
            items: [
              '欧洲经济区与英国：我们基于合同履行、合法利益和法律义务处理数据，并使用标准合同条款保障跨境传输。',
              '美国：我们不会出售或为跨上下文定向广告共享个人信息；伊利诺伊州面部几何数据通常在 24 小时内销毁。',
              '巴西：你享有 LGPD 规定的知情、访问、更正和撤回同意等权利。',
              '新加坡：我们遵守 PDPA，并确保海外接收方提供可比的数据保护水平。',
              '韩国：在收集目的达成后会尽快销毁个人数据，并按法律要求保留必要记录。',
            ],
          },
        ],
      },
    ],
  },
  'zh-TW': {
    metadataTitle: '隱私政策',
    metadataDescription: 'Miri 隱私政策：了解臉部圖片、AI 生成內容、資料處理與保留週期。',
    kicker: '政策文件',
    title: '隱私政策',
    effectiveDate: '生效日期：2026 年 1 月 19 日',
    lastUpdated: '最後更新：2026 年 1 月 19 日',
    sections: [
      {
        title: '1. 簡介',
        blocks: [
          {
            type: 'p',
            text:
              '本隱私政策適用於佛山市星航貿易有限公司提供並控制的 Miri 行動應用、網站及相關服務。我們重視你的隱私，並說明我們如何蒐集、使用、分享與處理個人資料。',
          },
          {
            type: 'p',
            text:
              '請注意：我們的營運主體位於中國，但核心個人資料，尤其是使用者內容與臉部相關資料，可能會在新加坡及其他司法轄區的安全伺服器上處理與儲存。',
          },
        ],
      },
      {
        title: '2. 我們蒐集哪些資訊',
        blocks: [
          { type: 'h3', text: '2.1 你主動提供的資訊' },
          {
            type: 'ul',
            items: [
              '使用者內容：你上傳、生成、查看的照片、圖片、提示詞等內容，其中可能包含臉部影像。',
              '溝通資訊：你向我們回報問題、提供意見或諮詢時所提交的內容。',
              '帳號資訊：若你選擇註冊帳號，我們可能蒐集使用者名稱、電子郵件或第三方登入資料。',
            ],
          },
          { type: 'h3', text: '2.2 自動蒐集的資訊' },
          {
            type: 'ul',
            items: [
              '技術資料：裝置型號、系統版本、系統語言、裝置識別碼、IP 位址等。',
              '使用資料：功能使用情況、使用時長、當機紀錄，以及你套用過的效果等。',
            ],
          },
          { type: 'h3', text: '2.3 來自其他來源的資訊' },
          {
            type: 'p',
            text:
              '若你使用 Apple、Google 等第三方帳號登入，我們可能依該服務授權範圍取得頭像、暱稱等資訊。',
          },
        ],
      },
      {
        title: '3. 我們如何使用資訊',
        blocks: [
          {
            type: 'ul',
            items: [
              '提供與營運服務，包括圖像編輯、液化與 AI 生成功能。',
              '進行臉部幾何與關鍵點處理，但僅用於實現功能，不用於身份驗證。',
              '以聚合或匿名化方式改進產品、修復問題並開發新功能。',
              '預防詐欺、濫用、攻擊與其他安全風險。',
              '履行法律、監管與合規義務。',
            ],
          },
        ],
      },
      {
        title: '4. 我們如何分享資訊',
        blocks: [
          { type: 'p', text: '我們不會出售你的個人資料。僅會在以下情況分享必要資訊：' },
          { type: 'h3', text: '4.1 服務供應商' },
          {
            type: 'ul',
            items: [
              '雲端基礎設施：我們使用 AWS 新加坡區與 Google Cloud 新加坡區進行託管與運算。',
              'AI 技術夥伴：我們會將必要的使用者內容傳送給 BytePlus 及其關聯方進行圖像推理，但不允許其將資料用於獨立模型訓練。',
            ],
          },
          { type: 'h3', text: '4.2 法律義務' },
          {
            type: 'p',
            text:
              '若我們基於善意認為有必要遵守法律義務、執行服務條款，或保護使用者、公司與公眾安全，可能向執法單位、監管機關或第三方揭露資訊。',
          },
          { type: 'h3', text: '4.3 業務轉讓' },
          {
            type: 'p',
            text:
              '若公司發生合併、重組、破產或資產出售，你的資訊可能作為交易的一部分被移轉。',
          },
        ],
      },
      {
        title: '5. 國際資料傳輸',
        blocks: [
          {
            type: 'p',
            text:
              '你的個人資料主要儲存在新加坡，也可能在我們服務供應商所在的其他國家或地區處理，例如美國。我們會採取標準契約條款等保護措施確保跨境傳輸安全。',
          },
        ],
      },
      {
        title: '6. 資料保留政策',
        blocks: [
          {
            type: 'ul',
            items: [
              '使用者內容與臉部資料：我們採用「短期處理」策略，原始圖片與生成結果通常會在處理完成後 24 小時內自雲端刪除。',
              '使用紀錄與技術資料：僅在改善服務、處理爭議與履行法律義務所需期間保留。',
            ],
          },
        ],
      },
      {
        title: '7. 資料安全',
        blocks: [
          {
            type: 'p',
            text:
              '我們採取管理、技術與實體安全措施，包括傳輸加密與靜態加密，以降低未經授權存取、遺失、濫用與竄改風險。但網際網路傳輸無法保證絕對安全。',
          },
        ],
      },
      {
        title: '8. 你的權利',
        blocks: [
          {
            type: 'ul',
            items: [
              '存取權：了解我們持有哪些與你相關的資料。',
              '刪除權：要求刪除你的個人資料。',
              '更正權：更正不正確或不完整的資料。',
              '撤回同意：在適用情況下撤回資料處理同意。',
            ],
          },
          { type: 'p', text: '如需行使這些權利，請透過以下方式聯絡我們：' },
          { type: 'contact', label: '電子郵件', value: 'support@miriai.app', href: 'mailto:support@miriai.app' },
        ],
      },
      {
        title: '9. 兒童隱私',
        blocks: [
          {
            type: 'p',
            text:
              '本服務不面向 13 歲以下兒童，或你所在地法律規定的更高年齡門檻以下之未成年人。若我們發現誤蒐集了相關資料，會儘速刪除。',
          },
        ],
      },
      {
        title: '10. 政策更新',
        blocks: [
          {
            type: 'p',
            text:
              '我們可能不時更新本政策。若有重大變更，我們會透過更新頁面頂部日期或於 App 內公告等方式通知你。',
          },
        ],
      },
      {
        title: '11. 聯絡我們',
        blocks: [
          { type: 'contact', label: '電子郵件', value: 'support@miriai.app', href: 'mailto:support@miriai.app' },
          { type: 'lines', lines: ['公司：佛山市星航貿易有限公司', '地址：中國廣東省佛山市禪城區祖廟街道汾江中路 121 號 9E-1-B456 室。'] },
        ],
      },
      {
        title: '12. 附錄：特定法域補充說明',
        blocks: [
          {
            type: 'ul',
            items: [
              '歐洲經濟區與英國：我們基於契約履行、合法利益與法律義務處理資料，並以標準契約條款保障跨境傳輸。',
              '美國：我們不會出售或為跨情境廣告分享個人資訊；伊利諾州的臉部幾何資料通常會於 24 小時內銷毀。',
              '巴西：你享有 LGPD 規定的知情、存取、更正與撤回同意等權利。',
              '新加坡：我們遵守 PDPA，並確保海外接收方提供可比擬的資料保護水平。',
              '韓國：在蒐集目的達成後會盡快刪除個人資料，並依法保留必要紀錄。',
            ],
          },
        ],
      },
    ],
  },
  en: {
    metadataTitle: 'Privacy Policy',
    metadataDescription: 'Miri Privacy Policy: learn how we handle face images, AI outputs, and data retention.',
    kicker: 'Policies',
    title: 'Privacy Policy',
    effectiveDate: 'Effective Date: January 19, 2026',
    lastUpdated: 'Last Updated: January 19, 2026',
    sections: [
      {
        title: '1. Introduction',
        blocks: [
          {
            type: 'p',
            text:
              'This Privacy Policy applies to the Miri mobile app, website, and related services provided by Foshan Xinghang Trading Co., Ltd. It explains how we collect, use, share, and otherwise process personal data.',
          },
          {
            type: 'p',
            text:
              'Our operating headquarters are in China, but core personal data, especially user content and face-related data, may be processed and stored on secure servers in Singapore and other jurisdictions.',
          },
        ],
      },
      {
        title: '2. Information We Collect',
        blocks: [
          { type: 'h3', text: '2.1 Information You Provide' },
          {
            type: 'ul',
            items: [
              'User Content, including photos, images, generated results, and prompts you submit.',
              'Communications Data when you contact us for support, feedback, or other inquiries.',
              'Account Data such as username, email address, or third-party sign-in details when you register.',
            ],
          },
          { type: 'h3', text: '2.2 Automatically Collected Information' },
          {
            type: 'ul',
            items: [
              'Technical Data such as device model, operating system, system language, identifiers, and IP address.',
              'Usage Data such as feature usage, session duration, crash logs, and editing activity.',
            ],
          },
          { type: 'h3', text: '2.3 Information From Other Sources' },
          {
            type: 'p',
            text:
              'If you sign in with Apple, Google, or another third-party provider, we may receive profile details that the provider is authorized to share with us.',
          },
        ],
      },
      {
        title: '3. How We Use Information',
        blocks: [
          {
            type: 'ul',
            items: [
              'To provide and operate image editing, liquify, and AI generation features.',
              'To process face geometry and landmarks only for feature delivery, not for identity verification.',
              'To improve our product on an aggregated or anonymized basis, fix bugs, and develop new features.',
              'To detect fraud, abuse, attacks, and other safety or security issues.',
              'To comply with legal, regulatory, and compliance obligations.',
            ],
          },
        ],
      },
      {
        title: '4. How We Share Information',
        blocks: [
          { type: 'p', text: 'We do not sell personal data. We disclose necessary information only in the following situations:' },
          { type: 'h3', text: '4.1 Service Providers' },
          {
            type: 'ul',
            items: [
              'Cloud infrastructure providers, including AWS Singapore and Google Cloud Singapore.',
              'AI technology partners such as BytePlus and affiliates for inference only, without independent model training rights.',
            ],
          },
          { type: 'h3', text: '4.2 Legal Obligations' },
          {
            type: 'p',
            text:
              'We may disclose information when we believe in good faith it is necessary to comply with law, enforce our Terms, or protect the safety and rights of users, the public, or our company.',
          },
          { type: 'h3', text: '4.3 Business Transfers' },
          {
            type: 'p',
            text:
              'If our business is involved in a merger, restructuring, bankruptcy, or asset sale, your information may be transferred as part of that transaction.',
          },
        ],
      },
      {
        title: '5. International Data Transfers',
        blocks: [
          {
            type: 'p',
            text:
              'Personal data is primarily stored in Singapore and may also be processed in countries where our vendors operate, including the United States. We use safeguards such as Standard Contractual Clauses where appropriate.',
          },
        ],
      },
      {
        title: '6. Data Retention',
        blocks: [
          {
            type: 'ul',
            items: [
              'User Content and face-related data are generally deleted from cloud storage within 24 hours after processing completes.',
              'Usage logs and technical data are retained only as long as necessary to improve the service, resolve disputes, and meet legal obligations.',
            ],
          },
        ],
      },
      {
        title: '7. Data Security',
        blocks: [
          {
            type: 'p',
            text:
              'We use administrative, technical, and physical safeguards, including encryption in transit and at rest, to reduce the risk of unauthorized access, loss, misuse, or alteration. No internet transmission is fully secure.',
          },
        ],
      },
      {
        title: '8. Your Rights',
        blocks: [
          {
            type: 'ul',
            items: [
              'Access: learn what personal data we hold about you.',
              'Deletion: request deletion of your personal data.',
              'Correction: request correction of inaccurate or incomplete data.',
              'Withdrawal of Consent: withdraw consent where processing is based on consent.',
            ],
          },
          { type: 'p', text: 'To exercise these rights, contact us at:' },
          { type: 'contact', label: 'Email', value: 'support@miriai.app', href: 'mailto:support@miriai.app' },
        ],
      },
      {
        title: "9. Children's Privacy",
        blocks: [
          {
            type: 'p',
            text:
              'The Services are not directed to children under 13, or a higher minimum age required in your jurisdiction. If we learn that we collected such data, we will delete it.',
          },
        ],
      },
      {
        title: '10. Policy Updates',
        blocks: [
          {
            type: 'p',
            text:
              'We may update this Privacy Policy from time to time. We will notify users of material changes through an updated date on this page or through in-app notice where appropriate.',
          },
        ],
      },
      {
        title: '11. Contact Us',
        blocks: [
          { type: 'contact', label: 'Email', value: 'support@miriai.app', href: 'mailto:support@miriai.app' },
          {
            type: 'lines',
            lines: [
              'Company: Foshan Xinghang Trading Co., Ltd.',
              'Address: Room 9E-1-B456, No. 121 Fenjiang Middle Road, Zumiao Subdistrict, Chancheng District, Foshan, Guangdong, China.',
            ],
          },
        ],
      },
      {
        title: '12. Annex: Region-Specific Supplements',
        blocks: [
          {
            type: 'ul',
            items: [
              'EEA and UK: we rely on contract performance, legitimate interests, and legal obligations, and use SCCs where needed.',
              'United States: we do not sell personal data or share it for cross-context behavioral advertising; Illinois face-geometry data is generally destroyed within 24 hours.',
              'Brazil: LGPD rights include confirmation, access, correction, and withdrawal of consent.',
              'Singapore: we comply with the PDPA and require comparable overseas protection.',
              'South Korea: personal data is destroyed after the collection purpose is fulfilled unless retention is legally required.',
            ],
          },
        ],
      },
    ],
  },
  ja: {
    metadataTitle: 'プライバシーポリシー',
    metadataDescription: 'Miri のプライバシーポリシー。顔画像、AI 出力、データ処理と保存期間について説明します。',
    kicker: 'ポリシー',
    title: 'プライバシーポリシー',
    effectiveDate: '施行日: 2026年1月19日',
    lastUpdated: '最終更新日: 2026年1月19日',
    sections: [
      {
        title: '1. はじめに',
        blocks: [
          {
            type: 'p',
            text:
              '本プライバシーポリシーは、佛山市星航貿易有限公司が提供・管理する Miri モバイルアプリ、Web サイト、および関連サービスに適用されます。個人データをどのように収集、利用、共有、処理するかを説明します。',
          },
          {
            type: 'p',
            text:
              '当社の運営主体は中国にありますが、ユーザーコンテンツや顔関連データなどの主要な個人データは、シンガポールおよびその他の法域にある安全なサーバーで処理・保存される場合があります。',
          },
        ],
      },
      {
        title: '2. 取得する情報',
        blocks: [
          { type: 'h3', text: '2.1 お客様が提供する情報' },
          {
            type: 'ul',
            items: [
              'ユーザーコンテンツ: アップロードした写真、画像、生成結果、入力したプロンプトなど。',
              'お問い合わせ情報: サポート、フィードバック、問い合わせ時に提供される内容。',
              'アカウント情報: 登録時のユーザー名、メールアドレス、第三者ログイン情報。',
            ],
          },
          { type: 'h3', text: '2.2 自動的に取得する情報' },
          {
            type: 'ul',
            items: [
              '技術データ: 端末モデル、OS バージョン、システム言語、端末識別子、IP アドレスなど。',
              '利用データ: 機能利用状況、利用時間、クラッシュログ、編集アクティビティなど。',
            ],
          },
          { type: 'h3', text: '2.3 他の提供元から受け取る情報' },
          {
            type: 'p',
            text:
              'Apple、Google などの第三者アカウントでログインする場合、当該サービスが共有を許可したプロフィール情報を受け取ることがあります。',
          },
        ],
      },
      {
        title: '3. 情報の利用目的',
        blocks: [
          {
            type: 'ul',
            items: [
              '画像編集、Liquify、AI 生成などのサービスを提供・運営するため。',
              '顔の形状やランドマーク情報を機能提供のためにのみ処理するため。本人確認には使用しません。',
              '集計または匿名化した形で製品改善、バグ修正、新機能開発を行うため。',
              '不正利用、攻撃、悪用、その他の安全・セキュリティ問題を検知するため。',
              '法令、規制、コンプライアンス上の義務を果たすため。',
            ],
          },
        ],
      },
      {
        title: '4. 情報の共有',
        blocks: [
          { type: 'p', text: '当社は個人データを販売しません。必要な情報は次の場合にのみ共有されます。' },
          { type: 'h3', text: '4.1 サービス提供事業者' },
          {
            type: 'ul',
            items: [
              'AWS シンガポール、Google Cloud シンガポールなどのクラウド基盤事業者。',
              'BytePlus およびその関連会社などの AI 推論パートナー。独自学習への利用は認めません。',
            ],
          },
          { type: 'h3', text: '4.2 法的義務' },
          {
            type: 'p',
            text:
              '法令遵守、利用規約の執行、ユーザー・公衆・当社の安全と権利の保護のために必要と合理的に判断した場合、情報を開示することがあります。',
          },
          { type: 'h3', text: '4.3 事業譲渡' },
          {
            type: 'p',
            text:
              '合併、再編、破産、資産売却などが行われる場合、情報が取引の一部として移転されることがあります。',
          },
        ],
      },
      {
        title: '5. 国際データ移転',
        blocks: [
          {
            type: 'p',
            text:
              '個人データは主にシンガポールに保存されますが、米国を含む委託先所在国で処理される場合があります。必要に応じて標準契約条項などの保護措置を講じます。',
          },
        ],
      },
      {
        title: '6. 保存期間',
        blocks: [
          {
            type: 'ul',
            items: [
              'ユーザーコンテンツおよび顔関連データは、通常、処理完了後 24 時間以内にクラウドから削除されます。',
              '利用ログや技術データは、サービス改善、紛争対応、法的義務履行に必要な期間のみ保持されます。',
            ],
          },
        ],
      },
      {
        title: '7. セキュリティ',
        blocks: [
          {
            type: 'p',
            text:
              '通信中および保存時の暗号化を含む管理的・技術的・物理的対策により、不正アクセス、紛失、改ざん、濫用のリスク低減に努めます。ただし、インターネット上で絶対的な安全性は保証できません。',
          },
        ],
      },
      {
        title: '8. お客様の権利',
        blocks: [
          {
            type: 'ul',
            items: [
              'アクセス権: 当社が保有する個人データの内容を知る権利。',
              '削除権: 個人データの削除を求める権利。',
              '訂正権: 不正確または不完全なデータの訂正を求める権利。',
              '同意撤回権: 同意に基づく処理について撤回する権利。',
            ],
          },
          { type: 'p', text: 'これらの権利を行使する場合は、以下までご連絡ください。' },
          { type: 'contact', label: 'メール', value: 'support@miriai.app', href: 'mailto:support@miriai.app' },
        ],
      },
      {
        title: '9. 子どものプライバシー',
        blocks: [
          {
            type: 'p',
            text:
              '本サービスは 13 歳未満、またはお住まいの地域でより高い年齢要件がある場合はその年齢未満の方を対象としていません。該当データを取得したことが判明した場合は削除します。',
          },
        ],
      },
      {
        title: '10. ポリシーの更新',
        blocks: [
          {
            type: 'p',
            text:
              '本ポリシーは随時更新される場合があります。重要な変更がある場合は、このページ上部の日付更新やアプリ内通知などでお知らせします。',
          },
        ],
      },
      {
        title: '11. お問い合わせ',
        blocks: [
          { type: 'contact', label: 'メール', value: 'support@miriai.app', href: 'mailto:support@miriai.app' },
          { type: 'lines', lines: ['会社名: 佛山市星航貿易有限公司', '住所: 中国広東省佛山市禅城区祖廟街道汾江中路 121 号 9E-1-B456。'] },
        ],
      },
      {
        title: '12. 付録: 地域別補足事項',
        blocks: [
          {
            type: 'ul',
            items: [
              'EEA/英国: 契約履行、正当な利益、法的義務を根拠とし、必要に応じて SCC を利用します。',
              '米国: 個人データの販売やクロスコンテキスト広告目的の共有は行いません。イリノイ州の顔形状データは通常 24 時間以内に破棄されます。',
              'ブラジル: LGPD に基づく確認、アクセス、訂正、同意撤回の権利があります。',
              'シンガポール: PDPA を遵守し、海外移転先にも同等水準の保護を求めます。',
              '韓国: 収集目的達成後、法令で必要な場合を除き速やかに個人データを破棄します。',
            ],
          },
        ],
      },
    ],
  },
};

const termsDocuments: Record<LanguageCode, LegalDocument> = {
  zh: {
    metadataTitle: '服务条款',
    metadataDescription: 'Miri 服务条款：了解 AI 面部模拟服务的使用范围、免责声明与计费规则。',
    kicker: '政策文件',
    title: '服务条款',
    effectiveDate: '生效日期：2026 年 1 月 19 日',
    lastUpdated: '最后更新：2026 年 1 月 19 日',
    sections: [
      {
        title: '1. 条款接受',
        blocks: [
          {
            type: 'p',
            text:
              '欢迎使用 Miri。本条款适用于你对 Miri 移动应用、网站以及相关 AI 功能与服务的访问和使用。只要你创建账号、访问或使用服务，即表示你已阅读、理解并同意受本条款约束。',
          },
        ],
      },
      {
        title: '2. 服务与条款的变更',
        blocks: [
          {
            type: 'ul',
            items: [
              '我们保留随时修改、更新、暂停或终止服务任何部分的权利，包括新增 AI 功能、调整算法和引入付费层级。',
              '本条款适用于当前和未来功能，除非我们为特定新功能另行提供独立协议。',
              '如果条款发生重大变更，我们会通过应用内通知等方式提醒你。继续使用即视为接受更新后的条款。',
            ],
          },
        ],
      },
      {
        title: '3. 访问与使用',
        blocks: [
          {
            type: 'ul',
            items: [
              '你应至少达到所在地区要求的最低使用年龄；若未满 18 岁，应在监护人同意下使用。',
              '在遵守本条款前提下，我们授予你有限的、非独占、不可转让、可撤销的个人非商业使用许可。',
            ],
          },
        ],
      },
      {
        title: '4. 输入与输出（AI 内容）',
        blocks: [
          {
            type: 'ul',
            items: [
              '输入：你上传、输入或提交到服务中的文本、图片、视频、音频及其他数据。',
              '输出：服务基于输入生成的图片、文本、修改结果或其他内容。',
              '你保留对输入内容的权利，并保证你有合法授权提交该内容。',
              '你授予我们及第三方服务商为提供服务、排查问题和履行法律义务所必需的使用许可。',
              'AI 输出可能不唯一，也可能不准确、令人不适或不符合现实。你应自行判断输出的适用性。',
            ],
          },
        ],
      },
      {
        title: '5. 禁止行为',
        blocks: [
          {
            type: 'ul',
            items: [
              '违反适用法律法规。',
              '生成、上传淫秽、诽谤、仇恨、暴力或其他有害内容。',
              '制作误导性深度伪造、冒充他人或散布虚假信息。',
              '逆向工程、提取模型、算法、源代码或参数。',
              '使用爬虫、机器人或自动化工具访问服务。',
              '干扰服务完整性、性能或第三方数据。',
            ],
          },
        ],
      },
      {
        title: '6. 免责声明：非医疗建议',
        blocks: [
          {
            type: 'p',
            text:
              '本服务仅用于娱乐、创意和视觉参考。液化、重塑或 AI 生成功能均不构成医疗、外科或审美建议，也不保证现实中的可实现效果。',
          },
          {
            type: 'p',
            text:
              '你不应依赖输出内容做出整形、医疗治疗或健康相关决定。对于基于服务输出作出的医疗或手术决策，我们明确不承担责任。',
          },
        ],
      },
      {
        title: '7. 知识产权',
        blocks: [
          {
            type: 'ul',
            items: [
              '服务本身，包括界面、软件代码、模型、标识与品牌，归佛山市星航贸易有限公司及其许可方所有。',
              '服务中可能接入第三方模型或 API，你对相关功能的使用也需遵守第三方适用条款。',
            ],
          },
        ],
      },
      {
        title: '8. 费用、积分与订阅',
        blocks: [
          {
            type: 'ul',
            items: [
              '部分基础功能可免费使用，但可能附带水印、广告或分辨率限制。',
              'AI 生成功能主要基于积分计费。不同任务可能对应不同积分消耗。',
              '积分、点数或代币通常不可退款、不可转让，除非法律另有规定。',
              '未来若推出订阅方案，订阅并不意味着 AI 生成无限次，部分任务仍可能消耗积分。',
              '所有通过 App Store、Google Play 或其他渠道完成的购买，除法律或平台退款规则另有规定外，均为最终交易。',
            ],
          },
        ],
      },
      {
        title: '9. 赔偿责任',
        blocks: [
          {
            type: 'p',
            text:
              '若因你使用服务、违反本条款、提交的输入内容，或你基于输出内容作出医疗或手术决定而引发索赔、损失、责任或费用，你同意对我们及关联方进行赔偿并使其免责。',
          },
        ],
      },
      {
        title: '10. 责任限制',
        blocks: [
          {
            type: 'p',
            text:
              '在法律允许的最大范围内，我们不对任何间接、附带、特殊、后果性或惩罚性损害承担责任，包括利润损失和数据损失。就任何索赔而言，我们的总责任不超过你在过去 12 个月向我们支付的金额或 50 美元，以较高者为准。',
          },
        ],
      },
      {
        title: '11. 适用法律与争议解决',
        blocks: [
          {
            type: 'p',
            text:
              '本条款受中华人民共和国法律管辖。因本条款产生的争议，提交至中国广东省佛山市禅城区有管辖权的法院专属管辖。',
          },
        ],
      },
      {
        title: '12. 联系我们',
        blocks: [
          { type: 'contact', label: '邮箱', value: 'support@miriai.app', href: 'mailto:support@miriai.app' },
          { type: 'lines', lines: ['公司：佛山市星航贸易有限公司'] },
        ],
      },
    ],
  },
  'zh-TW': {
    metadataTitle: '服務條款',
    metadataDescription: 'Miri 服務條款：了解 AI 臉部模擬服務的使用範圍、免責聲明與計費規則。',
    kicker: '政策文件',
    title: '服務條款',
    effectiveDate: '生效日期：2026 年 1 月 19 日',
    lastUpdated: '最後更新：2026 年 1 月 19 日',
    sections: [
      {
        title: '1. 條款接受',
        blocks: [
          {
            type: 'p',
            text:
              '歡迎使用 Miri。本條款適用於你對 Miri 行動應用、網站以及相關 AI 功能與服務的存取和使用。只要你建立帳號、存取或使用服務，即表示你已閱讀、理解並同意受本條款拘束。',
          },
        ],
      },
      {
        title: '2. 服務與條款變更',
        blocks: [
          {
            type: 'ul',
            items: [
              '我們保留隨時修改、更新、暫停或終止服務任何部分的權利，包括新增 AI 功能、調整演算法與引入付費層級。',
              '本條款適用於目前與未來功能，除非我們就特定功能另行提供獨立協議。',
              '若條款有重大更新，我們會透過 App 內通知等方式提醒你。繼續使用即視為接受更新後的條款。',
            ],
          },
        ],
      },
      {
        title: '3. 存取與使用',
        blocks: [
          {
            type: 'ul',
            items: [
              '你應至少達到所在地法規要求的最低年齡；未滿 18 歲者應在監護人同意下使用。',
              '在遵守本條款前提下，我們授予你有限、非專屬、不可轉讓且可撤銷的個人非商業使用授權。',
            ],
          },
        ],
      },
      {
        title: '4. 輸入與輸出（AI 內容）',
        blocks: [
          {
            type: 'ul',
            items: [
              '輸入：你上傳、輸入或提交到服務中的文字、圖片、影片、音訊與其他資料。',
              '輸出：服務根據輸入生成的圖片、文字、修改結果或其他內容。',
              '你保有輸入內容的權利，並保證你有合法授權提交該內容。',
              '你授予我們及第三方服務供應商為提供服務、排查問題與履行法律義務所需的使用授權。',
              'AI 輸出可能不具唯一性，也可能不準確、令人不適或不符合現實，你應自行判斷是否採用。',
            ],
          },
        ],
      },
      {
        title: '5. 禁止行為',
        blocks: [
          {
            type: 'ul',
            items: [
              '違反適用法律法規。',
              '生成或上傳猥褻、誹謗、仇恨、暴力或其他有害內容。',
              '製作誤導性的深偽、冒充他人或散播不實資訊。',
              '逆向工程、擷取模型、演算法、原始碼或參數。',
              '使用爬蟲、機器人或自動化工具存取服務。',
              '干擾服務完整性、效能或第三方資料。',
            ],
          },
        ],
      },
      {
        title: '6. 免責聲明：非醫療建議',
        blocks: [
          {
            type: 'p',
            text:
              '本服務僅供娛樂、創意與視覺參考用途。液化、重塑或 AI 生成功能均不構成醫療、外科或美學建議，也不保證現實中的可達成效果。',
          },
          {
            type: 'p',
            text:
              '你不應依賴輸出內容做出整形、醫療治療或健康相關決定。對於基於服務輸出所作出的醫療或手術決策，我們明確不承擔責任。',
          },
        ],
      },
      {
        title: '7. 智慧財產權',
        blocks: [
          {
            type: 'ul',
            items: [
              '服務本身，包括介面、軟體程式碼、模型、標誌與品牌，均屬佛山市星航貿易有限公司及其授權方所有。',
              '服務可能整合第三方模型或 API，你使用相關功能時亦須遵守第三方適用條款。',
            ],
          },
        ],
      },
      {
        title: '8. 費用、點數與訂閱',
        blocks: [
          {
            type: 'ul',
            items: [
              '部分基礎功能可免費使用，但可能附帶浮水印、廣告或解析度限制。',
              'AI 生成功能主要採點數制，不同任務可能對應不同點數消耗。',
              '點數、代幣或虛擬項目通常不可退款、不可轉讓，除非法律另有規定。',
              '若未來推出訂閱方案，訂閱不代表 AI 生成功能可無限制使用，部分任務仍可能消耗點數。',
              '透過 App Store、Google Play 或其他渠道完成的購買，除法律或平台退款規則另有規定外，均屬最終交易。',
            ],
          },
        ],
      },
      {
        title: '9. 賠償責任',
        blocks: [
          {
            type: 'p',
            text:
              '若因你使用服務、違反本條款、提交的輸入內容，或你依據輸出內容作出醫療或手術決策而導致索賠、損失、責任或費用，你同意賠償並使我們及關係企業免受損害。',
          },
        ],
      },
      {
        title: '10. 責任限制',
        blocks: [
          {
            type: 'p',
            text:
              '在法律允許的最大範圍內，我們不對任何間接、附帶、特殊、衍生或懲罰性損害負責，包括利潤損失與資料損失。對任何索賠，我們的總責任不超過你過去 12 個月支付給我們的金額或 50 美元，以較高者為準。',
          },
        ],
      },
      {
        title: '11. 準據法與爭議解決',
        blocks: [
          {
            type: 'p',
            text:
              '本條款受中華人民共和國法律管轄。因本條款所生爭議，提交至中國廣東省佛山市禪城區有管轄權之法院專屬管轄。',
          },
        ],
      },
      {
        title: '12. 聯絡我們',
        blocks: [
          { type: 'contact', label: '電子郵件', value: 'support@miriai.app', href: 'mailto:support@miriai.app' },
          { type: 'lines', lines: ['公司：佛山市星航貿易有限公司'] },
        ],
      },
    ],
  },
  en: {
    metadataTitle: 'Terms of Service',
    metadataDescription: 'Miri Terms of Service: learn about the scope, disclaimer, and billing rules of our AI face preview service.',
    kicker: 'Policies',
    title: 'Terms of Service',
    effectiveDate: 'Effective Date: January 19, 2026',
    lastUpdated: 'Last Updated: January 19, 2026',
    sections: [
      {
        title: '1. Acceptance of Terms',
        blocks: [
          {
            type: 'p',
            text:
              'These Terms govern your access to and use of the Miri mobile app, website, and related AI-powered features. By creating an account, accessing, or using the Services, you agree to be bound by these Terms.',
          },
        ],
      },
      {
        title: '2. Changes to Services and Terms',
        blocks: [
          {
            type: 'ul',
            items: [
              'We may modify, update, suspend, or discontinue any part of the Services at any time, including adding new AI features or paid tiers.',
              'These Terms apply to current and future features unless a separate agreement is provided for a specific feature.',
              'If we make material changes, we may notify you in the app. Continued use means acceptance of the updated Terms.',
            ],
          },
        ],
      },
      {
        title: '3. Access and Use',
        blocks: [
          {
            type: 'ul',
            items: [
              'You must meet the minimum age required in your jurisdiction; if you are under 18, you must have parental or guardian permission.',
              'Subject to compliance with these Terms, we grant you a limited, non-exclusive, non-transferable, revocable license for personal, non-commercial use.',
            ],
          },
        ],
      },
      {
        title: '4. Input and Output (AI Content)',
        blocks: [
          {
            type: 'ul',
            items: [
              'Input means text, images, audio, video, and other data you upload or submit.',
              'Output means content generated by the Services based on your Input.',
              'You retain rights in your Input and represent that you have authority to submit it.',
              'You grant us and our service providers the rights necessary to operate the Services, troubleshoot issues, and comply with law.',
              'AI Output may not be unique and may be inaccurate, offensive, or unrealistic. You are responsible for evaluating it before use.',
            ],
          },
        ],
      },
      {
        title: '5. Prohibited Conduct',
        blocks: [
          {
            type: 'ul',
            items: [
              'Violating applicable law.',
              'Generating or uploading obscene, defamatory, hateful, violent, or otherwise harmful content.',
              'Creating deceptive deepfakes, impersonation content, or misinformation.',
              'Reverse engineering models, algorithms, source code, or parameters.',
              'Using bots, scrapers, or automated tools to access the Services.',
              'Interfering with the integrity or performance of the Services or third-party data.',
            ],
          },
        ],
      },
      {
        title: '6. Disclaimer: No Medical Advice',
        blocks: [
          {
            type: 'p',
            text:
              'The Services are provided for entertainment, creative exploration, and visual reference only. Liquify, reshaping, or AI-generated outputs are not medical, surgical, or aesthetic advice and do not guarantee real-world results.',
          },
          {
            type: 'p',
            text:
              'You must not rely on the Output when making decisions about surgery, treatment, or health. We disclaim liability for medical or surgical decisions made based on the Services.',
          },
        ],
      },
      {
        title: '7. Intellectual Property',
        blocks: [
          {
            type: 'ul',
            items: [
              'The Services, including interface, software code, models, logos, and branding, are owned by Foshan Xinghang Trading Co., Ltd. or its licensors.',
              'Some features may rely on third-party models or APIs, and your use of those features is also subject to the terms of those third parties.',
            ],
          },
        ],
      },
      {
        title: '8. Fees, Credits, and Subscriptions',
        blocks: [
          {
            type: 'ul',
            items: [
              'Some basic features may be free but may include watermarks, ads, or resolution limits.',
              'AI generation mainly operates on a credit-based system, and different tasks may consume different amounts of credits.',
              'Credits, points, or tokens are generally non-refundable and non-transferable unless required by law.',
              'If subscription plans are introduced in the future, they do not necessarily include unlimited AI generation.',
              'Purchases made through app stores or other channels are final except where refund rights are required by law or platform policy.',
            ],
          },
        ],
      },
      {
        title: '9. Indemnification',
        blocks: [
          {
            type: 'p',
            text:
              'You agree to indemnify and hold us harmless from claims, losses, liabilities, and expenses arising out of your use of the Services, your violation of these Terms, your Input, or medical or surgical decisions made in reliance on Output.',
          },
        ],
      },
      {
        title: '10. Limitation of Liability',
        blocks: [
          {
            type: 'p',
            text:
              'To the fullest extent permitted by law, we are not liable for indirect, incidental, special, consequential, or punitive damages, including lost profits or data. Our total liability for any claim will not exceed the greater of the amount you paid us in the previous 12 months or USD 50.',
          },
        ],
      },
      {
        title: '11. Governing Law and Dispute Resolution',
        blocks: [
          {
            type: 'p',
            text:
              "These Terms are governed by the laws of the People's Republic of China. Any dispute arising from these Terms shall be submitted to the courts with jurisdiction in Chancheng District, Foshan, Guangdong, China.",
          },
        ],
      },
      {
        title: '12. Contact Us',
        blocks: [
          { type: 'contact', label: 'Email', value: 'support@miriai.app', href: 'mailto:support@miriai.app' },
          { type: 'lines', lines: ['Company: Foshan Xinghang Trading Co., Ltd.'] },
        ],
      },
    ],
  },
  ja: {
    metadataTitle: '利用規約',
    metadataDescription: 'Miri 利用規約。AI 顔プレビューサービスの利用範囲、免責事項、課金ルールを説明します。',
    kicker: 'ポリシー',
    title: '利用規約',
    effectiveDate: '施行日: 2026年1月19日',
    lastUpdated: '最終更新日: 2026年1月19日',
    sections: [
      {
        title: '1. 規約への同意',
        blocks: [
          {
            type: 'p',
            text:
              '本規約は、Miri モバイルアプリ、Web サイト、および関連する AI 機能へのアクセスと利用に適用されます。アカウント作成、アクセス、利用のいずれかを行った時点で、本規約に同意したものとみなされます。',
          },
        ],
      },
      {
        title: '2. サービスおよび規約の変更',
        blocks: [
          {
            type: 'ul',
            items: [
              '当社は、新機能の追加、アルゴリズム変更、有料プラン導入を含め、サービスの全部または一部をいつでも変更、更新、停止、終了する権利を有します。',
              '本規約は現在および将来の機能にも適用されます。特定機能に別規約がある場合はその内容が優先されます。',
              '重要な変更がある場合はアプリ内通知などで案内することがあります。継続利用は更新後規約への同意を意味します。',
            ],
          },
        ],
      },
      {
        title: '3. アクセスと利用',
        blocks: [
          {
            type: 'ul',
            items: [
              'お客様は居住地域の最低年齢要件を満たしている必要があります。18 歳未満の場合は保護者の許可が必要です。',
              '本規約を遵守する限り、当社は個人的かつ非商用目的に限り、限定的・非独占的・譲渡不可・取消可能な利用権を付与します。',
            ],
          },
        ],
      },
      {
        title: '4. 入力と出力（AI コンテンツ）',
        blocks: [
          {
            type: 'ul',
            items: [
              '入力とは、お客様がアップロードまたは送信するテキスト、画像、音声、動画、その他のデータを指します。',
              '出力とは、入力に基づいてサービスが生成するコンテンツを指します。',
              '入力に関する権利はお客様に帰属し、適法に提出する権限があることを保証していただきます。',
              'サービス提供、障害対応、法令遵守のために必要な範囲で、当社および委託先に利用権が付与されます。',
              'AI 出力は一意でない場合があり、不正確、不快、または非現実的な場合もあります。利用判断はお客様自身の責任です。',
            ],
          },
        ],
      },
      {
        title: '5. 禁止行為',
        blocks: [
          {
            type: 'ul',
            items: [
              '適用法令への違反。',
              'わいせつ、中傷、憎悪、暴力、その他有害なコンテンツの生成または投稿。',
              '誤認を招くディープフェイク、なりすまし、虚偽情報の作成。',
              'モデル、アルゴリズム、ソースコード、パラメータのリバースエンジニアリング。',
              'ボット、スクレイパー、自動化ツールによるアクセス。',
              'サービスの完全性、性能、第三者データへの妨害。',
            ],
          },
        ],
      },
      {
        title: '6. 免責事項: 医療アドバイスではありません',
        blocks: [
          {
            type: 'p',
            text:
              '本サービスは娯楽、クリエイティブ検討、視覚参考のために提供されます。Liquify、変形、AI 出力は医療・外科・美容上の助言ではなく、現実結果を保証するものでもありません。',
          },
          {
            type: 'p',
            text:
              '手術、治療、健康に関する判断を出力に依拠して行わないでください。サービス出力に基づく医療・外科判断について当社は責任を負いません。',
          },
        ],
      },
      {
        title: '7. 知的財産',
        blocks: [
          {
            type: 'ul',
            items: [
              'サービス、UI、ソフトウェアコード、モデル、ロゴ、ブランドは佛山市星航貿易有限公司またはそのライセンサーに帰属します。',
              '一部機能は第三者のモデルや API を利用する場合があり、その利用には当該第三者の条件も適用されます。',
            ],
          },
        ],
      },
      {
        title: '8. 料金、クレジット、サブスクリプション',
        blocks: [
          {
            type: 'ul',
            items: [
              '一部の基本機能は無料で利用できますが、透かし、広告、解像度制限が付く場合があります。',
              'AI 生成は主にクレジット制で提供され、機能により消費量が異なる場合があります。',
              'クレジット、ポイント、トークンは、法令で別途定めがある場合を除き、通常返金不可・譲渡不可です。',
              '将来サブスクリプションを提供する場合でも、AI 生成が無制限になるとは限りません。',
              'アプリストア等を通じた購入は、法令またはプラットフォームの返金ルールを除き、原則として確定取引です。',
            ],
          },
        ],
      },
      {
        title: '9. 補償',
        blocks: [
          {
            type: 'p',
            text:
              'お客様のサービス利用、本規約違反、入力内容、または出力に依拠した医療・外科判断に起因して生じる請求、損害、責任、費用について、お客様は当社および関連当事者を補償することに同意します。',
          },
        ],
      },
      {
        title: '10. 責任の制限',
        blocks: [
          {
            type: 'p',
            text:
              '法令で認められる最大限の範囲で、当社は逸失利益やデータ損失を含む間接的、付随的、特別、結果的、懲罰的損害について責任を負いません。当社の総責任額は、過去 12 か月にお客様が当社へ支払った金額または 50 米ドルのいずれか高い方を上限とします。',
          },
        ],
      },
      {
        title: '11. 準拠法と紛争解決',
        blocks: [
          {
            type: 'p',
            text:
              '本規約は中華人民共和国法に準拠します。本規約に起因する紛争は、中国広東省佛山市禅城区の管轄裁判所に専属的に付託されます。',
          },
        ],
      },
      {
        title: '12. お問い合わせ',
        blocks: [
          { type: 'contact', label: 'メール', value: 'support@miriai.app', href: 'mailto:support@miriai.app' },
          { type: 'lines', lines: ['会社名: 佛山市星航貿易有限公司'] },
        ],
      },
    ],
  },
};

const accountDeletionDocuments: Record<LanguageCode, LegalDocument> = {
  zh: {
    metadataTitle: '账号与数据删除申请',
    metadataDescription: 'Miri 账号与数据删除指引：通过邮箱发起删除请求并了解可删除与保留的数据范围。',
    kicker: '账号支持',
    title: '账号与数据删除申请',
    sections: [
      {
        title: '如何申请删除',
        blocks: [
          {
            type: 'ol',
            items: [
              '使用与你的 Miriai 账号绑定的邮箱发送邮件至 support@miriai.app，或在邮件中明确写明绑定邮箱。',
              '只有来自绑定邮箱的请求，或能充分证明账号归属的请求，才会被处理。',
              '邮件中请写明账号邮箱、应用名称（Miriai / Miri）以及你希望删除账号和相关数据的明确说明。',
            ],
          },
          { type: 'p', text: '我们会人工审核申请，并在删除完成后通过邮件通知你。' },
        ],
      },
      {
        title: '会被删除的数据',
        blocks: [
          {
            type: 'ul',
            items: [
              '账号标识信息，例如邮箱、用户名和资料信息。',
              '与你账号相关联的已存储用户内容和生成结果。',
              '与你账号关联的客服沟通记录。',
            ],
          },
        ],
      },
      {
        title: '可能保留的数据',
        blocks: [
          {
            type: 'ul',
            items: [
              '出于法律、税务或会计目的必须保留的支付与交易记录。',
              '为保护用户和服务安全而保留的安全、反欺诈与审计日志。',
              '无法识别到个人身份的聚合或匿名化分析数据。',
            ],
          },
          {
            type: 'p',
            text:
              '保留期限仅以适用法律要求或合理合规义务为限，不会在此基础上额外延长。',
          },
        ],
      },
    ],
  },
  'zh-TW': {
    metadataTitle: '帳號與資料刪除申請',
    metadataDescription: 'Miri 帳號與資料刪除指引：透過電子郵件發起刪除請求並了解可刪除與保留的資料範圍。',
    kicker: '帳號支援',
    title: '帳號與資料刪除申請',
    sections: [
      {
        title: '如何申請刪除',
        blocks: [
          {
            type: 'ol',
            items: [
              '請使用與 Miriai 帳號綁定的電子郵件寄信到 support@miriai.app，或在信中明確寫出綁定信箱。',
              '只有來自綁定信箱的請求，或能充分證明帳號歸屬的請求，才會受理。',
              '郵件中請提供帳號信箱、App 名稱（Miriai / Miri）以及希望刪除帳號與相關資料的明確說明。',
            ],
          },
          { type: 'p', text: '我們會人工審核你的請求，並在刪除完成後以電子郵件通知你。' },
        ],
      },
      {
        title: '將被刪除的資料',
        blocks: [
          {
            type: 'ul',
            items: [
              '帳號識別資料，例如電子郵件、使用者名稱與個人資料。',
              '與帳號相關的已儲存使用者內容與生成結果。',
              '與帳號綁定的客服溝通紀錄。',
            ],
          },
        ],
      },
      {
        title: '可能保留的資料',
        blocks: [
          {
            type: 'ul',
            items: [
              '因法律、稅務或會計義務而必須保留的付款與交易紀錄。',
              '為保護使用者與服務安全而保留的安全、反詐欺與稽核日誌。',
              '無法識別個人身份的彙總或匿名化分析資料。',
            ],
          },
          {
            type: 'p',
            text:
              '保留期間僅限於適用法律要求或合理合規義務所需時間，不會額外延長。',
          },
        ],
      },
    ],
  },
  en: {
    metadataTitle: 'Account Deletion Request',
    metadataDescription: 'Miri account and data deletion guide: request deletion by email and learn which data may be deleted or retained.',
    kicker: 'Account Support',
    title: 'Account & Data Deletion Request',
    sections: [
      {
        title: 'How to Request Deletion',
        blocks: [
          {
            type: 'ol',
            items: [
              'Email support@miriai.app from the email address linked to your Miriai account, or clearly include the linked address in your request.',
              'Only requests from the linked email account, or requests with sufficient ownership proof, will be processed.',
              'Please include your account email, the app name (Miriai / Miri), and a clear statement that you want the account and related data deleted.',
            ],
          },
          { type: 'p', text: 'We will review the request manually and notify you by email once deletion is complete.' },
        ],
      },
      {
        title: 'Data That Will Be Deleted',
        blocks: [
          {
            type: 'ul',
            items: [
              'Account identifiers such as email, username, and profile details.',
              'Stored user content and generated outputs associated with your account.',
              'Support communications linked to your account.',
            ],
          },
        ],
      },
      {
        title: 'Data That May Be Retained',
        blocks: [
          {
            type: 'ul',
            items: [
              'Payment and transaction records required for legal, tax, or accounting purposes.',
              'Security, anti-fraud, and audit logs needed to protect users and the service.',
              'Aggregated or anonymized analytics that do not identify you.',
            ],
          },
          {
            type: 'p',
            text:
              'Retention lasts only as long as required by applicable law or legitimate compliance obligations. We do not keep additional copies beyond those requirements.',
          },
        ],
      },
    ],
  },
  ja: {
    metadataTitle: 'アカウントとデータ削除申請',
    metadataDescription: 'Miri のアカウント削除ガイド。メールで削除申請を行う方法と、削除・保持されるデータの範囲を案内します。',
    kicker: 'アカウントサポート',
    title: 'アカウントとデータ削除申請',
    sections: [
      {
        title: '削除申請の方法',
        blocks: [
          {
            type: 'ol',
            items: [
              'Miriai アカウントに紐づくメールアドレスから support@miriai.app へメールを送るか、申請文内に紐づくメールアドレスを明記してください。',
              '紐づくメールアドレスからの申請、またはアカウント所有を十分に証明できる申請のみ受理します。',
              'メールにはアカウントのメールアドレス、アプリ名（Miriai / Miri）、およびアカウントと関連データの削除を希望する旨を明確に記載してください。',
            ],
          },
          { type: 'p', text: '申請は手動で確認し、削除完了後にメールでお知らせします。' },
        ],
      },
      {
        title: '削除されるデータ',
        blocks: [
          {
            type: 'ul',
            items: [
              'メールアドレス、ユーザー名、プロフィール情報などのアカウント識別情報。',
              'アカウントに関連づく保存済みユーザーコンテンツと生成結果。',
              'アカウントに紐づくサポート対応履歴。',
            ],
          },
        ],
      },
      {
        title: '保持される可能性があるデータ',
        blocks: [
          {
            type: 'ul',
            items: [
              '法務、税務、会計上の理由で保存が必要な支払い・取引記録。',
              'ユーザーとサービスを保護するために必要なセキュリティ、反不正、監査ログ。',
              '個人を特定しない集計済みまたは匿名化された分析データ。',
            ],
          },
          {
            type: 'p',
            text:
              '保持期間は、適用法令または正当なコンプライアンス義務に必要な期間に限られ、それを超えて追加保存することはありません。',
          },
        ],
      },
    ],
  },
};

export const getPrivacyDocument = (language: LanguageCode) => privacyDocuments[language] ?? privacyDocuments.en;
export const getTermsDocument = (language: LanguageCode) => termsDocuments[language] ?? termsDocuments.en;
export const getAccountDeletionDocument = (language: LanguageCode) =>
  accountDeletionDocuments[language] ?? accountDeletionDocuments.en;
