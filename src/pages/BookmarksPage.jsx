import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Star } from 'lucide-react';
import { useBookmarks } from '../context/BookmarkContext';
import { useIsMobile } from '../hooks/useIsMobile';

export default function BookmarksPage() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { bookmarks, isBookmarked, toggleBookmark } = useBookmarks();
  const [details, setDetails] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (bookmarks.length === 0) {
      setDetails([]);
      return;
    }
    fetchDetails(bookmarks.map(b => b.id));
  }, [bookmarks]);

  async function fetchDetails(ids) {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('gatherings')
        .select('*')
        .in('id', ids);

      if (error) throw error;

      const gatheringsWithDetails = await Promise.all((data || []).map(async (gathering) => {
        const { data: host } = await supabase
          .from('profiles')
          .select('nickname, is_premium')
          .eq('id', gathering.creator_id)
          .single();

        const { count } = await supabase
          .from('gathering_members')
          .select('*', { count: 'exact', head: true })
          .eq('gathering_id', gathering.id)
          .eq('status', 'approved');

        return { ...gathering, host, members: [{ count: count || 0 }] };
      }));

      // bookmarks 순서 유지
      const ordered = ids
        .map(id => gatheringsWithDetails.find(g => g.id === id))
        .filter(Boolean);
      setDetails(ordered);
    } catch (err) {
      console.error('즐겨찾기 상세 조회 오류:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: isMobile ? '12px 4px' : '32px 24px', ...(isMobile ? { width: '93%' } : {}) }}>
      <h2 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Star size={20} color="var(--button-primary)" fill="var(--button-primary)" />
        즐겨찾기
      </h2>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 0' }}>
          <div style={{
            width: '36px', height: '36px',
            border: '3px solid rgba(255,255,255,0.3)',
            borderTop: '3px solid var(--button-primary)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }} />
        </div>
      ) : details.length === 0 ? (
        <div style={{
          padding: '48px 24px',
          textAlign: 'center',
          background: 'linear-gradient(135deg, rgba(255,255,255,0.7), rgba(255,255,255,0.3))',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.5)',
          borderRadius: '16px',
        }}>
          <Star size={40} color="var(--text-muted)" style={{ marginBottom: '12px' }} />
          <p style={{ fontSize: '15px', color: 'var(--text-muted)', margin: 0 }}>즐겨찾기한 모임이 없습니다</p>
          <button
            onClick={() => navigate('/gatherings')}
            style={{
              marginTop: '16px',
              background: 'none', border: 'none',
              color: 'var(--button-primary)', cursor: 'pointer',
              fontSize: '14px', fontWeight: '500',
            }}
          >
            모임 둘러보기 →
          </button>
        </div>
      ) : (
        <div className="glass" style={{ borderRadius: '16px', overflow: 'hidden' }}>
          {details.map((gathering, index) => {
            const isPremium = gathering.host?.is_premium;
            const bookmarked = isBookmarked(gathering.id);
            return (
              <div
                key={gathering.id}
                onClick={() => navigate(`/gatherings/${gathering.id}`)}
                style={{
                  padding: isMobile ? '20px 16px' : '20px 24px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  background: 'transparent',
                  borderBottom: index < details.length - 1 ? '1px solid #E5E7EB' : 'none',
                  borderLeft: isPremium ? '4px solid #C5D89D' : undefined,
                  position: 'relative',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.06)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                {/* 별 즐겨찾기 버튼 */}
                <button
                  onClick={(e) => { e.stopPropagation(); toggleBookmark(gathering.id, gathering.title); }}
                  style={{
                    position: 'absolute', top: '16px', right: '16px',
                    background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
                    borderRadius: '6px', transition: 'background-color 0.2s',
                  }}
                >
                  <Star
                    size={18}
                    fill={bookmarked ? 'var(--button-primary)' : 'none'}
                    color="var(--button-primary)"
                  />
                </button>

                <h4 style={{
                  fontSize: isMobile ? '19px' : '17px',
                  fontWeight: '600',
                  color: 'var(--button-primary)',
                  margin: '0 0 6px 0',
                  lineHeight: 1.3,
                  paddingRight: '28px',
                }}>
                  {gathering.title}
                </h4>

                <div style={{ fontSize: isMobile ? '15px' : '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  모임장: {gathering.host?.nickname || '익명'} | {gathering.members?.[0]?.count || 0}명
                </div>

                {gathering.tags && gathering.tags.length > 0 && (
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {gathering.tags.map((tag, idx) => (
                      <span
                        key={idx}
                        style={{
                          padding: '3px 10px',
                          borderRadius: '12px',
                          background: '#FFFFFF',
                          border: '2px solid #6B9080',
                          color: '#6B9080',
                          fontSize: '11px',
                          fontWeight: '500',
                        }}
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
