import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const GAME_PRESETS = {
  mafia: {
    name: '🔫 마피아',
    getRoles: (total) => {
      const mafia = Math.max(2, Math.floor(total / 4));
      const police = 1;
      const doctor = 1;
      const citizens = total - mafia - police - doctor;
      return [
        { name: '마피아', count: mafia, color: '#ef4444' },
        { name: '경찰', count: police, color: '#3b82f6' },
        { name: '의사', count: doctor, color: '#10b981' },
        { name: '시민', count: citizens, color: '#6b7280' }
      ];
    }
  },
  liar: {
    name: '🕵️ 라이어',
    getRoles: (total) => [
      { name: '라이어', count: 1, color: '#ef4444' },
      { name: '시민', count: total - 1, color: '#6b7280' }
    ]
  },
  cops: {
    name: '👮 경찰과 도둑',
    getRoles: (total) => {
      const half = Math.floor(total / 2);
      return [
        { name: '경찰', count: half, color: '#3b82f6' },
        { name: '도둑', count: total - half, color: '#ef4444' }
      ];
    }
  },
  teams: {
    name: '🎲 팀 나누기',
    getRoles: (total) => {
      const half = Math.floor(total / 2);
      return [
        { name: 'A팀', count: half, color: '#3b82f6' },
        { name: 'B팀', count: total - half, color: '#ef4444' }
      ];
    }
  },
  tagger: {
    name: '🎯 술래',
    getRoles: (total) => [
      { name: '술래', count: 1, color: '#ef4444' },
      { name: '플레이어', count: total - 1, color: '#6b7280' }
    ]
  }
};

const ROLE_COLORS = ['#ef4444', '#3b82f6', '#10b981', '#eab308', '#a855f7'];

export default function RandomDrawer({ gatheringId, members, isCreator }) {
  const [step, setStep] = useState('setup');
  const [totalPeople, setTotalPeople] = useState(members?.length || 6);
  const [slots, setSlots] = useState([
    { id: 1, name: '역할 1', count: 3, color: '#ef4444' },
    { id: 2, name: '역할 2', count: 3, color: '#3b82f6' }
  ]);
  const [myResult, setMyResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  const totalAssigned = slots.reduce((sum, slot) => sum + slot.count, 0);

  useEffect(() => {
    fetchUser();
    checkExistingResult();
  }, []);

  const fetchUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
  };

  const checkExistingResult = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !gatheringId) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('drawing_results')
        .select('*')
        .eq('gathering_id', gatheringId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setMyResult(data);
        setStep('result');
      }
    } catch (error) {
      console.error('기존 결과 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyPreset = (presetKey) => {
    const preset = GAME_PRESETS[presetKey];
    const roles = preset.getRoles(totalPeople);
    setSlots(roles.map((role, idx) => ({
      id: idx + 1,
      name: role.name,
      count: role.count,
      color: role.color
    })));
  };

  const addSlot = () => {
    if (slots.length >= 5) return;
    const newColor = ROLE_COLORS[slots.length % ROLE_COLORS.length];
    setSlots([...slots, {
      id: Date.now(),
      name: `역할 ${slots.length + 1}`,
      count: 1,
      color: newColor
    }]);
  };

  const removeSlot = (id) => {
    if (slots.length <= 1) return;
    setSlots(slots.filter(s => s.id !== id));
  };

  const updateSlot = (id, field, value) => {
    setSlots(slots.map(s =>
      s.id === id ? { ...s, [field]: value } : s
    ));
  };

  const startDrawing = async () => {
    if (!isCreator) {
      alert('모임장만 추첨을 시작할 수 있습니다.');
      return;
    }

    if (totalAssigned !== members.length) {
      alert(`총 인원(${members.length}명)과 배정 인원(${totalAssigned}명)이 일치하지 않습니다.`);
      return;
    }

    if (!confirm('추첨을 시작하시겠습니까? 모든 참가자에게 역할이 배정됩니다.')) {
      return;
    }

    try {
      setLoading(true);

      const pool = [];
      slots.forEach((slot) => {
        const slotColor = slot.color || '#6b7280';
        for (let i = 0; i < slot.count; i++) {
          pool.push({ role: slot.name, color: slotColor });
        }
      });

      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }

      const { error: deleteError } = await supabase
        .from('drawing_results')
        .delete()
        .eq('gathering_id', gatheringId);

      if (deleteError) throw deleteError;

      const results = members.map((member, idx) => ({
        gathering_id: gatheringId,
        user_id: member.user_id,
        role: pool[idx].role,
        color: pool[idx].color
      }));

      const { error: insertError } = await supabase
        .from('drawing_results')
        .insert(results);

      if (insertError) throw insertError;

      alert('추첨이 완료되었습니다! 각자 결과를 확인하세요.');
      await checkExistingResult();

    } catch (error) {
      console.error('추첨 실패:', error);
      alert('추첨 중 오류가 발생했습니다: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const resetDrawing = async () => {
    if (!isCreator) {
      alert('모임장만 추첨을 초기화할 수 있습니다.');
      return;
    }

    if (!confirm('추첨 결과를 초기화하시겠습니까?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('drawing_results')
        .delete()
        .eq('gathering_id', gatheringId);

      if (error) throw error;

      setMyResult(null);
      setStep('setup');
      alert('추첨이 초기화되었습니다.');
    } catch (error) {
      console.error('초기화 실패:', error);
      alert('초기화 중 오류가 발생했습니다.');
    }
  };

  const inputStyle = {
    padding: '10px 12px',
    border: '1px solid rgba(0,0,0,0.08)',
    borderRadius: '8px',
    fontSize: '14px',
    color: 'var(--text-primary)',
    backgroundColor: 'rgba(255,255,255,0.6)',
    outline: 'none',
    boxSizing: 'border-box'
  };

  if (loading) {
    return (
      <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
        로딩 중...
      </div>
    );
  }

  // 결과 화면
  if (step === 'result' && myResult) {
    return (
      <div className="glass-strong" style={{
        padding: '48px 24px',
        borderRadius: '16px',
        textAlign: 'center'
      }}>
        <h2 style={{
          fontSize: '24px',
          fontWeight: '700',
          color: 'var(--text-primary)',
          marginBottom: '40px'
        }}>
          🎲 당신의 역할
        </h2>

        <div style={{
          maxWidth: '280px',
          margin: '0 auto 40px',
          padding: '40px 24px',
          background: myResult.color,
          borderRadius: '20px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)'
        }}>
          <div style={{
            fontSize: '40px',
            fontWeight: '700',
            color: '#fff',
            marginBottom: '8px'
          }}>
            {myResult.role}
          </div>
        </div>

        <div style={{
          padding: '14px',
          background: 'rgba(255,255,255,0.5)',
          borderRadius: '10px',
          fontSize: '13px',
          color: 'var(--text-muted)',
          marginBottom: '24px',
          border: '1px solid rgba(0,0,0,0.06)'
        }}>
          ⚠️ 다른 사람에게 역할을 공개하지 마세요!
        </div>

        {isCreator && (
          <button
            onClick={resetDrawing}
            style={{
              padding: '12px 24px',
              background: 'var(--danger)',
              color: '#fff',
              border: 'none',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            🔄 추첨 초기화 (모임장 전용)
          </button>
        )}
      </div>
    );
  }

  // 설정 화면
  if (step === 'setup') {
    return (
      <div className="glass-strong" style={{
        padding: '24px',
        borderRadius: '16px'
      }}>
        <h2 style={{
          fontSize: '20px',
          fontWeight: '700',
          color: 'var(--text-primary)',
          marginBottom: '20px'
        }}>
          🎲 랜덤 추첨기
        </h2>

        {!isCreator && (
          <div style={{
            padding: '14px',
            background: 'rgba(220,38,38,0.06)',
            borderRadius: '10px',
            fontSize: '13px',
            color: 'var(--danger)',
            marginBottom: '20px',
            textAlign: 'center',
            border: '1px solid rgba(220,38,38,0.1)'
          }}>
            ⚠️ 모임장만 추첨을 시작할 수 있습니다.<br/>
            모임장이 추첨을 시작하면 결과를 확인할 수 있습니다.
          </div>
        )}

        <div style={{ marginBottom: '20px' }}>
          <label style={{
            display: 'block',
            fontSize: '13px',
            fontWeight: '600',
            color: 'var(--text-secondary)',
            marginBottom: '6px'
          }}>
            참가 인원: {members?.length || 0}명
          </label>
        </div>

        {isCreator && (
          <>
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: '600',
                color: 'var(--text-secondary)',
                marginBottom: '8px'
              }}>
                게임 프리셋
              </label>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                gap: '8px'
              }}>
                {Object.entries(GAME_PRESETS).map(([key, preset]) => (
                  <button
                    key={key}
                    onClick={() => applyPreset(key)}
                    style={{
                      padding: '10px',
                      background: 'rgba(255,255,255,0.5)',
                      border: '1px solid rgba(0,0,0,0.06)',
                      borderRadius: '8px',
                      color: 'var(--text-primary)',
                      fontSize: '13px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      fontWeight: '500'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--button-primary)';
                      e.currentTarget.style.color = '#FFFFFF';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.5)';
                      e.currentTarget.style.color = 'var(--text-primary)';
                    }}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '8px'
              }}>
                <label style={{
                  fontSize: '13px',
                  fontWeight: '600',
                  color: 'var(--text-secondary)'
                }}>
                  역할 설정 (최대 5개)
                </label>
                <button
                  onClick={addSlot}
                  disabled={slots.length >= 5}
                  style={{
                    padding: '6px 12px',
                    background: slots.length >= 5 ? 'rgba(0,0,0,0.04)' : 'var(--button-primary)',
                    color: slots.length >= 5 ? 'var(--text-muted)' : '#FFFFFF',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: slots.length >= 5 ? 'not-allowed' : 'pointer'
                  }}
                >
                  + 추가
                </button>
              </div>

              {slots.map((slot) => (
                <div
                  key={slot.id}
                  style={{
                    display: 'flex',
                    gap: '8px',
                    marginBottom: '8px',
                    alignItems: 'center'
                  }}
                >
                  <div style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: slot.color,
                    flexShrink: 0
                  }} />
                  <input
                    type="text"
                    value={slot.name}
                    onChange={(e) => updateSlot(slot.id, 'name', e.target.value)}
                    placeholder="역할 이름"
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <input
                    type="number"
                    min="1"
                    value={slot.count}
                    onChange={(e) => updateSlot(slot.id, 'count', Math.max(1, parseInt(e.target.value) || 1))}
                    style={{ ...inputStyle, width: '70px', textAlign: 'center' }}
                  />
                  <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>명</span>
                  {slots.length > 1 && (
                    <button
                      onClick={() => removeSlot(slot.id)}
                      style={{
                        padding: '8px 12px',
                        background: 'var(--danger)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '13px'
                      }}
                    >
                      삭제
                    </button>
                  )}
                </div>
              ))}

              <div style={{
                marginTop: '12px',
                padding: '12px',
                background: totalAssigned === members.length ? 'rgba(107,144,128,0.15)' : 'rgba(220,38,38,0.06)',
                borderRadius: '8px',
                fontSize: '13px',
                color: totalAssigned === members.length ? 'var(--button-primary)' : 'var(--danger)',
                textAlign: 'center',
                fontWeight: '500'
              }}>
                배정 인원: {totalAssigned}명 / 참가 인원: {members.length}명
                {totalAssigned !== members.length && (
                  <div style={{ marginTop: '4px', fontSize: '12px' }}>
                    인원이 일치하지 않습니다!
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={startDrawing}
              disabled={totalAssigned !== members.length}
              style={{
                width: '100%',
                padding: '14px',
                background: totalAssigned === members.length ? 'var(--button-primary)' : 'rgba(0,0,0,0.04)',
                color: totalAssigned === members.length ? '#FFFFFF' : 'var(--text-muted)',
                border: 'none',
                borderRadius: '12px',
                fontSize: '15px',
                fontWeight: '700',
                cursor: totalAssigned === members.length ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s'
              }}
            >
              🎲 추첨 시작하기
            </button>
          </>
        )}
      </div>
    );
  }
}
