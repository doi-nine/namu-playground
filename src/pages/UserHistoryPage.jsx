import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useIsMobile } from '../hooks/useIsMobile';

export default function UserHistoryPage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [profile, setProfile] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId) {
      fetchAll();
    }
  }, [userId]);

  async function fetchAll() {
    setLoading(true);
    try {
      // 프로필
      const { data: profileData } = await supabase
        .from('profiles')
        .select('nickname')
        .eq('id', userId)
        .maybeSingle();
      setProfile(profileData);

      // 공개 이력만 반환하는 DB 함수 호출 (SECURITY DEFINER — 비공개/삭제 서버에서 필터링)
      const { data: members, error } = await supabase
        .rpc('get_public_gathering_history', { target_user_id: userId });

      if (error) throw error;
      if (!members || members.length === 0) {
        setHistory([]);
        return;
      }

      // 모임 상세
      const gatheringIds = members.map(m => m.gathering_id);
      const { data: gatherings } = await supabase
        .from('gatherings')
        .select('id, title, tags')
        .in('id', gatheringIds);

      const gatheringMap = {};
      (gatherings || []).forEach(g => { gatheringMap[g.id] = g; });

      const merged = members
        .map(m => {
          const gathering = gatheringMap[m.gathering_id];
          if (!gathering) return null;
          return {
            gathering_id: m.gathering_id,
            gathering,
            status: m.status,
            joined_at: m.joined_at,
          };
        })
        .filter(Boolean)
        .sort((a, b) => new Date(b.joined_at) - new Date(a.joined_at));

      setHistory(merged);
    } catch (err) {
      console.error('이력 조회 오류:', err);
    } finally {
      setLoading(false);
    }
  }

  const current = history.filter(h => h.status === 'approved');
  const past = history.filter(h => h.status !== 'approved');

  const SectionTitle = ({ label, count }) => (
    <div style={{
      fontSize: '13px', fontWeight: '600',
      color: 'var(--text-muted)', textTransform: 'uppercase',
      letterSpacing: '0.05em', marginBottom: '10px',
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
    <div
      onClick={() => navigate(`/gatherings/${item.gathering_id}`)}
      style={{
        background: 'rgba(255,255,255,0.7)',
        borderRadius: '12px',
        padding: '14px 16px',
        border: '1px solid rgba(255,255,255,0.5)',
        cursor: 'pointer',
        transition: 'all 0.2s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-1px)';
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.06)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <span style={{
        fontSize: '14px', fontWeight: '600',
        color: 'var(--button-primary)',
        display: 'block', marginBottom: '6px',
      }}>
        {item.gathering.title}
      </span>
      {item.gathering.tags?.length > 0 && (
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {item.gathering.tags.slice(0, 3).map((tag, i) => (
            <span key={i} style={{
              fontSize: '11px', padding: '2px 8px', borderRadius: '8px',
              border: '1.5px solid #6B9080', color: '#6B9080', background: '#FFFFFF',
            }}>#{tag}</span>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div style={{
      maxWidth: '700px', margin: '0 auto',
      padding: isMobile ? '12px 4px' : '32px 24px',
      ...(isMobile ? { width: '97%' } : {}),
    }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
          {profile?.nickname ? `${profile.nickname}님의 모임 이력` : '모임 이력'}
        </h2>
        <button
          onClick={() => navigate(-1)}
          style={{
            padding: '7px 16px',
            border: '1.5px solid rgba(0,0,0,0.12)',
            borderRadius: '10px',
            background: '#FFFFFF',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            color: 'var(--text-secondary)',
            fontFamily: 'inherit',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.85)'}
          onMouseLeave={(e) => e.currentTarget.style.background = '#FFFFFF'}
        >
          뒤로
        </button>
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
            공개된 모임 이력이 없습니다
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {current.length > 0 && (
            <section>
              <SectionTitle label="현재 참여중" count={current.length} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {current.map(item => <HistoryCard key={item.gathering_id} item={item} />)}
              </div>
            </section>
          )}
          {past.length > 0 && (
            <section>
              <SectionTitle label="과거 참여" count={past.length} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {past.map(item => <HistoryCard key={item.gathering_id} item={item} />)}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
