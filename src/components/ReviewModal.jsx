import { useState } from 'react';
import { supabase } from '../lib/supabase';

const MOOD_OPTIONS = ['좋았어요', '보통이에요', '아쉬웠어요'];
const AGAIN_OPTIONS = ['또 올게요', '고민해볼게요', '아쉬웠어요'];

export default function ReviewModal({ isOpen, onClose, schedule, gatheringId, onSaved }) {
  const [step, setStep] = useState('questions');
  const [q1Mood, setQ1Mood] = useState('');
  const [q2Again, setQ2Again] = useState('');
  const [q3Oneliner, setQ3Oneliner] = useState('');
  const [aiSummary, setAiSummary] = useState('');
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!isOpen || !schedule) return null;

  const canGenerate = q1Mood && q2Again && q3Oneliner.trim();

  const handleGenerateSummary = async () => {
    if (!canGenerate) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-generate-review', {
        body: {
          schedule_title: schedule.title,
          q1_mood: q1Mood,
          q2_again: q2Again,
          q3_oneliner: q3Oneliner.trim(),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setAiSummary(data.summary || '');
      setStep('summary');
    } catch (err) {
      alert('AI 요약 생성 중 오류가 발생했습니다: ' + err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!aiSummary.trim()) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('로그인이 필요합니다.');

      const { error } = await supabase.from('schedule_reviews').insert({
        gathering_id: gatheringId,
        schedule_id: schedule.id,
        user_id: user.id,
        q1_mood: q1Mood,
        q2_again: q2Again,
        q3_oneliner: q3Oneliner.trim(),
        ai_summary: aiSummary.trim(),
      });
      if (error) throw error;

      onSaved?.();
      handleClose();
    } catch (err) {
      alert('후기 저장 중 오류가 발생했습니다: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setStep('questions');
    setQ1Mood('');
    setQ2Again('');
    setQ3Oneliner('');
    setAiSummary('');
    onClose();
  };

  const renderOptionButtons = (options, selected, onSelect) => (
    <div style={{ display: 'flex', gap: '8px' }}>
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onSelect(opt)}
          style={{
            flex: 1,
            padding: '10px 0',
            fontSize: '13px',
            fontWeight: '600',
            borderRadius: '10px',
            cursor: 'pointer',
            transition: 'all 0.15s',
            backgroundColor: selected === opt ? 'var(--button-primary)' : 'rgba(0,0,0,0.04)',
            color: selected === opt ? 'white' : 'var(--text-secondary)',
            border: selected === opt ? 'none' : '1px solid rgba(0,0,0,0.08)',
          }}
        >
          {opt}
        </button>
      ))}
    </div>
  );

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        backgroundColor: 'rgba(0,0,0,0.5)',
        padding: '24px',
      }}
      onClick={handleClose}
    >
      <div
        className="glass-strong"
        style={{
          width: '100%',
          maxWidth: '500px',
          borderRadius: '20px',
          padding: '28px',
          maxHeight: '80vh',
          overflowY: 'auto',
          backgroundColor: 'var(--card-bg, #fff)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '4px', color: 'var(--text-primary)' }}>
          일정 후기 작성
        </h3>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
          {schedule.title}
        </p>

        {step === 'questions' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Q1 */}
            <div>
              <p style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '10px' }}>
                오늘 일정 분위기는 어땠나요?
              </p>
              {renderOptionButtons(MOOD_OPTIONS, q1Mood, setQ1Mood)}
            </div>

            {/* Q2 */}
            <div>
              <p style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '10px' }}>
                다음에 또 참여하고 싶으신가요?
              </p>
              {renderOptionButtons(AGAIN_OPTIONS, q2Again, setQ2Again)}
            </div>

            {/* Q3 */}
            <div>
              <p style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '10px' }}>
                한 줄로 표현한다면?
              </p>
              <input
                type="text"
                value={q3Oneliner}
                onChange={(e) => setQ3Oneliner(e.target.value)}
                placeholder="오늘 모임을 한 줄로 표현해주세요"
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  fontSize: '14px',
                  border: '1px solid rgba(0,0,0,0.1)',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(255,255,255,0.7)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            {/* AI 요약 생성 버튼 */}
            <button
              onClick={handleGenerateSummary}
              disabled={!canGenerate || generating}
              style={{
                width: '100%',
                padding: '14px 0',
                background: canGenerate && !generating ? 'var(--button-primary)' : 'rgba(0,0,0,0.06)',
                color: canGenerate && !generating ? 'white' : 'var(--text-muted)',
                borderRadius: '12px',
                fontWeight: '600',
                border: 'none',
                cursor: canGenerate && !generating ? 'pointer' : 'not-allowed',
                fontSize: '15px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              {generating ? (
                <>
                  <div style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid rgba(0,0,0,0.1)',
                    borderTop: '2px solid var(--text-muted)',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                  }} />
                  AI 요약 생성 중...
                </>
              ) : 'AI 요약 생성'}
            </button>

            <button
              onClick={handleClose}
              style={{
                width: '100%',
                padding: '12px 0',
                backgroundColor: 'rgba(0,0,0,0.06)',
                color: 'var(--text-secondary)',
                borderRadius: '12px',
                fontWeight: '500',
                border: 'none',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              닫기
            </button>
          </div>
        )}

        {step === 'summary' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <p style={{ fontSize: '12px', fontWeight: '600', color: 'var(--button-primary)', marginBottom: '8px' }}>
                AI 생성 후기 (수정 가능)
              </p>
              <textarea
                value={aiSummary}
                onChange={(e) => setAiSummary(e.target.value)}
                rows={4}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  fontSize: '14px',
                  border: '1px solid rgba(107,144,128,0.3)',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(107,144,128,0.06)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  resize: 'none',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                  lineHeight: '1.6',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleSave}
                disabled={!aiSummary.trim() || saving}
                style={{
                  flex: 1,
                  padding: '14px 0',
                  backgroundColor: aiSummary.trim() && !saving ? 'var(--button-primary)' : 'rgba(0,0,0,0.06)',
                  color: aiSummary.trim() && !saving ? 'white' : 'var(--text-muted)',
                  borderRadius: '12px',
                  fontWeight: '600',
                  border: 'none',
                  cursor: aiSummary.trim() && !saving ? 'pointer' : 'not-allowed',
                  fontSize: '15px',
                }}
              >
                {saving ? '저장 중...' : '저장'}
              </button>
              <button
                onClick={() => setStep('questions')}
                style={{
                  flex: 1,
                  padding: '14px 0',
                  backgroundColor: 'rgba(0,0,0,0.06)',
                  color: 'var(--text-secondary)',
                  borderRadius: '12px',
                  fontWeight: '500',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '15px',
                }}
              >
                다시 작성
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
