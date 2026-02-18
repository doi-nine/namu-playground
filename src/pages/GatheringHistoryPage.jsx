import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useIsMobile } from '../hooks/useIsMobile';
import { Eye, EyeOff, Trash2 } from 'lucide-react';

export default function GatheringHistoryPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [history, setHistory] = useState([]);    // { gathering, status, is_private, is_deleted }
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchHistory();
  }, [user]);

  async function fetchHistory() {
    setLoading(true);
    try {
      // 가입한 모임 전체 조회 (상태 무관)
      const { data: members } = await supabase
        .from('gathering_members')
        .select('gathering_id, status, created_at')
        .eq('user_id', user.id);

      if (!members || members.length === 0) {
        setHistory([]);
        return;
      }

      const gatheringIds = members.map(m => m.gathering_id);

      // 모임 상세 조회
      const { data: gatherings } = await supabase
        .from('gatherings')
        .select('id, title, tags, creator_id')
        .in('id', gatheringIds);

      // 이력 설정 조회
      const { data: settings } = await supabase
        .from('gathering_history_settings')
        .select('gathering_id, is_private, is_deleted')
        .eq('user_id', user.id);

      const settingsMap = {};
      (settings || []).forEach(s => {
        settingsMap[s.gathering_id] = { is_private: s.is_private, is_deleted: s.is_deleted };
      });

      const gatheringMap = {};
      (gatherings || []).forEach(g => { gatheringMap[g.id] = g; });

      const merged = members
        .map(m => {
          const gathering = gatheringMap[m.gathering_id];
          if (!gathering) return null;
          const cfg = settingsMap[m.gathering_id] || { is_private: false, is_deleted: false };
          return {
            gathering_id: m.gathering_id,
            gathering,
            status: m.status,
            joined_at: m.created_at,
            is_private: cfg.is_private,
            is_deleted: cfg.is_deleted,
          };
        })
        .filter(Boolean)
        // 삭제된 항목 제외
        .filter(item => !item.is_deleted)
        // 최신 순
        .sort((a, b) => new Date(b.joined_at) - new Date(a.joined_at));

      setHistory(merged);
    } catch (err) {
      console.error('이력 조회 오류:', err);
    } finally {
      setLoading(false);
    }
  }

  async function upsertSetting(gatheringId, patch) {
    try {
      const { error } = await supabase
        .from('gathering_history_settings')
        .upsert({ user_id: user.id, gathering_id: gatheringId, ...patch }, { onConflict: 'user_id,gathering_id' });
      if (error) throw error;
    } catch (err) {
      console.error('설정 저장 오류:', err);
    }
  }

  async function handleTogglePrivate(item) {
    const newVal = !item.is_private;
    setHistory(prev =>
      prev.map(h => h.gathering_id === item.gathering_id ? { ...h, is_private: newVal } : h)
    );
    await upsertSetting(item.gathering_id, { is_private: newVal, is_deleted: item.is_deleted });
  }

  async function handleDelete(item) {
    if (!window.confirm('이 모임을 이력에서 삭제하시겠습니까?')) return;
    setHistory(prev => prev.filter(h => h.gathering_id !== item.gathering_id));
    await upsertSetting(item.gathering_id, { is_private: item.is_private, is_deleted: true });
  }

  const current = history.filter(h => h.status === 'approved');
  const past = history.filter(h => h.status !== 'approved');

  const statusLabel = (status) => {
    if (status === 'pending') return { text: '승인 대기', color: '#D97706' };
    if (status === 'kicked') return { text: '내보내짐', color: 'var(--danger)' };
    if (status === 'rejected') return { text: '거절됨', color: 'var(--danger)' };
    return { text: status, color: 'var(--text-muted)' };
  };

  const cardStyle = {
    background: 'rgba(255,255,255,0.7)',
    borderRadius: '12px',
    padding: '14px 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    border: '1px solid rgba(255,255,255,0.5)',
  };

  const SectionTitle = ({ label, count }) => (
    <div style={{
      fontSize: '13px', fontWeight: '600',
      color: 'var(--text-muted)', textTransform: 'uppercase',
      letterSpacing: '0.05em',
      marginBottom: '10px',
      display: 'flex', alignItems: 'center', gap: '6px',
    }}>
      {label}
      <span style={{
        background: 'rgba(107,144,128,0.15)',
        color: 'var(--button-primary)',
        borderRadius: '10px', padding: '1px 8px',
        fontSize: '12px', fontWeight: '700',
      }}>{count}</span>
    </div>
  );

  const HistoryCard = ({ item }) => (
    <div style={cardStyle}>
      {/* 왼쪽: 제목 + 뱃지 */}
      <div
        style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
        onClick={() => navigate(`/gatherings/${item.gathering_id}`)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{
            fontSize: '14px', fontWeight: '600',
            color: 'var(--button-primary)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            maxWidth: isMobile ? '160px' : '300px',
          }}>
            {item.gathering.title}
          </span>
          {item.is_private && (
            <span style={{
              fontSize: '11px', padding: '1px 7px', borderRadius: '8px',
              background: 'rgba(0,0,0,0.06)', color: 'var(--text-muted)',
              fontWeight: '500', flexShrink: 0,
            }}>비공개</span>
          )}
        </div>
        {item.gathering.tags?.length > 0 && (
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '6px' }}>
            {item.gathering.tags.slice(0, 3).map((tag, i) => (
              <span key={i} style={{
                fontSize: '11px', padding: '2px 8px', borderRadius: '8px',
                border: '1.5px solid #6B9080', color: '#6B9080',
                background: '#FFFFFF',
              }}>#{tag}</span>
            ))}
          </div>
        )}
      </div>

      {/* 오른쪽: 버튼들 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
        {/* 비공개 토글 */}
        <button
          onClick={() => handleTogglePrivate(item)}
          title={item.is_private ? '공개로 변경' : '비공개로 변경'}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '6px', borderRadius: '8px',
            display: 'flex', alignItems: 'center',
            color: item.is_private ? 'var(--text-muted)' : 'var(--button-primary)',
            transition: 'background-color 0.15s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.06)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          {item.is_private
            ? <EyeOff size={16} />
            : <Eye size={16} />
          }
        </button>

        {/* 삭제 */}
        <button
          onClick={() => handleDelete(item)}
          title="이력에서 삭제"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '6px', borderRadius: '8px',
            display: 'flex', alignItems: 'center',
            color: 'var(--text-muted)',
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(220,38,38,0.08)';
            e.currentTarget.style.color = 'var(--danger)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = 'var(--text-muted)';
          }}
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );

  return (
    <div style={{
      maxWidth: '700px', margin: '0 auto',
      padding: isMobile ? '12px 4px' : '32px 24px',
      ...(isMobile ? { width: '93%' } : {}),
    }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
          모임 이력
        </h2>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
          <EyeOff size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
          비공개 설정 시 다른 사람에게 숨겨집니다
        </p>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
          <div style={{
            width: '36px', height: '36px',
            border: '3px solid rgba(255,255,255,0.3)',
            borderTop: '3px solid var(--button-primary)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }} />
        </div>
      ) : history.length === 0 ? (
        <div style={{
          padding: '48px 24px', textAlign: 'center',
          background: 'rgba(255,255,255,0.5)', borderRadius: '16px',
        }}>
          <p style={{ fontSize: '15px', color: 'var(--text-muted)', margin: 0 }}>
            참여한 모임 이력이 없습니다
          </p>
          <button
            onClick={() => navigate('/gatherings')}
            style={{
              marginTop: '16px', background: 'none', border: 'none',
              color: 'var(--button-primary)', cursor: 'pointer',
              fontSize: '14px', fontWeight: '500',
            }}
          >
            모임 둘러보기 →
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {/* 현재 참여중 */}
          {current.length > 0 && (
            <section>
              <SectionTitle label="현재 참여중" count={current.length} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {current.map(item => <HistoryCard key={item.gathering_id} item={item} />)}
              </div>
            </section>
          )}

          {/* 과거 참여 */}
          {past.length > 0 && (
            <section>
              <SectionTitle label="과거 참여" count={past.length} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {past.map(item => {
                  const label = statusLabel(item.status);
                  return (
                    <div key={item.gathering_id} style={{ position: 'relative' }}>
                      <HistoryCard item={item} />
                      <span style={{
                        position: 'absolute', top: '14px', right: '80px',
                        fontSize: '11px', fontWeight: '600', color: label.color,
                      }}>
                        {label.text}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
