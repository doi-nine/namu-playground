import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import ChatTab from '../components/ChatTab';
import ToolsTab from '../components/ToolsTab';
import { useIsMobile } from '../hooks/useIsMobile';

export default function GatheringDetailPage() {
  const { user: authUser, profile } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [gathering, setGathering] = useState(null);
  const [creator, setCreator] = useState(null);
  const [members, setMembers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [myMembership, setMyMembership] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCopySuccess, setShowCopySuccess] = useState(false);
  const [activeTab, setActiveTab] = useState(location.state?.tab || 'info');

  // 공지 관련 state
  const [notices, setNotices] = useState([]);
  const [noticeForm, setNoticeForm] = useState({ title: '', content: '' });
  const [noticeSubmitting, setNoticeSubmitting] = useState(false);
  const [showNoticeForm, setShowNoticeForm] = useState(false);
  const [noticeFocused, setNoticeFocused] = useState(null);

  // 일정 관련 state
  const [schedules, setSchedules] = useState([]);
  const [myScheduleMemberships, setMyScheduleMemberships] = useState({}); // { [scheduleId]: boolean }

  // 일정 평가 관련 state
  const [scheduleEvalDone, setScheduleEvalDone] = useState({}); // { [scheduleId]: boolean }
  const [activeEvalScheduleId, setActiveEvalScheduleId] = useState(null);
  const [scheduleEvalVotes, setScheduleEvalVotes] = useState({});
  const [scheduleEvalKeywords, setScheduleEvalKeywords] = useState({});
  const [scheduleEvalSubmitting, setScheduleEvalSubmitting] = useState(false);
  const [evalScheduleMembers, setEvalScheduleMembers] = useState([]);

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

        const { data: creatorData, error: creatorError } = await supabase.from('profiles').select('nickname, is_premium, custom_badge').eq('id', gatheringData.creator_id).single();
        if (creatorError) throw creatorError;

        const { data: membersData, error: membersError } = await supabase
          .from('gathering_members')
          .select(`
          *,
          profiles (
            nickname,
            is_premium,
            custom_badge
          )
        `)
          .eq('gathering_id', id)
          .eq('status', 'approved');

        if (membersError) throw membersError;

        // 모든 멤버 + 모임장 인기도 점수 가져오기
        const allMemberIds = membersData?.map(m => m.user_id) || [];
        const allIds = [...new Set([...allMemberIds, gatheringData.creator_id])];
        let scoresMap = {};

        if (allIds.length > 0) {
          const { data: scoresData } = await supabase
            .from('popularity_scores')
            .select('user_id, total_score')
            .in('user_id', allIds);

          scoresData?.forEach(score => {
            scoresMap[score.user_id] = score.total_score;
          });
        }

        setCreator({ ...creatorData, popularity_score: scoresMap[gatheringData.creator_id] ?? 0 });

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

  // 공지 조회
  const fetchNotices = async () => {
    if (!id) return;
    const { data, error } = await supabase
      .from('notices')
      .select('*')
      .eq('gathering_id', id)
      .order('created_at', { ascending: false });
    if (!error) setNotices(data || []);
  };

  useEffect(() => {
    if (id) fetchNotices();
  }, [id]);

  const handleCreateNotice = async () => {
    if (!noticeForm.content.trim()) { alert('공지 내용을 입력해주세요.'); return; }
    setNoticeSubmitting(true);
    try {
      const { error } = await supabase.from('notices').insert([{
        gathering_id: id,
        created_by: currentUser.id,
        title: noticeForm.title.trim() || null,
        content: noticeForm.content.trim(),
      }]);
      if (error) throw error;
      setNoticeForm({ title: '', content: '' });
      setShowNoticeForm(false);
      fetchNotices();
    } catch (err) {
      alert('공지 작성 중 오류가 발생했습니다: ' + err.message);
    } finally {
      setNoticeSubmitting(false);
    }
  };

  const handleDeleteNotice = async (noticeId) => {
    if (!confirm('이 공지를 삭제하시겠습니까?')) return;
    try {
      const { error } = await supabase.from('notices').delete().eq('id', noticeId);
      if (error) throw error;
      setNotices(prev => prev.filter(n => n.id !== noticeId));
    } catch (err) {
      alert('공지 삭제 중 오류가 발생했습니다: ' + err.message);
    }
  };

  // 일정 조회
  const fetchSchedules = async () => {
    if (!id) return;
    try {
      const { data: schedulesData, error: schedulesError } = await supabase
        .from('schedules')
        .select('*')
        .eq('gathering_id', id)
        .order('datetime', { ascending: true });

      if (schedulesError) throw schedulesError;

      setSchedules(schedulesData || []);

      // 내 참여 여부 조회
      if (currentUser) {
        const scheduleIds = (schedulesData || []).map(s => s.id);
        if (scheduleIds.length > 0) {
          const { data: myMems } = await supabase
            .from('schedule_members')
            .select('schedule_id')
            .eq('user_id', currentUser.id)
            .in('schedule_id', scheduleIds);

          const membershipMap = {};
          (myMems || []).forEach(m => { membershipMap[m.schedule_id] = true; });
          setMyScheduleMemberships(membershipMap);

          // 완료된 일정 평가 여부 조회
          const completedIds = (schedulesData || []).filter(s => s.is_completed).map(s => s.id);
          if (completedIds.length > 0) {
            const { data: evalData } = await supabase
              .from('popularity_votes')
              .select('schedule_id')
              .eq('from_user_id', currentUser.id)
              .in('schedule_id', completedIds);

            const evalDoneMap = {};
            (evalData || []).forEach(v => { evalDoneMap[v.schedule_id] = true; });
            setScheduleEvalDone(evalDoneMap);
          }
        }
      }
    } catch (err) {
      console.error('일정 조회 오류:', err);
    }
  };

  useEffect(() => {
    if (id && currentUser !== undefined) {
      fetchSchedules();
    }
  }, [id, currentUser]);

  const refreshMembers = async () => {
    try {
      const { data: membersData } = await supabase
        .from('gathering_members')
        .select('*, profiles (nickname, is_premium, custom_badge)')
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

  // 일정 참여
  const handleJoinSchedule = async (scheduleId, currentCount) => {
    if (!currentUser) { alert('로그인이 필요합니다.'); return; }
    try {
      const { error: memberError } = await supabase
        .from('schedule_members')
        .insert([{ schedule_id: scheduleId, user_id: currentUser.id, status: 'approved' }]);
      if (memberError) throw memberError;

      const { error: updateError } = await supabase
        .from('schedules')
        .update({ current_members: currentCount + 1 })
        .eq('id', scheduleId);
      if (updateError) throw updateError;

      setMyScheduleMemberships(prev => ({ ...prev, [scheduleId]: true }));
      setSchedules(prev => prev.map(s => s.id === scheduleId ? { ...s, current_members: currentCount + 1 } : s));
    } catch (err) {
      console.error('일정 참여 오류:', err);
      alert('일정 참여 중 오류가 발생했습니다: ' + err.message);
    }
  };

  // 일정 참여 취소
  const handleLeaveSchedule = async (scheduleId, currentCount) => {
    if (!confirm('일정 참여를 취소하시겠습니까?')) return;
    try {
      const { error: deleteError } = await supabase
        .from('schedule_members')
        .delete()
        .eq('schedule_id', scheduleId)
        .eq('user_id', currentUser.id);
      if (deleteError) throw deleteError;

      const { error: updateError } = await supabase
        .from('schedules')
        .update({ current_members: Math.max(0, currentCount - 1) })
        .eq('id', scheduleId);
      if (updateError) throw updateError;

      setMyScheduleMemberships(prev => { const next = { ...prev }; delete next[scheduleId]; return next; });
      setSchedules(prev => prev.map(s => s.id === scheduleId ? { ...s, current_members: Math.max(0, currentCount - 1) } : s));
    } catch (err) {
      console.error('일정 취소 오류:', err);
      alert('일정 취소 중 오류가 발생했습니다: ' + err.message);
    }
  };

  // 일정 종료
  const handleCompleteSchedule = async (scheduleId) => {
    if (!confirm('이 일정을 종료하시겠습니까?')) return;
    try {
      const { error } = await supabase
        .from('schedules')
        .update({ is_completed: true })
        .eq('id', scheduleId);
      if (error) throw error;
      setSchedules(prev => prev.map(s => s.id === scheduleId ? { ...s, is_completed: true } : s));
    } catch (err) {
      console.error('일정 종료 오류:', err);
      alert('일정 종료 중 오류가 발생했습니다: ' + err.message);
    }
  };

  // 일정 평가 모달 열기
  const handleOpenScheduleEval = async (scheduleId) => {
    try {
      const { data: smData, error } = await supabase
        .from('schedule_members')
        .select('user_id, profiles(nickname, custom_badge)')
        .eq('schedule_id', scheduleId);

      if (error) throw error;

      const others = (smData || []).filter(m => m.user_id !== currentUser.id);
      setEvalScheduleMembers(others);

      const initialVotes = {};
      const initialKeywords = {};
      others.forEach(m => { initialVotes[m.user_id] = null; initialKeywords[m.user_id] = []; });
      setScheduleEvalVotes(initialVotes);
      setScheduleEvalKeywords(initialKeywords);
      setActiveEvalScheduleId(scheduleId);
    } catch (err) {
      console.error('평가 멤버 조회 오류:', err);
      alert('평가 멤버 조회 중 오류가 발생했습니다: ' + err.message);
    }
  };

  const toggleScheduleEvalKeyword = (userId, keyword) => {
    setScheduleEvalKeywords(prev => {
      const current = prev[userId] || [];
      const exists = current.includes(keyword);
      return { ...prev, [userId]: exists ? current.filter(k => k !== keyword) : [...current, keyword] };
    });
  };

  // 일정 평가 제출
  const handleSubmitScheduleEval = async () => {
    setScheduleEvalSubmitting(true);
    const errors = [];
    try {
      for (const [targetUserId, direction] of Object.entries(scheduleEvalVotes)) {
        if (!direction) continue;
        const voteType = direction === 'up' ? 'thumbs_up' : 'thumbs_down';
        const { data: result, error } = await supabase.rpc('submit_schedule_eval', {
          p_from_user_id: currentUser.id,
          p_to_user_id: targetUserId,
          p_vote_type: voteType,
          p_schedule_id: activeEvalScheduleId,
        });
        if (error) { errors.push(error.message); continue; }
        if (result && !result.success) { errors.push(result.error); continue; }

        if (direction === 'up') {
          for (const keyword of (scheduleEvalKeywords[targetUserId] || [])) {
            const { error: kwErr } = await supabase.rpc('submit_schedule_eval', {
              p_from_user_id: currentUser.id,
              p_to_user_id: targetUserId,
              p_vote_type: keyword,
              p_schedule_id: activeEvalScheduleId,
            });
            if (kwErr) errors.push(`키워드(${keyword}): ${kwErr.message}`);
          }
        }
      }

      setScheduleEvalDone(prev => ({ ...prev, [activeEvalScheduleId]: true }));
      setActiveEvalScheduleId(null);

      if (errors.length > 0) {
        alert('평가가 완료되었지만 일부 오류가 있었습니다:\n' + errors.join('\n'));
      } else {
        alert('평가가 완료되었습니다!');
      }
    } catch (err) {
      console.error('평가 제출 오류:', err);
      alert('평가 제출 중 오류가 발생했습니다: ' + err.message);
    } finally {
      setScheduleEvalSubmitting(false);
    }
  };

  const evalKeywordTypes = [
    { id: 'kind', label: '정말 친절해요' },
    { id: 'friendly', label: '친화력이 좋아요' },
    { id: 'punctual', label: '약속 시간을 잘 지켜요' },
    { id: 'cheerful', label: '유쾌해요' },
    { id: 'active', label: '적극적이에요' },
    { id: 'vibe_maker', label: '분위기 메이커' },
  ];

  const refreshScores = async () => {
    if (!gathering) return;
    const allMemberIds = members.map(m => m.user_id);
    const allIds = [...new Set([...allMemberIds, gathering.creator_id])];
    if (allIds.length === 0) return;

    const { data: scoresData } = await supabase
      .from('popularity_scores')
      .select('user_id, total_score')
      .in('user_id', allIds);

    const scoresMap = {};
    scoresData?.forEach(s => { scoresMap[s.user_id] = s.total_score; });

    setCreator(prev => prev ? { ...prev, popularity_score: scoresMap[gathering.creator_id] ?? 0 } : prev);
    setMembers(prev => prev.map(m => ({ ...m, popularity_score: scoresMap[m.user_id] ?? 0 })));
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
  const memberStatus = myMembership?.status;
  const isApprovedMember = myMembership?.status === 'approved' || isCreator;

  // 일정 정렬: 미완료 오름차순 → 완료 오름차순
  const sortedSchedules = [...schedules].sort((a, b) => {
    if (a.is_completed !== b.is_completed) return a.is_completed ? 1 : -1;
    return new Date(a.datetime) - new Date(b.datetime);
  });

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', ...(isMobile ? { width: '93%' } : {}) }}>
      {/* Main Card */}
      <div style={{ padding: isMobile ? '12px 4px' : '28px 4px' }}>
        {/* Edit Button */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: '12px' }}>
          {isCreator && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => navigate(`/gatherings/${id}/members`)}
                style={{
                  padding: '5px 14px',
                  fontSize: '13px',
                  fontWeight: '500',
                  backgroundColor: '#FFFFFF',
                  color: 'var(--button-primary)',
                  border: '1px solid var(--button-primary)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(107,144,128,0.08)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#FFFFFF'}
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
        <div
          className={isMobile ? 'tab-scroll' : ''}
          style={{
            borderBottom: '2px solid rgba(0,0,0,0.06)',
            marginBottom: '24px',
            display: 'flex',
            flexWrap: 'nowrap',
            gap: '4px',
          }}
        >
          {[
            { key: 'info', label: '모임' },
            { key: 'notices', label: '공지' },
            { key: 'schedules', label: '일정' },
            { key: 'chat', label: '대화' },
            { key: 'tools', label: '도구' }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: isMobile ? '10px 14px' : '12px 20px',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === tab.key ? '3px solid var(--button-primary)' : '3px solid transparent',
                color: activeTab === tab.key ? 'var(--button-primary)' : (isMobile ? '#6E7B70' : 'var(--text-muted)'),
                fontWeight: activeTab === tab.key ? '600' : '400',
                cursor: 'pointer',
                fontSize: isMobile ? '13px' : '15px',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'info' && (
          <div>
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

            {/* Members Section */}
            <div
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.75)',
                borderRadius: '14px',
                padding: '24px',
                marginBottom: '16px',
              }}
            >
              <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '12px', color: 'var(--text-primary)' }}>멤버 ({actualMemberCount}명)</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {/* 모임장 */}
                {creator && (
                  <div
                    onClick={() => navigate(`/users/${gathering.creator_id}`)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      backgroundColor: 'rgba(107, 144, 128, 0.12)',
                      borderRadius: '10px',
                      transition: 'background-color 0.2s',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(107, 144, 128, 0.2)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(107, 144, 128, 0.12)'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                      <span style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{creator.nickname}</span>
                      {creator.custom_badge && (
                        <span style={{
                          padding: '1px 6px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: '500',
                          backgroundColor: 'rgba(107, 144, 128, 0.15)',
                          color: 'var(--button-primary)',
                        }}>
                          {creator.custom_badge}
                        </span>
                      )}
                    </div>

                    {(profile?.is_premium || currentUser?.id === gathering.creator_id) && creator.popularity_score !== undefined && (
                      <span style={{
                        fontSize: '14px',
                        fontWeight: 'bold',
                        color: creator.popularity_score >= 0 ? '#16A34A' : 'var(--danger)'
                      }}>
                        ⭐ {creator.popularity_score >= 0 ? '+' : ''}{creator.popularity_score}
                      </span>
                    )}
                  </div>
                )}

                {/* 일반 참가자 (모임장 제외) */}
                {members.filter(m => m.user_id !== gathering.creator_id).map((member) => (
                  <div
                    key={member.id}
                    onClick={() => navigate(`/users/${member.user_id}`)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      backgroundColor: 'rgba(0,0,0,0.03)',
                      borderRadius: '10px',
                      transition: 'background-color 0.2s',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.06)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.03)'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{member.profiles?.nickname || '익명'}</span>
                      {member.profiles?.custom_badge && (
                        <span style={{
                          padding: '1px 6px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: '500',
                          backgroundColor: 'rgba(107, 144, 128, 0.15)',
                          color: 'var(--button-primary)',
                        }}>
                          {member.profiles.custom_badge}
                        </span>
                      )}
                    </div>

                    {(profile?.is_premium || currentUser?.id === member.user_id) && member.popularity_score !== undefined && (
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

            {/* Action Buttons */}
            {!isCreator && (
              <div style={{ marginTop: '16px' }}>
                {!myMembership && !gathering.approval_required && (
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
                    모임 가입하기
                  </button>
                )}
                {!myMembership && gathering.approval_required && (
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
                    가입 신청하기
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
                    모임 탈퇴
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ─── 공지 탭 ─── */}
        {activeTab === 'notices' && (
          <div>
            {isCreator && (
              <div style={{ marginBottom: '16px' }}>
                {!showNoticeForm ? (
                  <button
                    onClick={() => setShowNoticeForm(true)}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: 'var(--button-primary)',
                      color: 'white',
                      borderRadius: '10px',
                      border: 'none',
                      cursor: 'pointer',
                      fontWeight: '600',
                      fontSize: '14px',
                      transition: 'background-color 0.2s',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--button-primary-hover)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--button-primary)'}
                  >
                    + 공지 작성
                  </button>
                ) : (
                  <div style={{ backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: '14px', padding: '20px', marginBottom: '8px' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '14px', color: 'var(--text-primary)' }}>새 공지 작성</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <input
                        type="text"
                        placeholder="제목 (선택)"
                        value={noticeForm.title}
                        onChange={(e) => setNoticeForm(prev => ({ ...prev, title: e.target.value }))}
                        onFocus={() => setNoticeFocused('title')}
                        onBlur={() => setNoticeFocused(null)}
                        style={{
                          width: '100%', padding: '10px 14px', fontSize: '14px',
                          border: `1px solid ${noticeFocused === 'title' ? 'var(--button-primary)' : 'rgba(0,0,0,0.1)'}`,
                          borderRadius: '10px', backgroundColor: 'rgba(255,255,255,0.7)',
                          color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
                          boxShadow: noticeFocused === 'title' ? '0 0 0 3px rgba(107,144,128,0.15)' : 'none',
                          transition: 'border-color 0.2s, box-shadow 0.2s',
                        }}
                      />
                      <textarea
                        placeholder="공지 내용을 입력하세요 *"
                        value={noticeForm.content}
                        onChange={(e) => setNoticeForm(prev => ({ ...prev, content: e.target.value }))}
                        onFocus={() => setNoticeFocused('content')}
                        onBlur={() => setNoticeFocused(null)}
                        rows={4}
                        style={{
                          width: '100%', padding: '10px 14px', fontSize: '14px',
                          border: `1px solid ${noticeFocused === 'content' ? 'var(--button-primary)' : 'rgba(0,0,0,0.1)'}`,
                          borderRadius: '10px', backgroundColor: 'rgba(255,255,255,0.7)',
                          color: 'var(--text-primary)', outline: 'none', resize: 'none', boxSizing: 'border-box',
                          boxShadow: noticeFocused === 'content' ? '0 0 0 3px rgba(107,144,128,0.15)' : 'none',
                          transition: 'border-color 0.2s, box-shadow 0.2s',
                        }}
                      />
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={handleCreateNotice}
                          disabled={noticeSubmitting}
                          style={{
                            flex: 1, padding: '10px 0',
                            backgroundColor: noticeSubmitting ? 'rgba(0,0,0,0.06)' : 'var(--button-primary)',
                            color: noticeSubmitting ? 'var(--text-muted)' : 'white',
                            borderRadius: '10px', border: 'none',
                            cursor: noticeSubmitting ? 'not-allowed' : 'pointer',
                            fontWeight: '600', fontSize: '14px',
                          }}
                        >
                          {noticeSubmitting ? '등록 중...' : '공지 등록'}
                        </button>
                        <button
                          onClick={() => { setShowNoticeForm(false); setNoticeForm({ title: '', content: '' }); }}
                          style={{
                            flex: 1, padding: '10px 0',
                            backgroundColor: 'rgba(0,0,0,0.06)', color: 'var(--text-secondary)',
                            borderRadius: '10px', border: 'none', cursor: 'pointer',
                            fontWeight: '500', fontSize: '14px',
                          }}
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {notices.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: '48px 24px',
                backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: '14px',
              }}>
                <p style={{ fontSize: '16px', color: 'var(--text-muted)' }}>등록된 공지가 없습니다.</p>
                {isCreator && (
                  <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '8px' }}>
                    위의 버튼으로 첫 공지를 작성해보세요!
                  </p>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {notices.map((notice) => (
                  <div
                    key={notice.id}
                    style={{
                      backgroundColor: 'rgba(255,255,255,0.75)',
                      borderRadius: '14px',
                      padding: '20px',
                      border: '1px solid rgba(107,144,128,0.15)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          fontSize: '11px', padding: '2px 8px', borderRadius: '6px',
                          backgroundColor: 'rgba(107,144,128,0.15)', color: 'var(--button-primary)', fontWeight: '600',
                        }}>공지</span>
                        {notice.title && (
                          <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                            {notice.title}
                          </h3>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          {new Date(notice.created_at).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
                        </span>
                        {isCreator && (
                          <button
                            onClick={() => handleDeleteNotice(notice.id)}
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer',
                              fontSize: '13px', color: 'var(--text-muted)', padding: '2px 6px',
                              borderRadius: '6px', transition: 'color 0.2s',
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--danger)'}
                            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                          >
                            삭제
                          </button>
                        )}
                      </div>
                    </div>
                    <p style={{ fontSize: '14px', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: '1.7', margin: 0 }}>
                      {notice.content}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── 일정 탭 ─── */}
        {activeTab === 'schedules' && (
          <div>
            {isApprovedMember && (
              <div style={{ marginBottom: '16px' }}>
                <button
                  onClick={() => navigate(`/gatherings/${id}/schedules/create`)}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: 'var(--button-primary)',
                    color: 'white',
                    borderRadius: '10px',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '14px',
                    transition: 'background-color 0.2s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--button-primary-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--button-primary)'}
                >
                  + 일정 추가
                </button>
              </div>
            )}

            {sortedSchedules.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '48px 24px',
                backgroundColor: 'rgba(255,255,255,0.6)',
                borderRadius: '14px',
              }}>
                <p style={{ fontSize: '16px', color: 'var(--text-muted)' }}>등록된 일정이 없습니다.</p>
                {isApprovedMember && (
                  <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '8px' }}>
                    위의 버튼으로 첫 일정을 추가해보세요!
                  </p>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {sortedSchedules.map((schedule) => {
                  const isMySchedule = myScheduleMemberships[schedule.id];
                  const isScheduleCreator = currentUser && schedule.created_by === currentUser.id;
                  const isFull = schedule.current_members >= schedule.max_members;
                  const canEval = schedule.is_completed && isMySchedule && !scheduleEvalDone[schedule.id];

                  return (
                    <div
                      key={schedule.id}
                      onClick={() => navigate(`/gatherings/${id}/schedules/${schedule.id}`)}
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.75)',
                        borderRadius: '14px',
                        padding: '20px',
                        border: schedule.is_completed ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(0,0,0,0.06)',
                        opacity: schedule.is_completed ? 0.85 : 1,
                        cursor: 'pointer',
                        transition: 'box-shadow 0.2s',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'}
                      onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>
                          {schedule.title}
                          {schedule.is_completed && (
                            <span style={{ marginLeft: '8px', fontSize: '12px', color: '#059669', fontWeight: '500' }}>✅ 완료</span>
                          )}
                        </h3>
                      </div>

                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px', display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                        <span>📅 {formatDateTime(schedule.datetime)}</span>
                        <span>
                          {schedule.location_type === 'offline' ? '📍' : '💻'}{' '}
                          {schedule.location_type === 'offline' ? (schedule.location || '장소 미정') : (schedule.online_link || '링크 미정')}
                        </span>
                        <span>👥 {schedule.current_members}/{schedule.max_members}명</span>
                      </div>

                      {schedule.description && (
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px', whiteSpace: 'pre-wrap' }}>
                          {schedule.description}
                        </p>
                      )}

                      {!schedule.is_completed && isApprovedMember && (
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }} onClick={(e) => e.stopPropagation()}>
                          {!isMySchedule ? (
                            <button
                              onClick={() => handleJoinSchedule(schedule.id, schedule.current_members)}
                              disabled={isFull}
                              style={{
                                padding: '8px 16px',
                                backgroundColor: isFull ? 'rgba(0,0,0,0.06)' : 'var(--button-primary)',
                                color: isFull ? 'var(--text-muted)' : 'white',
                                borderRadius: '8px',
                                border: 'none',
                                cursor: isFull ? 'not-allowed' : 'pointer',
                                fontSize: '13px',
                                fontWeight: '500',
                                transition: 'background-color 0.2s',
                              }}
                            >
                              {isFull ? '마감' : '참여하기'}
                            </button>
                          ) : (
                            <button
                              onClick={() => handleLeaveSchedule(schedule.id, schedule.current_members)}
                              style={{
                                padding: '8px 16px',
                                backgroundColor: '#EF4444',
                                color: 'white',
                                borderRadius: '8px',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: '13px',
                                fontWeight: '500',
                                transition: 'background-color 0.2s',
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--danger)'}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#EF4444'}
                            >
                              참여 취소
                            </button>
                          )}
                          {isScheduleCreator && (
                            <button
                              onClick={() => handleCompleteSchedule(schedule.id)}
                              style={{
                                padding: '8px 16px',
                                backgroundColor: 'rgba(16,185,129,0.1)',
                                color: '#059669',
                                borderRadius: '8px',
                                border: '1px solid rgba(16,185,129,0.3)',
                                cursor: 'pointer',
                                fontSize: '13px',
                                fontWeight: '500',
                              }}
                            >
                              일정 종료
                            </button>
                          )}
                        </div>
                      )}

                      {canEval && (
                        <div style={{ marginTop: '8px' }} onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleOpenScheduleEval(schedule.id)}
                            style={{
                              padding: '8px 16px',
                              backgroundColor: 'rgba(107,144,128,0.1)',
                              color: 'var(--button-primary)',
                              borderRadius: '8px',
                              border: '1px solid rgba(107,144,128,0.3)',
                              cursor: 'pointer',
                              fontSize: '13px',
                              fontWeight: '600',
                            }}
                          >
                            ⭐ 평가하기
                          </button>
                        </div>
                      )}
                      {schedule.is_completed && scheduleEvalDone[schedule.id] && (
                        <p style={{ fontSize: '12px', color: '#059669', marginTop: '8px' }}>✅ 평가 완료</p>
                      )}
                    </div>
                  );
                })}
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

      {/* 일정 평가 모달 */}
      {activeEvalScheduleId && (
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
          onClick={() => setActiveEvalScheduleId(null)}
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
              일정 멤버 평가
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
              함께한 멤버들을 평가해주세요. 평가는 익명으로 진행됩니다.
            </p>

            {evalScheduleMembers.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px 0' }}>평가할 멤버가 없습니다.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {evalScheduleMembers.map(member => {
                  const direction = scheduleEvalVotes[member.user_id];
                  return (
                    <div key={member.user_id} style={{
                      padding: '14px 16px',
                      borderRadius: '14px',
                      backgroundColor: direction === 'up' ? 'rgba(107,144,128,0.05)' : 'rgba(0,0,0,0.03)',
                      border: '1px solid rgba(0,0,0,0.06)',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: '600', fontSize: '14px', color: 'var(--text-primary)' }}>
                            {member.profiles?.nickname || '멤버'}
                          </span>
                          {member.profiles?.custom_badge && (
                            <span style={{
                              padding: '1px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: '500',
                              backgroundColor: 'rgba(107,144,128,0.15)', color: 'var(--button-primary)',
                            }}>
                              {member.profiles.custom_badge}
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => {
                              const newDir = direction === 'up' ? null : 'up';
                              setScheduleEvalVotes(prev => ({ ...prev, [member.user_id]: newDir }));
                              if (newDir === null) setScheduleEvalKeywords(prev => ({ ...prev, [member.user_id]: [] }));
                            }}
                            style={{
                              fontSize: '22px', background: 'none',
                              border: direction === 'up' ? '2px solid var(--button-primary)' : '2px solid transparent',
                              borderRadius: '8px', cursor: 'pointer', padding: '4px 8px',
                              opacity: direction === 'down' ? 0.35 : 1, transition: 'all 0.15s',
                            }}
                          >
                            👍
                          </button>
                          <button
                            onClick={() => {
                              const newDir = direction === 'down' ? null : 'down';
                              setScheduleEvalVotes(prev => ({ ...prev, [member.user_id]: newDir }));
                              setScheduleEvalKeywords(prev => ({ ...prev, [member.user_id]: [] }));
                            }}
                            style={{
                              fontSize: '22px', background: 'none',
                              border: direction === 'down' ? '2px solid #EF4444' : '2px solid transparent',
                              borderRadius: '8px', cursor: 'pointer', padding: '4px 8px',
                              opacity: direction === 'up' ? 0.35 : 1, transition: 'all 0.15s',
                            }}
                          >
                            👎
                          </button>
                        </div>
                      </div>
                      {direction === 'up' && (
                        <div style={{ marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {evalKeywordTypes.map(kw => {
                            const isKwSelected = (scheduleEvalKeywords[member.user_id] || []).includes(kw.id);
                            return (
                              <button
                                key={kw.id}
                                onClick={() => toggleScheduleEvalKeyword(member.user_id, kw.id)}
                                style={{
                                  padding: '5px 12px', borderRadius: '20px',
                                  border: isKwSelected ? '2px solid var(--button-primary)' : '2px solid rgba(0,0,0,0.1)',
                                  backgroundColor: isKwSelected ? 'rgba(107,144,128,0.15)' : 'rgba(255,255,255,0.7)',
                                  color: isKwSelected ? 'var(--button-primary)' : 'var(--text-secondary)',
                                  cursor: 'pointer', fontSize: '12px',
                                  fontWeight: isKwSelected ? '600' : '400',
                                  transition: 'all 0.15s', fontFamily: 'inherit',
                                }}
                              >
                                {kw.label}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
              <button
                onClick={handleSubmitScheduleEval}
                disabled={scheduleEvalSubmitting}
                style={{
                  flex: 1, padding: '14px 0',
                  backgroundColor: scheduleEvalSubmitting ? 'rgba(0,0,0,0.06)' : 'var(--button-primary)',
                  color: scheduleEvalSubmitting ? 'var(--text-muted)' : 'white',
                  borderRadius: '12px', fontWeight: '600', border: 'none',
                  cursor: scheduleEvalSubmitting ? 'not-allowed' : 'pointer', fontSize: '15px',
                }}
              >
                {scheduleEvalSubmitting ? '제출 중...' : '평가 완료'}
              </button>
              <button
                onClick={() => setActiveEvalScheduleId(null)}
                style={{
                  flex: 1, padding: '14px 0',
                  backgroundColor: 'rgba(0,0,0,0.06)',
                  color: 'var(--text-secondary)',
                  borderRadius: '12px', fontWeight: '500', border: 'none',
                  cursor: 'pointer', fontSize: '15px',
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
