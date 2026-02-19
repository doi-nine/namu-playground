-- 일정 후기 테이블
CREATE TABLE IF NOT EXISTS schedule_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gathering_id uuid NOT NULL REFERENCES gatherings(id) ON DELETE CASCADE,
  schedule_id uuid NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  q1_mood text NOT NULL,
  q2_again text NOT NULL,
  q3_oneliner text NOT NULL,
  ai_summary text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(schedule_id, user_id)
);

-- RLS 활성화
ALTER TABLE schedule_reviews ENABLE ROW LEVEL SECURITY;

-- SELECT: 누구나
CREATE POLICY "schedule_reviews_select" ON schedule_reviews
  FOR SELECT USING (true);

-- INSERT: 본인만
CREATE POLICY "schedule_reviews_insert" ON schedule_reviews
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- UPDATE: 본인만
CREATE POLICY "schedule_reviews_update" ON schedule_reviews
  FOR UPDATE USING (auth.uid() = user_id);

-- DELETE: 본인만
CREATE POLICY "schedule_reviews_delete" ON schedule_reviews
  FOR DELETE USING (auth.uid() = user_id);
