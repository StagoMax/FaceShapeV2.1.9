-- Create credit transactions table
CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('purchase', 'consume')),
  amount INTEGER NOT NULL,
  stripe_payment_id VARCHAR(255),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add credits column to user_profiles table if it doesn't exist
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS credits INTEGER DEFAULT 0;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_type ON credit_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON credit_transactions(created_at);

-- Enable Row Level Security (RLS)
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for credit_transactions
CREATE POLICY "Users can view their own credit transactions" ON credit_transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own credit transactions" ON credit_transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create function to update user credits automatically
CREATE OR REPLACE FUNCTION update_user_credits()
RETURNS TRIGGER AS $$
BEGIN
  -- Update user credits based on transaction
  UPDATE user_profiles 
  SET credits = credits + NEW.amount,
      updated_at = NOW()
  WHERE id = NEW.user_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update user credits
DROP TRIGGER IF EXISTS trigger_update_user_credits ON credit_transactions;
CREATE TRIGGER trigger_update_user_credits
  AFTER INSERT ON credit_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_user_credits();

-- Grant permissions to authenticated users
GRANT SELECT, INSERT ON credit_transactions TO authenticated;
GRANT SELECT, UPDATE ON user_profiles TO authenticated;

-- Grant permissions to anon users (for public access if needed)
GRANT SELECT ON credit_transactions TO anon;
GRANT SELECT ON user_profiles TO anon;

-- Create function to get user credit balance
CREATE OR REPLACE FUNCTION get_user_credit_balance(user_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
  credit_balance INTEGER;
BEGIN
  SELECT COALESCE(credits, 0) INTO credit_balance
  FROM user_profiles
  WHERE id = user_uuid;
  
  RETURN COALESCE(credit_balance, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to add daily free credits
CREATE OR REPLACE FUNCTION add_daily_free_credits(user_uuid UUID, credit_amount INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
  today_date DATE := CURRENT_DATE;
  existing_transaction_count INTEGER;
BEGIN
  -- Check if user already received daily credits today
  SELECT COUNT(*) INTO existing_transaction_count
  FROM credit_transactions
  WHERE user_id = user_uuid
    AND transaction_type = 'purchase'
    AND description LIKE 'Daily free credits - %'
    AND DATE(created_at) = today_date;
  
  -- If no daily credits claimed today, add them
  IF existing_transaction_count = 0 THEN
    INSERT INTO credit_transactions (user_id, transaction_type, amount, description)
    VALUES (user_uuid, 'purchase', credit_amount, 'Daily free credits - ' || today_date);
    
    RETURN TRUE;
  ELSE
    RETURN FALSE;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION get_user_credit_balance(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION add_daily_free_credits(UUID, INTEGER) TO authenticated;