-- 创建游客设备指纹表，用于限制免费次数滥用
CREATE TABLE IF NOT EXISTS guest_devices (
    fingerprint TEXT PRIMARY KEY,
    free_uses_remaining INTEGER NOT NULL DEFAULT 3,
    total_used INTEGER NOT NULL DEFAULT 0,
    blocked BOOLEAN NOT NULL DEFAULT FALSE,
    last_consumed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 更新时间戳触发器函数（如未存在则创建）
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_guest_devices_timestamp
    BEFORE UPDATE ON guest_devices
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE guest_devices ENABLE ROW LEVEL SECURITY;

-- 游客需要在未登录情况下访问，允许匿名角色读写（可结合业务逻辑进一步限制）
CREATE POLICY "Guests can read own record"
    ON guest_devices
    FOR SELECT
    USING (true);

CREATE POLICY "Guests can insert own record"
    ON guest_devices
    FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Guests can update own record"
    ON guest_devices
    FOR UPDATE
    USING (true);

GRANT SELECT, INSERT, UPDATE ON guest_devices TO anon;
GRANT ALL ON guest_devices TO authenticated;
