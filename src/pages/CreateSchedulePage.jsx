import { useState } from 'react';
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

      navigate(`/gatherings/${id}`, { state: { tab: 'schedules' } });
    } catch (err) {
      console.error('일정 생성 오류:', err);
      alert('일정 생성 중 오류가 발생했습니다: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: isMobile ? '12px 4px 100px' : '32px 24px 100px', ...(isMobile ? { width: '93%' } : {}) }}>
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

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* 제목 */}
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

        {/* 인원 & 설명 */}
        <div className="glass-strong" style={{ borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
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

        {/* 제출 버튼 */}
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
      </form>
    </div>
  );
}
