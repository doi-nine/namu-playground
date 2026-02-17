import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import ChatTab from '../components/ChatTab';
import ToolsTab from '../components/ToolsTab';

export default function GatheringDetailPage() {
  const { user: authUser, profile } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const [gathering, setGathering] = useState(null);
  const [creator, setCreator] = useState(null);
  const [members, setMembers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [myMembership, setMyMembership] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCopySuccess, setShowCopySuccess] = useState(false);
  const [activeTab, setActiveTab] = useState('info'); // 'info', 'chat', 'tools'
  const [showEvalModal, setShowEvalModal] = useState(false);
  const [evalVotes, setEvalVotes] = useState({}); // { [userId]: { kind: true, friendly: false, ... } }
  const [existingVotes, setExistingVotes] = useState({}); // { [userId]: Set of vote_types already submitted }
  const [evalSubmitting, setEvalSubmitting] = useState(false);
  const [evalDone, setEvalDone] = useState(false);

  const formatDateTime = (datetime) => {
    const date = new Date(datetime);
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const weekday = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
    return `${year}년 ${month}월 ${day}일(${weekday}) ${hours}:${minutes}`;
  };

  useEffect(() => {
    const fetchCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
    };
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    const fetchGatheringDetail = async () => {
      try {
        setLoading(true);
        const { data: gatheringData, error: gatheringError } = await supabase.from('gatherings').select('*').eq('id', id).single();
        if (gatheringError) throw gatheringError;
        setGathering(gatheringData);

        const { data: creatorData, error: creatorError } = await supabase.from('profiles').select('nickname, is_premium').eq('id', gatheringData.creator_id).single();
        if (creatorError) throw creatorError;
        setCreator(creatorData);

        const { data: membersData, error: membersError } = await supabase
          .from('gathering_members')
          .select(`
          *,
          profiles (
            nickname,
            is_premium
          )
        `)
          .eq('gathering_id', id)
          .eq('status', 'approved');

        if (membersError) throw membersError;

        // 프리미엄 회원의 인기도 점수도 가져오기
        const premiumMemberIds = membersData?.filter(m => m.profiles?.is_premium).map(m => m.user_id) || [];
        let scoresMap = {};

        if (premiumMemberIds.length > 0) {
          const { data: scoresData } = await supabase
            .from('popularity_scores')
            .select('user_id, total_score')
            .in('user_id', premiumMemberIds);

          scoresData?.forEach(score => {
            scoresMap[score.user_id] = score.total_score;
          });
        }

        // members에 점수 추가
        const enrichedMembers = membersData?.map(member => ({
          ...member,
          popularity_score: scoresMap[member.user_id] || 0
        })) || [];

        setMembers(enrichedMembers);

      } catch (err) {
        console.error('Error fetching gathering detail:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    if (id) {
      fetchGatheringDetail();
    }
  }, [id]);

  const refreshMembers = async () => {
    try {
      const { data: membersData } = await supabase
        .from('gathering_members')
        .select('*, profiles (nickname, is_premium)')
        .eq('gathering_id', id)
        .eq('status', 'approved');
      setMembers(membersData || []);
    } catch (err) {
      console.error('Error refreshing members:', err);
    }
  };

  useEffect(() => {
    const fetchMyMembership = async () => {
      if (!currentUser || !id) return;
      const { data, error } = await supabase.from('gathering_members').select('*').eq('gathering_id', id).eq('user_id', currentUser.id).maybeSingle();
      if (error) {
        console.error('Error fetching membership:', error);
        return;
      }
      // kicked/rejected 상태면 미가입으로 처리 (다시 지원 가능)
      if (data && (data.status === 'kicked' || data.status === 'rejected')) {
        setMyMembership(null);
      } else {
        setMyMembership(data);
      }
    };
    fetchMyMembership();
  }, [currentUser, id]);


  const handleJoin = async () => {
    if (!currentUser) {
      alert('로그인이 필요합니다.');
      navigate('/login');
      return;
    }
    try {
      const { error: memberError } = await supabase.from('gathering_members').upsert({ gathering_id: id, user_id: currentUser.id, status: 'approved' }, { onConflict: 'gathering_id,user_id' });
      if (memberError) throw memberError;
      const { error: updateError } = await supabase.from('gatherings').update({ current_members: gathering.current_members + 1 }).eq('id', id);
      if (updateError) throw updateError;
      setGathering({ ...gathering, current_members: gathering.current_members + 1 });
      setMyMembership({ gathering_id: id, user_id: currentUser.id, status: 'approved' });
      alert('참가 완료되었습니다!');
      refreshMembers();
    } catch (err) {
      console.error('Error joining gathering:', err);
      alert('참가 중 오류가 발생했습니다: ' + err.message);
    }
  };

  const handleApply = async () => {
    if (!currentUser) {
      alert('로그인이 필요합니다.');
      navigate('/login');
      return;
    }
    try {
      const { error: memberError } = await supabase.from('gathering_members').upsert({ gathering_id: id, user_id: currentUser.id, status: 'pending' }, { onConflict: 'gathering_id,user_id' });
      if (memberError) throw memberError;
      const { error: notifError } = await supabase.from('notifications').insert({ user_id: gathering.creator_id, type: 'application_received', gathering_id: id, related_user_id: currentUser.id });
      if (notifError) throw notifError;
      setMyMembership({ gathering_id: id, user_id: currentUser.id, status: 'pending' });
      alert('지원이 완료되었습니다. 승인을 기다려주세요.');
    } catch (err) {
      console.error('Error applying to gathering:', err);
      alert('지원 중 오류가 발생했습니다: ' + err.message);
    }
  };

  const handleCancel = async () => {
    if (!myMembership) return;
    if (!confirm('정말 참가를 취소하시겠습니까?')) return;
    try {
      const { error: deleteError } = await supabase.from('gathering_members').delete().eq('gathering_id', id).eq('user_id', currentUser.id);
      if (deleteError) throw deleteError;
      if (myMembership.status === 'approved') {
        const { error: updateError } = await supabase.from('gatherings').update({ current_members: gathering.current_members - 1 }).eq('id', id);
        if (updateError) throw updateError;
        setGathering({ ...gathering, current_members: gathering.current_members - 1 });
      }
      setMyMembership(null);
      alert('참가가 취소되었습니다.');
      refreshMembers();
    } catch (err) {
      console.error('Error canceling participation:', err);
      alert('취소 중 오류가 발생했습니다: ' + err.message);
    }
  };


  const handleCopyLink = async () => {
    const url = window.location.href;

    try {
      await navigator.clipboard.writeText(url);
      setShowCopySuccess(true);
      setTimeout(() => setShowCopySuccess(false), 2000);
    } catch (error) {
      console.error('링크 복사 실패:', error);
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setShowCopySuccess(true);
      setTimeout(() => setShowCopySuccess(false), 2000);
    }
  };

  const handleKakaoShare = () => {
    if (!gathering) return;

    if (!window.Kakao || !window.Kakao.isInitialized()) {
      alert('카카오톡 SDK가 초기화되지 않았습니다.');
      return;
    }

    const url = window.location.href;
    const description = gathering.description
      ? gathering.description.substring(0, 100) + '...'
      : '나무 놀이터에서 함께 놀아요!';

    window.Kakao.Share.sendDefault({
      objectType: 'feed',
      content: {
        title: gathering.title,
        description: description,
        imageUrl: 'https://via.placeholder.com/800x400.png?text=나무놀이터',
        link: {
          mobileWebUrl: url,
          webUrl: url,
        },
      },
      buttons: [
        {
          title: '모임 보기',
          link: {
            mobileWebUrl: url,
            webUrl: url,
          },
        },
      ],
    });
  };

  const evalVoteTypes = [
    { id: 'kind', label: '친절', emoji: '😊' },
    { id: 'friendly', label: '친화력', emoji: '🤝' },
    { id: 'punctual', label: '시간약속', emoji: '⏰' },
    { id: 'cheerful', label: '유쾌', emoji: '😄' },
    { id: 'active', label: '적극적', emoji: '🔥' },
  ];

  // 완료된 모임에서 기존 투표 조회
  useEffect(() => {
    const fetchExistingVotes = async () => {
      if (!gathering?.is_completed || !currentUser) return;
      const { data } = await supabase
        .from('popularity_votes')
        .select('to_user_id, vote_type')
        .eq('from_user_id', currentUser.id)
        .eq('gathering_id', id);

      if (data && data.length > 0) {
        const votesMap = {};
        data.forEach(v => {
          if (!votesMap[v.to_user_id]) votesMap[v.to_user_id] = new Set();
          votesMap[v.to_user_id].add(v.vote_type);
        });
        setExistingVotes(votesMap);

        // 모든 멤버에 대해 이미 투표했는지 확인
        const allApprovedIds = getAllApprovedMemberIds();
        const allVoted = allApprovedIds.length > 0 && allApprovedIds.every(uid => votesMap[uid] && votesMap[uid].size > 0);
        if (allVoted) setEvalDone(true);
      }
    };
    fetchExistingVotes();
  }, [gathering?.is_completed, currentUser, members]);

  const getAllApprovedMemberIds = () => {
    const ids = members.map(m => m.user_id);
    if (gathering?.creator_id) ids.push(gathering.creator_id);
    return [...new Set(ids)].filter(uid => uid !== currentUser?.id);
  };

  const handleOpenEvalModal = () => {
    // 초기화: 기존 투표가 있으면 반영
    const initialVotes = {};
    const targetIds = getAllApprovedMemberIds();
    targetIds.forEach(uid => {
      const existing = existingVotes[uid];
      initialVotes[uid] = {};
      evalVoteTypes.forEach(vt => {
        initialVotes[uid][vt.id] = existing ? existing.has(vt.id) : false;
      });
    });
    setEvalVotes(initialVotes);
    setShowEvalModal(true);
  };

  const toggleEvalVote = (userId, voteType) => {
    // 이미 서버에 저장된 투표는 토글 불가
    if (existingVotes[userId]?.has(voteType)) return;
    setEvalVotes(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        [voteType]: !prev[userId]?.[voteType]
      }
    }));
  };

  const handleSubmitEval = async () => {
    setEvalSubmitting(true);
    try {
      for (const [targetUserId, votes] of Object.entries(evalVotes)) {
        for (const [voteType, isActive] of Object.entries(votes)) {
          if (!isActive) continue;
          if (existingVotes[targetUserId]?.has(voteType)) continue; // 이미 저장된 투표 건너뛰기

          const { data, error } = await supabase.functions.invoke('vote-popularity', {
            body: {
              target_user_id: targetUserId,
              vote_type: voteType,
              is_active: true,
              gathering_id: id
            }
          });

          if (error) {
            console.error('투표 오류:', error);
          }
          if (data?.error) {
            console.error('투표 오류:', data.error);
          }
        }
      }

      alert('평가가 완료되었습니다!');
      setShowEvalModal(false);
      setEvalDone(true);

      // 기존 투표 상태 갱신
      const { data: updatedVotes } = await supabase
        .from('popularity_votes')
        .select('to_user_id, vote_type')
        .eq('from_user_id', currentUser.id)
        .eq('gathering_id', id);
      if (updatedVotes) {
        const votesMap = {};
        updatedVotes.forEach(v => {
          if (!votesMap[v.to_user_id]) votesMap[v.to_user_id] = new Set();
          votesMap[v.to_user_id].add(v.vote_type);
        });
        setExistingVotes(votesMap);
      }
    } catch (err) {
      console.error('평가 제출 오류:', err);
      alert('평가 제출 중 오류가 발생했습니다.');
    } finally {
      setEvalSubmitting(false);
    }
  };

  if (error || !gathering) {
    return (
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '32px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)' }}>모임을 불러올 수 없습니다.</p>
          <button
            onClick={() => navigate('/gatherings')}
            style={{
              marginTop: '16px',
              padding: '10px 20px',
              backgroundColor: 'var(--button-primary)',
              color: 'white',
              borderRadius: '12px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: '500',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--button-primary-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--button-primary)'}
          >
            모임 목록으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  const isCreator = currentUser && gathering.creator_id === currentUser.id;
  const nonCreatorMembers = members.filter(m => m.user_id !== gathering.creator_id);
  const actualMemberCount = nonCreatorMembers.length + (creator ? 1 : 0);
  const isFull = actualMemberCount >= gathering.max_members;
  const memberStatus = myMembership?.status;
  const isApprovedMember = myMembership?.status === 'approved' || isCreator;
  const showEvalBanner = gathering.is_completed && isApprovedMember && currentUser;

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      {/* Main Card */}
      <div
        style={{
          padding: '28px 4px',
        }}
      >
        {/* Location Badge + Edit Button */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <span
            style={{
              display: 'inline-block',
              padding: '4px 12px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '500',
              backgroundColor: gathering.location_type === 'offline' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(139, 92, 246, 0.15)',
              color: gathering.location_type === 'offline' ? '#B45309' : '#7C3AED'
            }}
          >
            {gathering.location_type === 'offline' ? '오프라인' : '온라인'}
          </span>
          {isCreator && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => navigate(`/gatherings/${id}/members`)}
                style={{
                  padding: '5px 14px',
                  fontSize: '13px',
                  fontWeight: '500',
                  backgroundColor: 'var(--premium-gold)',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                }}
              >
                관리
              </button>
              <button
                onClick={() => navigate(`/gatherings/${id}/manage`)}
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
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--button-primary-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--button-primary)'}
              >
                수정
              </button>
            </div>
          )}
        </div>

        {/* Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--text-primary)', margin: 0 }}>
            {gathering.title}
          </h1>
          {gathering.is_completed && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 10px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: '600',
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              color: '#059669',
              flexShrink: 0,
            }}>
              ✅ 완료
            </span>
          )}
        </div>

        {/* Tags */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
          {gathering.tags && gathering.tags.length > 0 ? (
            gathering.tags.map((tag, index) => (
              <button
                key={index}
                onClick={() => navigate(`/gatherings?search=${encodeURIComponent(tag)}`)}
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
            ))
          ) : (
            <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>태그 없음</span>
          )}
        </div>

        {/* Tab Navigation */}
        <div style={{
          borderBottom: '2px solid rgba(0,0,0,0.06)',
          marginBottom: '24px',
          display: 'flex',
          gap: '4px'
        }}>
          {[
            { key: 'info', label: '모임 정보' },
            { key: 'chat', label: '대화' },
            { key: 'tools', label: '도구' }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '12px 24px',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === tab.key ? '3px solid var(--button-primary)' : '3px solid transparent',
                color: activeTab === tab.key ? 'var(--button-primary)' : 'var(--text-muted)',
                fontWeight: activeTab === tab.key ? '600' : '400',
                cursor: 'pointer',
                fontSize: '16px',
                transition: 'all 0.2s'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'info' && (
          <div>
            {/* 평가 배너 */}
            {showEvalBanner && (
              <div
                onClick={handleOpenEvalModal}
                style={{
                  padding: '16px 20px',
                  borderRadius: '14px',
                  marginBottom: '16px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  backgroundColor: evalDone ? 'rgba(16, 185, 129, 0.08)' : 'rgba(107, 144, 128, 0.1)',
                  border: evalDone ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(107, 144, 128, 0.2)',
                  transition: 'all 0.2s',
                }}
              >
                <span style={{ fontSize: '24px' }}>{evalDone ? '✅' : '⭐'}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>
                    {evalDone ? '평가를 완료했습니다!' : '모임이 완료되었습니다. 함께한 멤버를 평가해주세요!'}
                  </p>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                    {evalDone ? '클릭하여 평가 내용을 확인하세요' : '클릭하여 평가하기'}
                  </p>
                </div>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </div>
            )}

            {/* Gathering Info */}
            <div style={{
              backgroundColor: 'rgba(255, 255, 255, 0.75)',
              borderRadius: '14px',
              padding: '20px',
              marginBottom: '16px',
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', color: 'var(--text-secondary)' }}>
                <div>📅 {formatDateTime(gathering.datetime)}</div>
                <div>📍 {gathering.location}</div>
                <div>👥 {actualMemberCount} / {gathering.max_members}명</div>
              </div>

              {gathering.approval_required && !isCreator && (
                <div style={{
                  padding: '12px 16px',
                  backgroundColor: 'rgba(245, 158, 11, 0.1)',
                  borderLeft: '4px solid var(--premium-gold)',
                  color: '#92400E',
                  fontSize: '14px',
                  marginTop: '16px',
                  borderRadius: '0 10px 10px 0'
                }}>
                  ⚠️ 승인제 모임입니다. 모임장의 승인이 필요합니다.
                </div>
              )}
            </div>

            {/* Description Section */}
            <div
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.75)',
                borderRadius: '14px',
                padding: '24px',
                marginBottom: '16px',
              }}
            >
              <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '12px', color: 'var(--text-primary)' }}>
                {gathering.description_title || '모임 설명'}
              </h2>
              <p style={{ color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: '1.625' }}>{gathering.description}</p>
            </div>

            {/* Members Section */}
            <div
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.75)',
                borderRadius: '14px',
                padding: '24px',
                marginBottom: '16px',
              }}
            >
              <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '12px', color: 'var(--text-primary)' }}>참가자 ({actualMemberCount}명)</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {/* 모임장 */}
                {creator && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      backgroundColor: 'rgba(107, 144, 128, 0.12)',
                      borderRadius: '10px',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(107, 144, 128, 0.2)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(107, 144, 128, 0.12)'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{creator.nickname}</span>
                      {creator.is_premium && (
                        <span style={{ fontSize: '12px' }}>👑</span>
                      )}
                      <span style={{
                        fontSize: '11px',
                        padding: '1px 8px',
                        borderRadius: '6px',
                        backgroundColor: 'rgba(107, 144, 128, 0.2)',
                        color: 'var(--button-primary)',
                        fontWeight: '500',
                      }}>
                        모임장
                      </span>
                    </div>

                    {profile?.is_premium && creator.is_premium && (
                      <span style={{
                        fontSize: '14px',
                        fontWeight: 'bold',
                        color: '#16A34A'
                      }}>
                        ⭐ +0
                      </span>
                    )}
                  </div>
                )}

                {/* 일반 참가자 (모임장 제외) */}
                {members.filter(m => m.user_id !== gathering.creator_id).map((member) => (
                  <div
                    key={member.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      backgroundColor: 'rgba(0,0,0,0.03)',
                      borderRadius: '10px',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.06)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.03)'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{member.profiles?.nickname || '익명'}</span>
                      {member.profiles?.is_premium && (
                        <span style={{ fontSize: '12px' }}>👑</span>
                      )}
                    </div>

                    {/* 프리미엄 회원만 인기도 표시 */}
                    {profile?.is_premium && member.profiles?.is_premium && member.popularity_score !== undefined && (
                      <span style={{
                        fontSize: '14px',
                        fontWeight: 'bold',
                        color: member.popularity_score >= 0 ? '#16A34A' : 'var(--danger)'
                      }}>
                        ⭐ {member.popularity_score >= 0 ? '+' : ''}{member.popularity_score}
                      </span>
                    )}
                  </div>
                ))}

                {members.length === 0 && !creator && (
                  <p style={{ color: 'var(--text-muted)' }}>아직 참가자가 없습니다.</p>
                )}
              </div>
            </div>

            {/* Share Section */}
            <div
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.75)',
                borderRadius: '14px',
                padding: '24px',
                marginBottom: '0',
              }}
            >
              <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '12px', color: 'var(--text-primary)' }}>모임 공유하기</h2>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={handleCopyLink}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    backgroundColor: showCopySuccess ? 'var(--button-primary)' : 'var(--text-muted)',
                    color: 'white',
                    borderRadius: '10px',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transition: 'background-color 0.2s'
                  }}
                >
                  {showCopySuccess ? (
                    <>
                      <svg style={{ width: '16px', height: '16px' }} fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      복사 완료!
                    </>
                  ) : (
                    <>
                      <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                      </svg>
                      링크 복사
                    </>
                  )}
                </button>

                <button
                  onClick={handleKakaoShare}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    backgroundColor: '#FEE500',
                    color: '#3C1E1E',
                    borderRadius: '10px',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <svg style={{ width: '16px', height: '16px' }} fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 3c5.799 0 10.5 3.664 10.5 8.185 0 4.52-4.701 8.184-10.5 8.184a13.5 13.5 0 01-1.727-.11l-4.408 2.883c-.501.265-.678.236-.472-.413l.892-3.678c-2.88-1.46-4.785-3.99-4.785-6.866C1.5 6.665 6.201 3 12 3zm5.907 8.06l1.47-1.424a.472.472 0 00-.656-.678l-1.928 1.866V9.282a.472.472 0 00-.944 0v2.557a.471.471 0 000 .222V13.5a.472.472 0 00.944 0v-1.363l.427-.413 1.428 2.033a.472.472 0 10.773-.543l-1.514-2.155zm-2.958 1.924h-1.46V9.297a.472.472 0 00-.943 0v4.159c0 .26.211.472.471.472h1.932a.472.472 0 000-.944zm-5.857-1.092l.696-1.707.638 1.707H9.092zm2.523.488l.002-.016a.469.469 0 00-.127-.32l-1.046-2.8a.69.69 0 00-.627-.474.696.696 0 00-.653.447l-1.661 4.075a.472.472 0 00.874.357l.33-.813h2.07l.293.801a.472.472 0 10.884-.32l-.339-.937zM8.293 9.302a.472.472 0 00-.471-.472H4.577a.472.472 0 100 .944h1.16v3.736a.472.472 0 00.944 0V9.774h1.14c.261 0 .472-.212.472-.472z" />
                  </svg>
                  카카오톡
                </button>
              </div>
            </div>

            {/* Action Buttons - inline below share section */}
            {!isCreator && !gathering.is_completed && (
              <div style={{ marginTop: '16px' }}>
                {!isCreator && (
                  <>
                    {!myMembership && !isFull && !gathering.approval_required && (
                      <button
                        onClick={handleJoin}
                        style={{
                          width: '100%',
                          padding: '14px 0',
                          backgroundColor: 'var(--button-primary)',
                          color: 'white',
                          borderRadius: '12px',
                          fontWeight: 'bold',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '16px',
                          transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--button-primary-hover)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--button-primary)'}
                      >
                        참가하기
                      </button>
                    )}
                    {!myMembership && !isFull && gathering.approval_required && (
                      <button
                        onClick={handleApply}
                        style={{
                          width: '100%',
                          padding: '14px 0',
                          backgroundColor: 'var(--button-primary-hover)',
                          color: 'white',
                          borderRadius: '12px',
                          fontWeight: 'bold',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '16px'
                        }}
                      >
                        지원하기
                      </button>
                    )}
                    {myMembership && myMembership.status === 'pending' && (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          disabled
                          style={{
                            flex: 1,
                            padding: '14px 0',
                            backgroundColor: 'rgba(0,0,0,0.06)',
                            color: 'var(--text-muted)',
                            borderRadius: '12px',
                            fontWeight: 'bold',
                            border: 'none',
                            cursor: 'not-allowed',
                            fontSize: '16px'
                          }}
                        >
                          승인 대기중...
                        </button>
                        <button
                          onClick={handleCancel}
                          style={{
                            flex: 1,
                            padding: '14px 0',
                            backgroundColor: '#EF4444',
                            color: 'white',
                            borderRadius: '12px',
                            fontWeight: 'bold',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '16px',
                            transition: 'background-color 0.2s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--danger)'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#EF4444'}
                        >
                          신청 취소
                        </button>
                      </div>
                    )}
                    {myMembership && myMembership.status === 'approved' && (
                      <button
                        onClick={handleCancel}
                        style={{
                          width: '100%',
                          padding: '14px 0',
                          backgroundColor: '#EF4444',
                          color: 'white',
                          borderRadius: '12px',
                          fontWeight: 'bold',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '16px',
                          transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--danger)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#EF4444'}
                      >
                        참가 취소
                      </button>
                    )}
                    {myMembership && myMembership.status === 'rejected' && (
                      <button
                        disabled
                        style={{
                          width: '100%',
                          padding: '14px 0',
                          backgroundColor: 'rgba(0,0,0,0.06)',
                          color: 'var(--text-muted)',
                          borderRadius: '12px',
                          fontWeight: 'bold',
                          border: 'none',
                          cursor: 'not-allowed',
                          fontSize: '16px'
                        }}
                      >
                        거절되었습니다
                      </button>
                    )}
                    {isFull && !myMembership && (
                      <button
                        disabled
                        style={{
                          width: '100%',
                          padding: '14px 0',
                          backgroundColor: 'rgba(0,0,0,0.06)',
                          color: 'var(--text-muted)',
                          borderRadius: '12px',
                          fontWeight: 'bold',
                          border: 'none',
                          cursor: 'not-allowed',
                          fontSize: '16px'
                        }}
                      >
                        마감됨
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'chat' && (
          <ChatTab
            gatheringId={id}
            memberStatus={memberStatus}
            isCreator={gathering?.creator_id === currentUser?.id}
          />
        )}

        {activeTab === 'tools' && (
          <ToolsTab
            gatheringId={id}
            memberStatus={memberStatus}
            isCreator={gathering?.creator_id === currentUser?.id}
            currentMembers={gathering?.current_members || 0}
            members={members}
            currentUserId={currentUser?.id}
          />
        )}
      </div>

      {/* 평가 모달 */}
      {showEvalModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            padding: '24px',
          }}
          onClick={() => setShowEvalModal(false)}
        >
          <div
            style={{
              backgroundColor: 'var(--card-bg, #fff)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              width: '100%',
              maxWidth: '520px',
              borderRadius: '20px',
              padding: '28px',
              maxHeight: '80vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '6px', color: 'var(--text-primary)' }}>
              멤버 평가
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
              함께한 멤버들을 평가해주세요. 평가는 익명으로 진행됩니다.
            </p>

            {/* 멤버별 평가 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {getAllApprovedMemberIds().map(userId => {
                const member = members.find(m => m.user_id === userId);
                const isGatheringCreator = userId === gathering.creator_id;
                const nickname = isGatheringCreator
                  ? (creator?.nickname || '모임장')
                  : (member?.profiles?.nickname || '멤버');
                const hasExistingVotes = existingVotes[userId] && existingVotes[userId].size > 0;

                return (
                  <div key={userId} style={{
                    padding: '16px',
                    borderRadius: '14px',
                    backgroundColor: hasExistingVotes ? 'rgba(16, 185, 129, 0.06)' : 'rgba(0,0,0,0.03)',
                    border: hasExistingVotes ? '1px solid rgba(16, 185, 129, 0.15)' : '1px solid rgba(0,0,0,0.06)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                      <span style={{ fontWeight: '600', fontSize: '14px', color: 'var(--text-primary)' }}>
                        {nickname}
                      </span>
                      {isGatheringCreator && (
                        <span style={{
                          fontSize: '11px',
                          padding: '1px 8px',
                          borderRadius: '6px',
                          backgroundColor: 'rgba(107, 144, 128, 0.2)',
                          color: 'var(--button-primary)',
                          fontWeight: '500',
                        }}>
                          모임장
                        </span>
                      )}
                      {hasExistingVotes && (
                        <span style={{
                          fontSize: '11px',
                          padding: '1px 8px',
                          borderRadius: '6px',
                          backgroundColor: 'rgba(16, 185, 129, 0.15)',
                          color: '#059669',
                          fontWeight: '500',
                        }}>
                          평가 완료
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {evalVoteTypes.map(vt => {
                        const isSelected = evalVotes[userId]?.[vt.id];
                        const isExisting = existingVotes[userId]?.has(vt.id);
                        return (
                          <button
                            key={vt.id}
                            onClick={() => toggleEvalVote(userId, vt.id)}
                            disabled={isExisting}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '20px',
                              border: isSelected
                                ? '2px solid var(--button-primary)'
                                : '2px solid rgba(0,0,0,0.08)',
                              backgroundColor: isSelected
                                ? 'rgba(107, 144, 128, 0.15)'
                                : 'rgba(255,255,255,0.6)',
                              color: isSelected ? 'var(--button-primary)' : 'var(--text-secondary)',
                              cursor: isExisting ? 'not-allowed' : 'pointer',
                              fontSize: '13px',
                              fontWeight: isSelected ? '600' : '400',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              transition: 'all 0.2s',
                              opacity: isExisting ? 0.7 : 1,
                            }}
                          >
                            {vt.emoji}{vt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 하단 버튼 */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
              <button
                onClick={handleSubmitEval}
                disabled={evalSubmitting}
                style={{
                  flex: 1,
                  padding: '14px 0',
                  backgroundColor: evalSubmitting ? 'rgba(0,0,0,0.06)' : 'var(--button-primary)',
                  color: evalSubmitting ? 'var(--text-muted)' : 'white',
                  borderRadius: '12px',
                  fontWeight: '600',
                  border: 'none',
                  cursor: evalSubmitting ? 'not-allowed' : 'pointer',
                  fontSize: '15px',
                }}
              >
                {evalSubmitting ? '제출 중...' : '평가 완료'}
              </button>
              <button
                onClick={() => setShowEvalModal(false)}
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
                건너뛰기
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
