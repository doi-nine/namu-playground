import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useIsMobile } from '../hooks/useIsMobile';
import { useToast } from '../components/Toast';
import { useBookmarks } from '../context/BookmarkContext';
import { Star } from 'lucide-react';

export default function MyPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { showToast } = useToast();
  const [createdGatherings, setCreatedGatherings] = useState([]);
  const [joinedGatherings, setJoinedGatherings] = useState([]);
  const [pendingGatherings, setPendingGatherings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortMode, setSortMode] = useState('recent');
  const [membershipTimestamps, setMembershipTimestamps] = useState({});
  const [bookmarkTimestamps, setBookmarkTimestamps] = useState({});
  const warningChecked = useRef(false);

  useEffect(() => {
    if (user) {
      fetchMyGatherings();

      if (!warningChecked.current) {
        warningChecked.current = true;

        // 경고 분석 트리거 (fire-and-forget)
        supabase.functions.invoke('ai-manner-check-chat', { body: {} }).catch(() => {});

        // 읽지 않은 경고 조회 → 토스트 표시
        supabase
          .from('ai_manner_warnings')
          .select('id, warning_message')
          .eq('user_id', user.id)
          .eq('is_read', false)
          .order('created_at', { ascending: false })
          .limit(1)
          .then(({ data }) => {
            if (data && data.length > 0) {
              const warning = data[0];
              showToast({
                message: warning.warning_message,
                type: 'warning',
                duration: 8000,
                onDismiss: () => {
                  supabase
                    .from('ai_manner_warnings')
                    .update({ is_read: true })
                    .eq('id', warning.id)
                    .then(() => {});
                },
              });
            }
          });
      }
    }
  }, [user]);

  async function fetchMyGatherings() {
    try {
      setLoading(true);

      // auth user를 직접 가져와서 세션 토큰 보장
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;
      const uid = authUser.id;

      // 1. 내가 만든 모임
      const { data: created, error: createdError } = await supabase
        .from('gatherings').select('*').eq('creator_id', uid).order('datetime', { ascending: true });
      if (createdError) throw createdError;
      setCreatedGatherings(created || []);

      // 2. 내 멤버십 조회 (join 없이)
      const { data: myMemberships, error: memberError } = await supabase
        .from('gathering_members').select('gathering_id, status, created_at').eq('user_id', uid);
      if (memberError) throw memberError;

      const approvedIds = (myMemberships || []).filter(m => m.status === 'approved').map(m => m.gathering_id);
      const pendingIds = (myMemberships || []).filter(m => m.status === 'pending').map(m => m.gathering_id);

      // 멤버십 타임스탬프 맵 저장
      const tsMap = {};
      (myMemberships || []).forEach(m => { tsMap[m.gathering_id] = m.created_at; });
      setMembershipTimestamps(tsMap);

      // 3. 승인된 모임 정보 조회
      if (approvedIds.length > 0) {
        const { data: joinedData, error: joinedError } = await supabase
          .from('gatherings').select('*').in('id', approvedIds);
        if (joinedError) throw joinedError;
        setJoinedGatherings(joinedData || []);
      } else {
        setJoinedGatherings([]);
      }

      // 4. 대기 중인 모임 정보 조회
      if (pendingIds.length > 0) {
        const { data: pendingData, error: pendingError } = await supabase
          .from('gatherings').select('*').in('id', pendingIds);
        if (pendingError) throw pendingError;
        setPendingGatherings(pendingData || []);
      } else {
        setPendingGatherings([]);
      }

      // 5. 즐겨찾기 타임스탬프 조회
      const { data: bookmarkData } = await supabase
        .from('gathering_bookmarks')
        .select('gathering_id, created_at')
        .eq('user_id', uid);
      const bmMap = {};
      (bookmarkData || []).forEach(b => { bmMap[b.gathering_id] = b.created_at; });
      setBookmarkTimestamps(bmMap);

    } catch (error) {
      console.error('내 모임 조회 오류:', error);
      alert('모임을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCancelJoin(gatheringId, isApproved) {
    if (!confirm('참가를 취소하시겠습니까?')) return;
    try {
      const { error } = await supabase.from('gathering_members').delete().eq('gathering_id', gatheringId).eq('user_id', user.id);
      if (error) throw error;
      if (isApproved) {
        const gathering = joinedGatherings.find(g => g.id === gatheringId);
        if (gathering) {
          await supabase.from('gatherings').update({ current_members: gathering.current_members - 1 }).eq('id', gatheringId);
        }
      }
      alert('참가가 취소되었습니다.');
      fetchMyGatherings();
    } catch (error) {
      console.error('참가 취소 오류:', error);
      alert('참가 취소 중 오류가 발생했습니다.');
    }
  }

  async function handleDeleteGathering(gatheringId) {
    if (!confirm('모임을 삭제하시겠습니까? 이 작업은 취소할 수 없습니다.')) return;
    try {
      await supabase.from('gathering_members').delete().eq('gathering_id', gatheringId);
      const { error } = await supabase.from('gatherings').delete().eq('id', gatheringId);
      if (error) throw error;
      alert('모임이 삭제되었습니다.');
      fetchMyGatherings();
    } catch (error) {
      console.error('모임 삭제 오류:', error);
      alert('모임 삭제 중 오류가 발생했습니다.');
    }
  }

  function formatDate(dateString) {
    const date = new Date(dateString);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekday = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${month}/${day}(${weekday}) ${hours}:${minutes}`;
  }

  // 모든 모임을 하나의 리스트로 합침 (_joinedAt: 가입/생성 시점)
  const allGatherings = [
    ...createdGatherings.map(g => ({ ...g, _type: 'created', _joinedAt: g.created_at })),
    ...joinedGatherings
      .filter(g => !createdGatherings.some(c => c.id === g.id))
      .map(g => ({ ...g, _type: 'joined', _joinedAt: membershipTimestamps[g.id] || g.created_at })),
    ...pendingGatherings.map(g => ({ ...g, _type: 'pending', _joinedAt: membershipTimestamps[g.id] || g.created_at })),
  ];

  const sortedGatherings = [...allGatherings].sort((a, b) => {
    if (sortMode === 'recent') {
      return new Date(b._joinedAt || 0) - new Date(a._joinedAt || 0);
    } else {
      const aTime = bookmarkTimestamps[a.id];
      const bTime = bookmarkTimestamps[b.id];
      if (aTime && bTime) return new Date(bTime) - new Date(aTime);
      if (aTime) return -1;
      if (bTime) return 1;
      return new Date(b._joinedAt || 0) - new Date(a._joinedAt || 0);
    }
  });

  if (loading) {
    return (
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: isMobile ? '4px' : '0', ...(isMobile ? { width: '97%' } : {}) }}>
        <div style={{ textAlign: 'center', paddingTop: '60px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid rgba(255,255,255,0.3)',
            borderTop: '3px solid var(--button-primary)',
            borderRadius: '50%',
            margin: '0 auto',
            animation: 'spin 0.8s linear infinite',
          }} />
          <p style={{ marginTop: '16px', color: 'var(--text-muted)', fontSize: '14px' }}>로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: isMobile ? '4px' : '0', ...(isMobile ? { width: '97%' } : {}) }}>
      {allGatherings.length === 0 ? (
        <div
          className="glass"
          style={{
            textAlign: 'center',
            padding: '48px 24px',
            borderRadius: '16px',
          }}
        >
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
          <p style={{
            fontSize: '16px',
            color: 'var(--button-primary)',
            marginBottom: '20px',
          }}>
            아직 모임이 없습니다.
          </p>
          <button
            onClick={() => navigate('/gathering/create')}
            style={{
              backgroundColor: 'var(--button-primary)',
              color: '#FFFFFF',
              padding: '12px 28px',
              borderRadius: '12px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '15px',
              fontWeight: '600',
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--button-primary-hover)'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--button-primary)'}
          >
            모임 만들기
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* 정렬 버튼 */}
          <div style={{ display: 'flex', gap: '8px' }}>
            {[
              { key: 'recent', label: '최근 가입한 순' },
              { key: 'bookmark', label: '즐겨찾기 순' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setSortMode(key)}
                style={{
                  padding: '7px 14px',
                  borderRadius: '20px',
                  border: sortMode === key ? 'none' : '1px solid rgba(0,0,0,0.12)',
                  backgroundColor: sortMode === key ? 'var(--button-primary)' : 'rgba(255,255,255,0.5)',
                  color: sortMode === key ? '#FFFFFF' : 'var(--text-secondary)',
                  fontSize: '13px',
                  fontWeight: sortMode === key ? '600' : '400',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {sortMode === 'bookmark' && sortedGatherings.filter(g => bookmarkTimestamps[g.id]).length === 0 ? (
            <div className="glass" style={{ textAlign: 'center', padding: '36px 24px', borderRadius: '16px' }}>
              <div style={{ fontSize: '36px', marginBottom: '12px' }}>⭐</div>
              <p style={{ fontSize: '15px', color: 'var(--text-muted)' }}>즐겨찾기한 모임이 없습니다.</p>
            </div>
          ) : (sortMode === 'bookmark' ? sortedGatherings.filter(g => bookmarkTimestamps[g.id]) : sortedGatherings).map(gathering => (
            <GatheringCard
              key={`${gathering._type}-${gathering.id}`}
              gathering={gathering}
              type={gathering._type}
              onCancelJoin={handleCancelJoin}
              onDelete={handleDeleteGathering}
              navigate={navigate}
              formatDate={formatDate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function GatheringCard({ gathering, type, onCancelJoin, onDelete, navigate, formatDate }) {
  const { isBookmarked, toggleBookmark } = useBookmarks();

  return (
    <div
      className="glass"
      style={{
        borderRadius: '16px',
        transition: 'all 0.2s',
        position: 'relative',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.1)';
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = 'none';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      {/* 즐겨찾기 버튼 */}
      <button
        onClick={(e) => { e.stopPropagation(); toggleBookmark(gathering.id, gathering.title); }}
        style={{
          position: 'absolute', top: '16px', right: '16px',
          background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
          zIndex: 1,
        }}
      >
        <Star
          size={18}
          fill={isBookmarked(gathering.id) ? 'var(--button-primary)' : 'none'}
          color="var(--button-primary)"
        />
      </button>

      <div style={{ padding: '20px' }}>
        {/* 모임 이름 + 수정 버튼 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', paddingRight: '28px' }}>
          <h3
            onClick={() => navigate(`/gatherings/${gathering.id}`)}
            style={{
              fontSize: '17px',
              fontWeight: '700',
              color: 'var(--button-primary)',
              cursor: 'pointer',
              transition: 'color 0.2s',
              lineHeight: '1.4',
              flex: 1,
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--button-primary-hover)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--button-primary)'}
          >
            {gathering.title}
          </h3>
          {type === 'created' && (
            <button
              onClick={() => navigate(`/gatherings/${gathering.id}/manage`)}
              style={{
                padding: '5px 14px',
                fontSize: '13px',
                fontWeight: '500',
                backgroundColor: 'var(--button-primary)',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'background-color 0.2s',
                flexShrink: 0,
                marginLeft: '12px',
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--button-primary-hover)'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--button-primary)'}
            >
              수정
            </button>
          )}
        </div>

        {/* 태그 */}
        {gathering.tags && gathering.tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
            {gathering.tags.map((tag, index) => (
              <button
                key={index}
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/gatherings?search=${encodeURIComponent(tag)}`);
                }}
                style={{
                  display: 'inline-block',
                  padding: '3px 10px',
                  backgroundColor: '#FFFFFF',
                  border: '2px solid #6B9080',
                  color: '#6B9080',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#6B9080';
                  e.currentTarget.style.color = '#FFFFFF';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#FFFFFF';
                  e.currentTarget.style.color = '#6B9080';
                }}
              >
                #{tag}
              </button>
            ))}
          </div>
        )}

        {/* 일정, 장소, 인원 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--button-primary)' }}>
            <span>📅</span>
            <span>{formatDate(gathering.datetime)}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--button-primary)' }}>
            <span>📍</span>
            <span style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {gathering.location_type === 'offline' ? gathering.location : gathering.online_platform}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--button-primary)' }}>
            <span>👥</span>
            <span>
              {gathering.current_members}/{gathering.max_members}명
              {gathering.current_members >= gathering.max_members && (
                <span style={{ marginLeft: '8px', color: 'var(--danger)', fontWeight: '600' }}>마감</span>
              )}
            </span>
          </div>
        </div>

        {/* 버튼 */}
        <div style={{
          display: 'flex',
          gap: '8px',
          paddingTop: '16px',
          borderTop: '1px solid rgba(0,0,0,0.06)',
        }}>
          {/* 이동 버튼 (모든 타입) */}
          <button
            onClick={() => navigate(`/gatherings/${gathering.id}`)}
            style={{
              flex: 1,
              padding: '10px 16px',
              borderRadius: '10px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              backgroundColor: 'var(--button-primary)',
              color: '#FFFFFF',
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--button-primary-hover)'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--button-primary)'}
          >
            이동
          </button>

          {/* 내가 만든 모임: 삭제 */}
          {type === 'created' && (
            <button
              onClick={() => onDelete(gathering.id)}
              style={{
                flex: 1,
                padding: '10px 16px',
                borderRadius: '10px',
                border: '2px solid var(--danger)',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                backgroundColor: '#FFFFFF',
                color: 'var(--danger)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.backgroundColor = 'var(--danger)';
                e.currentTarget.style.color = '#FFFFFF';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.backgroundColor = '#FFFFFF';
                e.currentTarget.style.color = 'var(--danger)';
              }}
            >
              삭제
            </button>
          )}

          {/* 참가한 모임: 참가 취소 */}
          {type === 'joined' && (
            <button
              onClick={() => onCancelJoin(gathering.id, true)}
              style={{
                flex: 1,
                padding: '10px 16px',
                borderRadius: '10px',
                border: '2px solid var(--danger)',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                backgroundColor: '#FFFFFF',
                color: 'var(--danger)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.backgroundColor = 'var(--danger)';
                e.currentTarget.style.color = '#FFFFFF';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.backgroundColor = '#FFFFFF';
                e.currentTarget.style.color = 'var(--danger)';
              }}
            >
              참가 취소
            </button>
          )}

          {/* 승인 대기: 신청 취소 */}
          {type === 'pending' && (
            <button
              onClick={() => onCancelJoin(gathering.id, false)}
              style={{
                flex: 1,
                padding: '10px 16px',
                borderRadius: '10px',
                border: '2px solid var(--danger)',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                backgroundColor: '#FFFFFF',
                color: 'var(--danger)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.backgroundColor = 'var(--danger)';
                e.currentTarget.style.color = '#FFFFFF';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.backgroundColor = '#FFFFFF';
                e.currentTarget.style.color = 'var(--danger)';
              }}
            >
              신청 취소
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
