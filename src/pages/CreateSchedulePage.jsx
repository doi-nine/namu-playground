import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useIsMobile } from '../hooks/useIsMobile';

export default function CreateSchedulePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const isMobile = useIsMobile();
  const maxAllowed = profile?.is_premium ? 100 : 20;

  const [mode, setMode] = useState('manual');
  const [form, setForm] = useState({
    title: '',
    datetime: '',
    location_type: 'offline',
    location: '',
    online_link: '',
    max_members: 10,
    description: '',
  });
  const [focusedInput, setFocusedInput] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // AI 관련 state
  const [aiInput, setAiInput] = useState('');
  const [aiResult, setAiResult] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiError, setAiError] = useState('');

  // AI 사용 횟수 (무료 유저 월 3회 제한)
  const AI_MONTHLY_LIMIT = 3;
  const getAIUsageKey = () => {
    const now = new Date();
    return `ai_schedule_uses_${user?.id}_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  };
  const [aiUsedCount, setAiUsedCount] = useState(0);

  useEffect(() => {
    if (user?.id) {
      const count = parseInt(localStorage.getItem(getAIUsageKey()) || '0', 10);
      setAiUsedCount(count);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const isPremium = !!profile?.is_premium;
  const aiRemaining = isPremium ? null : Math.max(0, AI_MONTHLY_LIMIT - aiUsedCount);
  const isAILimitReached = !isPremium && aiUsedCount >= AI_MONTHLY_LIMIT;

  const inputStyle = (name) => ({
    width: '100%',
    padding: '12px 16px',
    border: '1px solid',
    borderColor: focusedInput === name ? 'var(--button-primary)' : 'rgba(0,0,0,0.08)',
    borderRadius: '12px',
    backgroundColor: 'rgba(255,255,255,0.6)',
    color: 'var(--text-primary)',
    outline: 'none',
    fontSize: '14px',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    boxShadow: focusedInput === name ? '0 0 0 3px rgba(107,144,128,0.15)' : 'none',
  });

  const segmentBtnStyle = (isActive) => ({
    flex: 1,
    padding: '10px 0',
    borderRadius: '10px',
    fontWeight: '500',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s',
    backgroundColor: isActive ? 'var(--button-primary)' : 'rgba(0,0,0,0.04)',
    color: isActive ? '#FFFFFF' : 'var(--text-secondary)',
    fontSize: '14px',
  });

  const toggleBtnStyle = (isActive) => ({
    flex: 1,
    padding: '12px 0',
    borderRadius: '10px',
    fontWeight: '600',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s',
    backgroundColor: isActive ? 'var(--button-primary)' : 'transparent',
    color: isActive ? '#FFFFFF' : 'var(--text-muted)',
    fontSize: '14px',
  });

  const handleAIGenerate = async () => {
    if (!aiInput.trim()) {
      setAiError('어떤 일정인지 입력해주세요.');
      return;
    }
    if (isAILimitReached) {
      setAiError('이번 달 무료 AI 생성 횟수(3회)를 모두 사용했습니다.');
      return;
    }
    setIsGenerating(true);
    setAiError('');
    try {
      const now = new Date();
      const currentDate = now.toISOString().slice(0, 10);
      const { data, error } = await supabase.functions.invoke('ai-generate-schedule', {
        body: { prompt: aiInput, currentDate },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.title || !data?.description) throw new Error('AI가 일정 정보를 생성하지 못했습니다.');

      // 사용 횟수 증가
      if (!isPremium) {
        const newCount = aiUsedCount + 1;
        localStorage.setItem(getAIUsageKey(), String(newCount));
        setAiUsedCount(newCount);
      }

      setAiResult(data);
      setForm(prev => ({
        ...prev,
        title: data.title || '',
        description: data.description || '',
        ...(data.datetime ? { datetime: data.datetime } : {}),
      }));
    } catch (err) {
      console.error('AI 생성 오류:', err);
      setAiError('AI 생성 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.title.trim()) { alert('일정 제목을 입력해주세요.'); return; }
    if (!form.datetime) { alert('날짜와 시간을 선택해주세요.'); return; }
    if (form.location_type === 'offline' && !form.location.trim()) { alert('오프라인 장소를 입력해주세요.'); return; }

    setSubmitting(true);
    try {
      const { data: newSchedule, error: scheduleError } = await supabase
        .from('schedules')
        .insert([{
          gathering_id: id,
          created_by: user.id,
          title: form.title.trim(),
          description: form.description.trim() || null,
          datetime: new Date(form.datetime).toISOString(),
          location_type: form.location_type,
          location: form.location_type === 'offline' ? form.location.trim() : null,
          online_link: form.location_type === 'online' ? form.online_link.trim() : null,
          max_members: parseInt(form.max_members),
          current_members: 1,
        }])
        .select()
        .single();

      if (scheduleError) throw scheduleError;

      // 생성자 자동 참여
      await supabase
        .from('schedule_members')
        .insert([{ schedule_id: newSchedule.id, user_id: user.id, status: 'approved' }]);

      // 모임 승인 멤버들에게 일정 생성 알림 전송 (생성자 제외)
      const { data: gatheringMembers } = await supabase
        .from('gathering_members')
        .select('user_id')
        .eq('gathering_id', id)
        .eq('status', 'approved')
        .neq('user_id', user.id);

      if (gatheringMembers && gatheringMembers.length > 0) {
        await supabase.from('notifications').insert(
          gatheringMembers.map(m => ({
            user_id: m.user_id,
            type: 'schedule_created',
            gathering_id: id,
            related_user_id: user.id,
          }))
        );
      }

      navigate(`/gatherings/${id}`, { state: { tab: 'schedules' } });
    } catch (err) {
      console.error('일정 생성 오류:', err);
      alert('일정 생성 중 오류가 발생했습니다: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // 공통 폼 필드 (datetime, location, max_members)
  const renderFormFields = () => (
    <>
      {/* 날짜 및 시간 */}
      <div className="glass-strong" style={{ borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: 'var(--text-primary)' }}>날짜 및 시간 *</label>
          <input
            type="datetime-local"
            value={form.datetime}
            onChange={(e) => setForm(prev => ({ ...prev, datetime: e.target.value }))}
            style={inputStyle('datetime')}
            onFocus={() => setFocusedInput('datetime')}
            onBlur={() => setFocusedInput(null)}
          />
        </div>
      </div>

      {/* 장소 */}
      <div className="glass-strong" style={{ borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: 'var(--text-primary)' }}>장소 타입 *</label>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <button type="button" onClick={() => setForm(prev => ({ ...prev, location_type: 'offline' }))} style={segmentBtnStyle(form.location_type === 'offline')}>오프라인</button>
            <button type="button" onClick={() => setForm(prev => ({ ...prev, location_type: 'online' }))} style={segmentBtnStyle(form.location_type === 'online')}>온라인</button>
          </div>
          {form.location_type === 'offline' ? (
            <input
              type="text"
              placeholder="예) 강남역 스타벅스"
              value={form.location}
              onChange={(e) => setForm(prev => ({ ...prev, location: e.target.value }))}
              style={inputStyle('location')}
              onFocus={() => setFocusedInput('location')}
              onBlur={() => setFocusedInput(null)}
            />
          ) : (
            <input
              type="url"
              placeholder="예) https://discord.gg/..."
              value={form.online_link}
              onChange={(e) => setForm(prev => ({ ...prev, online_link: e.target.value }))}
              style={inputStyle('online_link')}
              onFocus={() => setFocusedInput('online_link')}
              onBlur={() => setFocusedInput(null)}
            />
          )}
        </div>
      </div>

      {/* 인원 */}
      <div className="glass-strong" style={{ borderRadius: '16px', padding: '24px' }}>
        <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: 'var(--text-primary)' }}>최대 인원: {form.max_members}명</label>
        <input
          type="range"
          min="2"
          max={maxAllowed}
          value={Math.min(form.max_members, maxAllowed)}
          onChange={(e) => setForm(prev => ({ ...prev, max_members: Number(e.target.value) }))}
          style={{ width: '100%', height: '8px', borderRadius: '8px', appearance: 'none', cursor: 'pointer', accentColor: 'var(--button-primary)' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>2명</span>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{maxAllowed}명</span>
        </div>
        {!profile?.is_premium && (
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
            무료 이용자는 최대 20명까지 모집 가능합니다.{' '}
            <button
              type="button"
              onClick={() => navigate('/premium')}
              style={{ background: 'none', border: 'none', padding: 0, fontSize: '12px', color: 'var(--button-primary)', cursor: 'pointer', fontWeight: '600', textDecoration: 'underline' }}
            >
              프리미엄 업그레이드
            </button>
          </p>
        )}
      </div>
    </>
  );

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: isMobile ? '12px 4px 100px' : '32px 24px 100px', ...(isMobile ? { width: '97%' } : {}) }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px' }}>
        <button
          onClick={() => navigate(`/gatherings/${id}`, { state: { tab: 'schedules' } })}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px 8px',
            borderRadius: '8px',
            fontSize: '20px',
            color: 'var(--button-primary)',
            display: 'flex',
            alignItems: 'center',
            transition: 'background-color 0.2s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(107,144,128,0.1)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          ‹
        </button>
        <h1 style={{ fontSize: '24px', fontWeight: '700', margin: 0, color: 'var(--button-primary)' }}>
          새 일정 추가
        </h1>
      </div>

      {/* 모드 토글 */}
      <div className="glass" style={{ display: 'flex', gap: '6px', marginBottom: '24px', padding: '5px', borderRadius: '14px' }}>
        <button onClick={() => setMode('manual')} style={toggleBtnStyle(mode === 'manual')}>직접 만들기</button>
        <button onClick={() => setMode('ai')} style={toggleBtnStyle(mode === 'ai')}>AI로 만들기</button>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* ─── 직접 만들기 ─── */}
        {mode === 'manual' && (
          <div className="glass-strong" style={{ borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: 'var(--text-primary)' }}>제목 *</label>
              <input
                type="text"
                placeholder="일정 제목을 입력하세요"
                value={form.title}
                onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
                style={inputStyle('title')}
                onFocus={() => setFocusedInput('title')}
                onBlur={() => setFocusedInput(null)}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: 'var(--text-primary)' }}>설명 (선택)</label>
              <textarea
                placeholder="일정에 대한 추가 설명을 입력하세요"
                value={form.description}
                onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                rows={4}
                style={{ ...inputStyle('description'), resize: 'none' }}
                onFocus={() => setFocusedInput('description')}
                onBlur={() => setFocusedInput(null)}
              />
            </div>
          </div>
        )}

        {/* ─── AI로 만들기 ─── */}
        {mode === 'ai' && (
          <>
            {/* AI 입력 */}
            <div className="glass-strong" style={{ borderRadius: '16px', padding: '24px' }}>
              <h2 style={{ fontWeight: '600', fontSize: '15px', color: 'var(--text-primary)', marginBottom: '12px' }}>
                어떤 일정을 만들고 싶으신가요?
              </h2>
              <textarea
                placeholder="예) 토요일 오후 카탄 보드게임, 초보 환영"
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                rows={4}
                style={{ ...inputStyle('aiInput'), resize: 'none' }}
                onFocus={() => setFocusedInput('aiInput')}
                onBlur={() => setFocusedInput(null)}
              />
              {aiError && (
                <p style={{ fontSize: '13px', color: 'var(--danger)', marginTop: '8px' }}>{aiError}</p>
              )}
              <div style={{ position: 'relative', marginTop: '14px' }}>
                {/* 남은 횟수 뱃지 (무료 유저만) */}
                {!isPremium && (
                  <div style={{
                    position: 'absolute',
                    top: '-10px',
                    right: '0',
                    backgroundColor: aiRemaining === 0 ? 'var(--danger, #e53e3e)' : 'var(--button-primary)',
                    color: '#FFFFFF',
                    borderRadius: '20px',
                    padding: '2px 9px',
                    fontSize: '11px',
                    fontWeight: '700',
                    zIndex: 1,
                    pointerEvents: 'none',
                  }}>
                    이번 달 {aiRemaining}회 남음
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleAIGenerate}
                  disabled={isGenerating || isAILimitReached}
                  style={{
                    width: '100%',
                    backgroundColor: (isGenerating || isAILimitReached) ? 'rgba(0,0,0,0.04)' : '#FFFFFF',
                    color: (isGenerating || isAILimitReached) ? 'var(--text-muted)' : 'var(--button-primary)',
                    padding: '14px 0',
                    borderRadius: '12px',
                    fontWeight: '600',
                    border: (isGenerating || isAILimitReached) ? '1.5px solid rgba(0,0,0,0.1)' : '1.5px solid var(--button-primary)',
                    cursor: (isGenerating || isAILimitReached) ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                    fontSize: '15px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                  onMouseEnter={(e) => { if (!isGenerating && !isAILimitReached) e.currentTarget.style.backgroundColor = 'rgba(107,144,128,0.06)'; }}
                  onMouseLeave={(e) => { if (!isGenerating && !isAILimitReached) e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
                >
                  {isGenerating ? (
                    <>
                      <div style={{
                        width: '16px', height: '16px',
                        border: '2px solid rgba(0,0,0,0.1)', borderTop: '2px solid var(--button-primary)',
                        borderRadius: '50%', animation: 'spin 0.8s linear infinite',
                      }} />
                      생성 중...
                    </>
                  ) : isAILimitReached ? '이번 달 사용 횟수 소진' : 'AI로 만들기'}
                </button>
              </div>
            </div>

            {/* AI 결과 - 수정 가능 */}
            {aiResult && (
              <div className="glass-strong" style={{ borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <h2 style={{ fontWeight: '600', fontSize: '15px', color: 'var(--button-primary)', margin: 0 }}>
                  AI가 만든 내용 (수정 가능)
                </h2>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: 'var(--text-primary)' }}>제목</label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
                    style={inputStyle('aiTitle')}
                    onFocus={() => setFocusedInput('aiTitle')}
                    onBlur={() => setFocusedInput(null)}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: 'var(--text-primary)' }}>설명</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                    rows={4}
                    style={{ ...inputStyle('aiDescription'), resize: 'none' }}
                    onFocus={() => setFocusedInput('aiDescription')}
                    onBlur={() => setFocusedInput(null)}
                  />
                </div>
              </div>
            )}
          </>
        )}

        {/* 공통 필드: 날짜·장소·인원 (AI 모드는 결과 나온 후에만 표시) */}
        {(mode === 'manual' || aiResult) && renderFormFields()}

        {/* 제출 버튼 */}
        {(mode === 'manual' || aiResult) && (
          <button
            type="submit"
            disabled={submitting}
            style={{
              width: '100%',
              padding: '16px 0',
              backgroundColor: submitting ? 'rgba(0,0,0,0.12)' : 'var(--button-primary)',
              color: '#FFFFFF',
              borderRadius: '14px',
              fontWeight: '700',
              fontSize: '16px',
              border: 'none',
              cursor: submitting ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s',
              marginTop: '8px',
            }}
            onMouseEnter={(e) => { if (!submitting) e.currentTarget.style.backgroundColor = 'var(--button-primary-hover)'; }}
            onMouseLeave={(e) => { if (!submitting) e.currentTarget.style.backgroundColor = 'var(--button-primary)'; }}
          >
            {submitting ? '추가 중...' : '일정 추가하기'}
          </button>
        )}
      </form>
    </div>
  );
}
