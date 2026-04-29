-- 创建用户扩展表 (Supabase Auth已提供基础用户表)
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(100),
    avatar_url TEXT,
    credits INTEGER DEFAULT 0,
    free_uses_remaining INTEGER DEFAULT 1,
    daily_usage INTEGER DEFAULT 0,
    last_usage_reset DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建积分交易表
CREATE TABLE credit_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('purchase', 'consume')),
    amount INTEGER NOT NULL,
    stripe_payment_id VARCHAR(255),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建图片表
CREATE TABLE images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    original_url TEXT NOT NULL,
    original_filename VARCHAR(255),
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    file_size INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建画布会话表
CREATE TABLE canvas_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    image_id UUID REFERENCES images(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    session_data JSONB NOT NULL,
    current_step INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建AI编辑表
CREATE TABLE ai_edits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    canvas_session_id UUID REFERENCES canvas_sessions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    prompt TEXT NOT NULL,
    mask_data TEXT NOT NULL,
    result_url TEXT,
    gemini_response TEXT,
    processing_time DECIMAL(5,2),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    credits_used INTEGER DEFAULT 1,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- 创建索引
CREATE INDEX idx_user_profiles_credits ON user_profiles(credits);
CREATE INDEX idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX idx_credit_transactions_created_at ON credit_transactions(created_at);
CREATE INDEX idx_images_user_id ON images(user_id);
CREATE INDEX idx_images_created_at ON images(created_at);
CREATE INDEX idx_canvas_sessions_image_id ON canvas_sessions(image_id);
CREATE INDEX idx_canvas_sessions_user_id ON canvas_sessions(user_id);
CREATE INDEX idx_ai_edits_canvas_session_id ON ai_edits(canvas_session_id);
CREATE INDEX idx_ai_edits_user_id ON ai_edits(user_id);
CREATE INDEX idx_ai_edits_status ON ai_edits(status);

-- 启用行级安全 (RLS)
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE images ENABLE ROW LEVEL SECURITY;
ALTER TABLE canvas_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_edits ENABLE ROW LEVEL SECURITY;

-- 创建RLS策略
-- 用户只能访问自己的数据
CREATE POLICY "Users can view own profile" ON user_profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON user_profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can view own transactions" ON credit_transactions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own images" ON images
    FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can insert images" ON images
    FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can view own canvas sessions" ON canvas_sessions
    FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can manage own canvas sessions" ON canvas_sessions
    FOR ALL USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can view own AI edits" ON ai_edits
    FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can insert AI edits" ON ai_edits
    FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- 授予权限
GRANT SELECT ON user_profiles TO anon;
GRANT ALL PRIVILEGES ON user_profiles TO authenticated;

GRANT SELECT ON credit_transactions TO anon;
GRANT ALL PRIVILEGES ON credit_transactions TO authenticated;

GRANT SELECT ON images TO anon;
GRANT ALL PRIVILEGES ON images TO authenticated;

GRANT SELECT ON canvas_sessions TO anon;
GRANT ALL PRIVILEGES ON canvas_sessions TO authenticated;

GRANT SELECT ON ai_edits TO anon;
GRANT ALL PRIVILEGES ON ai_edits TO authenticated;

-- 创建触发器函数来自动更新updated_at字段
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为需要的表创建触发器
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_canvas_sessions_updated_at BEFORE UPDATE ON canvas_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 创建用户注册时自动创建profile的触发器
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (id, name, avatar_url)
    VALUES (NEW.id, NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'avatar_url');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();