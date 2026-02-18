import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useIsMobile } from '../hooks/useIsMobile';

export default function ScheduleDetailPage() {
  const { id, scheduleId } = useParams();
  const navigate = useNavigate();
  const { profile, refreshProfile } = useAuth();
  const isMobile = useIsMobile();

  const [schedule, setSchedule] = useState(null);
  const [members, setMembers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [myMembership, setMyMembership] = useState(false);
  const [gatheringMembership, setGatheringMembership] = useState(null);
  const [evalDone, setEvalDone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('info');

  // 평가 state
  const [showEval, setShowEval] = useState(false);
  const [evalVotes, setEvalVotes] = useState({});
  const [evalKeywords, setEvalKeywords] = useState({});
  const [evalSubmitting, setEvalSubmitting] = useState(false);

  // 채팅 state
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [chatLoading, setChatLoading] = useState(true);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const isAtBottom = useRef(false);

  // 요약 state
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [summaryText, setSummaryText] = useState('');
  const [summaryRemaining, setSummaryRemaining] = useState(null);

  const evalKeywordTypes = [
    { id: 'kind', label: '정말 친절해요' },
    { id: 'friendly', label: '친화력이 좋아요' },
    { id: 'punctual', label: '약속 시간을 잘 지켜요' },
    { id: 'cheerful', label: '유쾌해요' },
    { id: 'active', label: '적극적이에요' },
    { id: 'vibe_maker', label: '분위기 메이커' },
  ];

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
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
    };
    init();
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    fetchAll();
  }, [currentUser, scheduleId]);

  useEffect(() => {
    if (activeTab === 'chat' && currentUser) {
      fetchMessages();
      const interval = setInterval(fetchMessages, 5000);
      return () => clearInterval(interval);
    }
  }, [activeTab, currentUser]);

  // 대화탭 진입 시 최하단으로 즉시 스크롤 (초기 로드 + 탭 재진입 공통)
  useEffect(() => {
    if (!chatLoading) {
      requestAnimationFrame(() => {
        const container = messagesContainerRef.current;
        if (container) container.scrollTop = container.scrollHeight;
      });
    }
  }, [chatLoading, activeTab]);

  // 새 메시지 도착 시 채팅창 최하단 자동 스크롤 (모바일/데스크탑 공통)
  useEffect(() => {
    requestAnimationFrame(() => {
      const container = messagesContainerRef.current;
      if (container) container.scrollTop = container.scrollHeight;
    });
  }, [messages]);

  const fetchAll = async () => {
    try {
      setLoading(true);

      const { data: scheduleData, error: scheduleError } = await supabase
        .from('schedules')
        .select('*')
        .eq('id', scheduleId)
        .single();
      if (scheduleError) throw scheduleError;
      setSchedule(scheduleData);

      const { data: membersData } = await supabase
        .from('schedule_members')
        .select('user_id, status, attendance_status, profiles(nickname, custom_badge, is_premium)')
        .eq('schedule_id', scheduleId);
      setMembers(membersData || []);

      const isMember = (membersData || []).some(m => m.user_id === currentUser.id);
      setMyMembership(isMember);

      const { data: gm } = await supabase
        .from('gathering_members')
        .select('status')
        .eq('gathering_id', id)
        .eq('user_id', currentUser.id)
        .maybeSingle();
      setGatheringMembership(gm);

      if (scheduleData.is_completed && isMember) {
        const { data: evalData } = await supabase
          .from('popularity_votes')
          .select('id')
          .eq('from_user_id', currentUser.id)
          .eq('schedule_id', parseInt(scheduleId))
          .eq('is_active', true)
          .limit(1);
        setEvalDone((evalData || []).length > 0);
      }
    } catch (err) {
      console.error('일정 상세 조회 오류:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*, profiles(nickname, custom_badge, is_premium)')
        .eq('schedule_id', scheduleId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setMessages(prev => {
        const next = data || [];
        if (prev.length === next.length && prev.length > 0 &&
          prev[prev.length - 1].id === next[next.length - 1]?.id) return prev;
        return next;
      });
    } catch (err) {
      console.error('메시지 조회 오류:', err);
    } finally {
      setChatLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !myMembership) return;
    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({ schedule_id: scheduleId, user_id: currentUser.id, content: newMessage.trim() })
        .select('*, profiles(nickname, custom_badge, is_premium)')
        .single();
      if (error) throw error;
      setMessages(prev => [...prev, data]);
      setNewMessage('');
    } catch (err) {
      console.error('메시지 전송 오류:', err);
      alert('메시지 전송에 실패했습니다.');
    }
  };

  const handleJoin = async () => {
    try {
      const { error: memberError } = await supabase
        .from('schedule_members')
        .insert([{ schedule_id: scheduleId, user_id: currentUser.id, status: 'approved' }]);
      if (memberError) throw memberError;
      await supabase.from('schedules').update({ current_members: schedule.current_members + 1 }).eq('id', scheduleId);
      setSchedule(prev => ({ ...prev, current_members: prev.current_members + 1 }));
      setMyMembership(true);
      fetchAll();
    } catch (err) {
      alert('참여 중 오류가 발생했습니다: ' + err.message);
    }
  };

  const handleLeave = async () => {
    if (!confirm('일정 참여를 취소하시겠습니까?')) return;
    try {
      // 탈퇴자가 모집장인 경우 다른 멤버에게 자동 양도
      if (schedule.created_by === currentUser.id) {
        const others = members.filter(m => m.user_id !== currentUser.id);
        if (others.length > 0) {
          await supabase.from('schedules')
            .update({ created_by: others[0].user_id })
            .eq('id', scheduleId);
        }
      }

      await supabase.from('schedule_members').delete().eq('schedule_id', scheduleId).eq('user_id', currentUser.id);
      await supabase.from('schedules').update({ current_members: Math.max(0, schedule.current_members - 1) }).eq('id', scheduleId);
      setSchedule(prev => ({ ...prev, current_members: Math.max(0, prev.current_members - 1) }));
      setMyMembership(false);
      fetchAll();
    } catch (err) {
      alert('취소 중 오류가 발생했습니다: ' + err.message);
    }
  };

  const handleComplete = async () => {
    if (!confirm('이 일정을 종료하시겠습니까?')) return;
    try {
      await supabase.from('schedules').update({ is_completed: true }).eq('id', scheduleId);
      setSchedule(prev => ({ ...prev, is_completed: true }));
    } catch (err) {
      alert('일정 종료 중 오류가 발생했습니다: ' + err.message);
    }
  };

  const handleDeleteSchedule = async () => {
    if (!confirm('일정을 취소하시겠습니까? 참여 멤버에게 알림이 전송됩니다.')) return;
    try {
      // 참여 멤버들에게 일정 취소 알림 전송 (생성자 제외)
      const otherMembers = members.filter(m => m.user_id !== currentUser.id);
      if (otherMembers.length > 0) {
        await supabase.from('notifications').insert(
          otherMembers.map(m => ({
            user_id: m.user_id,
            type: 'schedule_cancelled',
            gathering_id: schedule.gathering_id,
            related_user_id: currentUser.id,
          }))
        );
      }
      await supabase.from('schedules').delete().eq('id', scheduleId);
      navigate(`/gatherings/${id}`, { state: { tab: 'schedules' } });
    } catch (err) {
      alert('일정 취소 중 오류가 발생했습니다: ' + err.message);
    }
  };

  const handleAttendanceStatus = async (e, newStatus) => {
    e.stopPropagation();
    try {
      await supabase
        .from('schedule_members')
        .update({ attendance_status: newStatus })
        .eq('schedule_id', scheduleId)
        .eq('user_id', currentUser.id);
      setMembers(prev => prev.map(m =>
        m.user_id === currentUser.id ? { ...m, attendance_status: newStatus } : m
      ));
    } catch (err) {
      console.error('참석 상태 변경 오류:', err);
    }
  };

  const handleSummarize = async () => {
    if (messages.length === 0) {
      alert('요약할 메시지가 없습니다.');
      return;
    }

    // 무료 유저 횟수 체크 (프론트 사전 검증)
    if (!profile?.is_premium) {
      const left = summaryRemaining !== null ? summaryRemaining : (profile?.ai_chat_summary_left ?? 3);
      if (left <= 0) {
        alert('이번 달 무료 채팅 요약 횟수를 모두 사용했습니다. 프리미엄으로 업그레이드하면 무제한으로 이용할 수 있어요!');
        return;
      }
    }

    setSummaryLoading(true);
    try {
      const formatted = messages.map(msg => ({
        nickname: msg.profiles?.nickname || '알 수 없음',
        content: msg.content,
        time: new Date(msg.created_at).toLocaleTimeString('ko-KR', {
          hour: '2-digit',
          minute: '2-digit'
        })
      }));

      const { data, error } = await supabase.functions.invoke('ai-chat-summary', {
        body: { schedule_id: scheduleId, messages: formatted }
      });

      if (error) throw error;
      if (data?.error) {
        alert(data.error);
        return;
      }

      setSummaryText(data.summary);
      if (data.remaining !== null && data.remaining !== undefined) {
        setSummaryRemaining(data.remaining);
      }
      setShowSummaryModal(true);

      // 프로필 새로고침 (잔여 횟수 동기화)
      if (!profile?.is_premium) { refreshProfile(); }
    } catch (err) {
      console.error('채팅 요약 오류:', err);
      alert('채팅 요약 중 오류가 발생했습니다: ' + (err.message || '알 수 없는 오류'));
    } finally {
      setSummaryLoading(false);
    }
  };

  const openEval = () => {
    const others = members.filter(m => m.user_id !== currentUser.id);
    const votes = {};
    const keywords = {};
    others.forEach(m => { votes[m.user_id] = null; keywords[m.user_id] = []; });
    setEvalVotes(votes);
    setEvalKeywords(keywords);
    setShowEval(true);
  };

  const toggleKeyword = (userId, keyword) => {
    setEvalKeywords(prev => {
      const cur = prev[userId] || [];
      return { ...prev, [userId]: cur.includes(keyword) ? cur.filter(k => k !== keyword) : [...cur, keyword] };
    });
  };

  const handleSubmitEval = async () => {
    setEvalSubmitting(true);
    try {
      const votes = [];
      for (const [targetId, direction] of Object.entries(evalVotes)) {
        if (!direction) continue;
        const voteType = direction === 'up' ? 'thumbs_up' : 'thumbs_down';
        votes.push({ to_user_id: targetId, vote_type: voteType });
        if (direction === 'up') {
          for (const kw of (evalKeywords[targetId] || [])) {
            votes.push({ to_user_id: targetId, vote_type: kw });
          }
        }
      }
      const { data, error } = await supabase.functions.invoke('submit-eval', {
        body: { schedule_id: parseInt(scheduleId), votes },
      });
      if (error) throw error;
      if (data && !data.success) throw new Error(data.error);
      setEvalDone(true);
      setShowEval(false);
      alert('평가가 완료되었습니다!');
    } catch (err) {
      alert('평가 제출 중 오류가 발생했습니다: ' + err.message);
    } finally {
      setEvalSubmitting(false);
    }
  };

  const handleScroll = () => {
    const c = messagesContainerRef.current;
    if (!c) return;
    isAtBottom.current = c.scrollHeight - c.scrollTop - c.clientHeight < 80;
  };

  if (loading) {
    return (
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '32px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
        불러오는 중...
      </div>
    );
  }

  if (!schedule) {
    return (
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '32px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
        일정을 찾을 수 없습니다.
      </div>
    );
  }

  if (!gatheringMembership || gatheringMembership.status === 'kicked') {
    return (
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '32px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
        <p style={{ color: 'var(--text-primary)', fontWeight: '600', fontSize: '16px', marginBottom: '8px' }}>
          접근할 수 없는 일정입니다
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '24px' }}>
          모임 멤버만 일정에 접근할 수 있습니다.
        </p>
        <button
          onClick={() => navigate(`/gatherings/${id}`)}
          style={{
            padding: '10px 24px',
            backgroundColor: 'var(--button-primary)',
            color: '#FFFFFF',
            borderRadius: '12px',
            border: 'none',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '14px',
          }}
        >
          모임으로 돌아가기
        </button>
      </div>
    );
  }

  const isScheduleCreator = currentUser && schedule.created_by === currentUser.id;
  const isApprovedGatheringMember = gatheringMembership?.status === 'approved' || isScheduleCreator;
  const isFull = schedule.current_members >= schedule.max_members;
  const canEval = schedule.is_completed && myMembership && !evalDone;

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: isMobile ? '12px 4px 100px' : '28px 4px 100px', ...(isMobile ? { width: '93%' } : {}) }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: isMobile ? '0px' : '20px', padding: '0 4px' }}>
        <button
          onClick={() => navigate(`/gatherings/${id}`, { state: { tab: 'schedules' } })}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '4px 8px', borderRadius: '8px', fontSize: '20px',
            color: isMobile ? 'var(--text-primary)' : 'var(--button-primary)', display: 'flex', alignItems: 'center',
            transition: 'background-color 0.2s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(107,144,128,0.1)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          ‹
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: '22px', fontWeight: '700', margin: 0, color: isMobile ? 'var(--text-primary)' : 'var(--button-primary)' }}>
            {schedule.title}
            {schedule.is_completed && (
              <span style={{ marginLeft: '10px', fontSize: '14px', color: '#059669', fontWeight: '500' }}>✅ 완료</span>
            )}
          </h1>
        </div>
      </div>

      {/* 탭 */}
      <div style={{ borderBottom: '2px solid rgba(0,0,0,0.06)', marginBottom: '24px', display: 'flex', gap: '4px', padding: '0 4px' }}>
        {[{ key: 'info', label: '상세정보' }, { key: 'chat', label: '대화' }].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: isMobile ? '8px 20px' : '12px 20px', background: 'none', border: 'none',
              borderBottom: activeTab === tab.key ? '3px solid var(--button-primary)' : '3px solid transparent',
              color: activeTab === tab.key ? 'var(--button-primary)' : 'var(--text-muted)',
              fontWeight: activeTab === tab.key ? '600' : '400',
              cursor: 'pointer', fontSize: '15px', transition: 'all 0.2s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 상세정보 탭 */}
      {activeTab === 'info' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* 일정 정보 */}
          <div style={{ backgroundColor: 'rgba(255,255,255,0.75)', borderRadius: '14px', padding: '24px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px', color: 'var(--text-primary)' }}>일정 정보</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '16px', flexShrink: 0 }}>📅</span>
                <div>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '2px' }}>날짜 및 시간</p>
                  <p style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-primary)', margin: 0 }}>{formatDateTime(schedule.datetime)}</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '16px', flexShrink: 0 }}>{schedule.location_type === 'offline' ? '📍' : '💻'}</span>
                <div>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '2px' }}>{schedule.location_type === 'offline' ? '오프라인 장소' : '온라인'}</p>
                  <p style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-primary)', margin: 0 }}>
                    {schedule.location_type === 'offline'
                      ? (schedule.location || '장소 미정')
                      : (schedule.online_link
                          ? <a href={schedule.online_link} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--button-primary)' }}>{schedule.online_link}</a>
                          : '링크 미정')}
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '16px', flexShrink: 0 }}>👥</span>
                <div>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '2px' }}>모집 인원</p>
                  <p style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-primary)', margin: 0 }}>{schedule.current_members} / {schedule.max_members}명</p>
                </div>
              </div>
              {schedule.description && (
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '16px', flexShrink: 0 }}>📝</span>
                  <div>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '2px' }}>설명</p>
                    <p style={{ fontSize: '14px', color: 'var(--text-primary)', margin: 0, whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>{schedule.description}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 참여 멤버 */}
          <div style={{ backgroundColor: 'rgba(255,255,255,0.75)', borderRadius: '14px', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: '700', margin: 0, color: 'var(--text-primary)' }}>
                참여 멤버 ({members.length}명)
              </h2>
              {members.length > 0 && (
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  보류: <strong style={{ color: 'var(--text-muted)' }}>{members.filter(m => m.attendance_status !== 'confirmed').length}</strong>
                  {' '}|{' '}
                  확정: <strong style={{ color: 'var(--text-primary)' }}>{members.filter(m => m.attendance_status === 'confirmed').length}</strong>
                </span>
              )}
            </div>
            {members.length === 0 ? (
              <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>아직 참여한 멤버가 없습니다.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {members.map(member => (
                  <div
                    key={member.user_id}
                    onClick={() => navigate(`/users/${member.user_id}`)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '12px 16px', borderRadius: '10px',
                      backgroundColor: member.user_id === schedule.created_by ? 'rgba(107,144,128,0.1)' : 'rgba(0,0,0,0.03)',
                      cursor: 'pointer', transition: 'background-color 0.2s',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(107,144,128,0.15)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = member.user_id === schedule.created_by ? 'rgba(107,144,128,0.1)' : 'rgba(0,0,0,0.03)'}
                  >
                    {member.user_id === schedule.created_by && (
                      <span style={{
                        fontSize: '11px', padding: '1px 8px', borderRadius: '6px',
                        backgroundColor: 'rgba(107,144,128,0.2)', color: 'var(--button-primary)', fontWeight: '500',
                      }}>주최</span>
                    )}
                    <span style={{ fontWeight: '500', color: 'var(--text-primary)', fontSize: '14px' }}>
                      {member.profiles?.nickname || '익명'}
                    </span>
                    {member.profiles?.custom_badge && (
                      <span style={{
                        padding: '1px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: '500',
                        backgroundColor: 'rgba(107,144,128,0.15)', color: 'var(--button-primary)',
                      }}>
                        {member.profiles.custom_badge}
                      </span>
                    )}
                    {/* 참석 상태 버튼 (본인만 조작 가능) */}
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }} onClick={e => e.stopPropagation()}>
                      {member.user_id === currentUser?.id ? (
                        <>
                          <button
                            onClick={(e) => handleAttendanceStatus(e, 'pending')}
                            style={{
                              padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '600',
                              border: '1.5px solid',
                              borderColor: member.attendance_status === 'pending' ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.12)',
                              backgroundColor: member.attendance_status === 'pending' ? 'rgba(0,0,0,0.08)' : 'transparent',
                              color: member.attendance_status === 'pending' ? 'var(--text-primary)' : 'var(--text-muted)',
                              cursor: 'pointer', transition: 'all 0.15s',
                            }}
                          >보류</button>
                          <button
                            onClick={(e) => handleAttendanceStatus(e, 'confirmed')}
                            style={{
                              padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '600',
                              border: '1.5px solid',
                              borderColor: member.attendance_status === 'confirmed' ? 'var(--button-primary)' : 'rgba(0,0,0,0.12)',
                              backgroundColor: member.attendance_status === 'confirmed' ? 'var(--button-primary)' : 'transparent',
                              color: member.attendance_status === 'confirmed' ? '#fff' : 'var(--text-muted)',
                              cursor: 'pointer', transition: 'all 0.15s',
                            }}
                          >확정</button>
                        </>
                      ) : (
                        <span style={{
                          padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '600',
                          backgroundColor: member.attendance_status === 'confirmed' ? 'rgba(107,144,128,0.15)' : 'rgba(0,0,0,0.06)',
                          color: member.attendance_status === 'confirmed' ? 'var(--button-primary)' : 'var(--text-muted)',
                        }}>
                          {member.attendance_status === 'confirmed' ? '확정' : '보류'}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 액션 버튼 */}
          {!schedule.is_completed && isApprovedGatheringMember && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {!myMembership ? (
                <button
                  onClick={handleJoin}
                  disabled={isFull}
                  style={{
                    flex: 1, padding: '14px 0',
                    backgroundColor: isFull ? 'rgba(0,0,0,0.06)' : 'var(--button-primary)',
                    color: isFull ? 'var(--text-muted)' : 'white',
                    borderRadius: '12px', border: 'none', cursor: isFull ? 'not-allowed' : 'pointer',
                    fontWeight: '700', fontSize: '15px', transition: 'background-color 0.2s',
                  }}
                  onMouseEnter={(e) => { if (!isFull) e.currentTarget.style.backgroundColor = 'var(--button-primary-hover)'; }}
                  onMouseLeave={(e) => { if (!isFull) e.currentTarget.style.backgroundColor = 'var(--button-primary)'; }}
                >
                  {isFull ? '마감됨' : '일정 참여하기'}
                </button>
              ) : (
                <button
                  onClick={handleLeave}
                  style={{
                    flex: 1, padding: '14px 0', backgroundColor: '#EF4444',
                    color: 'white', borderRadius: '12px', border: 'none', cursor: 'pointer',
                    fontWeight: '700', fontSize: '15px', transition: 'background-color 0.2s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--danger)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#EF4444'}
                >
                  참여 취소
                </button>
              )}
              {isScheduleCreator && (
                <button
                  onClick={handleComplete}
                  style={{
                    flex: 1, padding: '14px 0',
                    backgroundColor: 'rgba(16,185,129,0.1)', color: '#059669',
                    borderRadius: '12px', border: '1px solid rgba(16,185,129,0.3)',
                    cursor: 'pointer', fontWeight: '600', fontSize: '15px',
                  }}
                >
                  일정 종료
                </button>
              )}
            </div>
          )}

          {isScheduleCreator && !schedule.is_completed && (
            <button
              onClick={handleDeleteSchedule}
              style={{
                width: '100%', padding: '12px 0',
                backgroundColor: 'rgba(239,68,68,0.08)', color: '#EF4444',
                borderRadius: '12px', border: '1px solid rgba(239,68,68,0.2)',
                cursor: 'pointer', fontWeight: '600', fontSize: '14px',
              }}
            >
              일정 취소
            </button>
          )}

          {canEval && (
            <button
              onClick={openEval}
              style={{
                width: '100%', padding: '14px 0',
                backgroundColor: 'rgba(107,144,128,0.1)', color: 'var(--button-primary)',
                borderRadius: '12px', border: '1px solid rgba(107,144,128,0.3)',
                cursor: 'pointer', fontWeight: '700', fontSize: '15px',
              }}
            >
              ❤️ 멤버 평가하기
            </button>
          )}
          {schedule.is_completed && evalDone && (
            <p style={{ textAlign: 'center', fontSize: '13px', color: '#059669' }}>✅ 평가 완료</p>
          )}
        </div>
      )}

      {/* 대화 탭 */}
      {activeTab === 'chat' && (
        <div>
          {!myMembership ? (
            <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>💬</div>
              <p style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '6px' }}>일정에 참여 후 대화할 수 있어요</p>
              <p style={{ fontSize: '14px' }}>일정에 참여하면 멤버들과 대화를 나눌 수 있습니다.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 340px)', minHeight: '450px' }}>
              {/* 메시지 목록 */}
              <div
                ref={messagesContainerRef}
                onScroll={handleScroll}
                className="glass"
                style={{ flex: 1, overflowY: 'auto', padding: '16px', borderRadius: '14px', marginBottom: '12px' }}
              >
                {chatLoading ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>메시지를 불러오는 중...</div>
                ) : messages.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '48px 24px' }}>
                    아직 메시지가 없습니다. 첫 메시지를 남겨보세요!
                  </div>
                ) : (
                  messages.map(msg => {
                    const isMe = msg.user_id === currentUser?.id;
                    return (
                      <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', marginBottom: '12px' }}>
                        <span style={{
                          fontSize: '12px', fontWeight: '600', color: 'var(--button-primary)',
                          marginBottom: '4px', marginLeft: isMe ? undefined : '4px', marginRight: isMe ? '4px' : undefined,
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                        }}>
                          {msg.profiles?.nickname || '알 수 없음'}
                          {msg.profiles?.custom_badge && (
                            <span style={{ padding: '1px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: '500', backgroundColor: 'rgba(107,144,128,0.15)', color: 'var(--button-primary)' }}>
                              {msg.profiles.custom_badge}
                            </span>
                          )}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', flexDirection: isMe ? 'row-reverse' : 'row', maxWidth: '70%' }}>
                          <div style={{
                            padding: '10px 14px',
                            background: isMe ? 'var(--button-primary)' : 'rgba(255,255,255,0.6)',
                            color: isMe ? '#FFFFFF' : 'var(--text-primary)',
                            borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                            fontSize: '14px', lineHeight: '1.5', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                          }}>
                            {msg.content}
                          </div>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', marginBottom: '2px' }}>
                            {new Date(msg.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* 입력창 */}
              <div>
                <div className="glass" style={{ display: 'flex', gap: isMobile ? '4px' : '8px', padding: isMobile ? '10px 12px' : '14px', borderRadius: '14px' }}>
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder={isMobile ? '메시지 입력...' : '메시지를 입력하세요...'}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      padding: isMobile ? '9px 12px' : '12px 16px',
                      background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(0,0,0,0.06)',
                      borderRadius: '10px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none',
                    }}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!newMessage.trim()}
                    style={{
                      padding: isMobile ? '9px 12px' : '12px 24px',
                      background: newMessage.trim() ? 'var(--button-primary)' : 'rgba(0,0,0,0.06)',
                      color: newMessage.trim() ? '#FFFFFF' : 'var(--text-muted)',
                      border: 'none', borderRadius: '10px', fontWeight: '600',
                      cursor: newMessage.trim() ? 'pointer' : 'not-allowed', fontSize: isMobile ? '11px' : '14px', transition: 'all 0.2s',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    전송
                  </button>
                  <button
                    onClick={handleSummarize}
                    disabled={summaryLoading || messages.length === 0}
                    title={profile?.is_premium ? 'AI 대화 요약' : `AI 대화 요약 (잔여 ${summaryRemaining !== null ? summaryRemaining : (profile?.ai_chat_summary_left ?? 3)}회)`}
                    style={{
                      padding: isMobile ? '9px 12px' : '12px 16px',
                      background: '#FFFFFF',
                      color: summaryLoading || messages.length === 0 ? 'var(--text-muted)' : 'var(--button-primary)',
                      border: summaryLoading || messages.length === 0 ? '1.5px solid rgba(0,0,0,0.12)' : '1.5px solid var(--button-primary)',
                      borderRadius: '10px',
                      fontWeight: '600',
                      cursor: summaryLoading || messages.length === 0 ? 'not-allowed' : 'pointer',
                      fontSize: isMobile ? '12px' : '14px',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: isMobile ? '3px' : '6px',
                      whiteSpace: 'nowrap',
                      position: 'relative',
                    }}
                  >
                    {summaryLoading ? (
                      <>
                        {!isMobile && <div style={{
                          width: '12px', height: '12px',
                          border: '2px solid rgba(107,144,128,0.2)',
                          borderTop: '2px solid var(--button-primary)',
                          borderRadius: '50%',
                          animation: 'spin 0.8s linear infinite'
                        }} />}
                        요약 중
                      </>
                    ) : (
                      <>
                        {!isMobile && (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                            <line x1="16" y1="13" x2="8" y2="13" />
                            <line x1="16" y1="17" x2="8" y2="17" />
                          </svg>
                        )}
                        요약
                      </>
                    )}
                    {/* 무료 유저 잔여 횟수 배지 */}
                    {!profile?.is_premium && !summaryLoading && (
                      <span style={{
                        position: 'absolute',
                        top: '-8px',
                        right: '-8px',
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--button-primary)',
                        color: '#FFFFFF',
                        fontSize: '10px',
                        fontWeight: '700',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '2px solid white',
                      }}>
                        {summaryRemaining !== null ? summaryRemaining : (profile?.ai_chat_summary_left ?? 3)}
                      </span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 요약 모달 */}
      {showSummaryModal && (
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
          onClick={() => setShowSummaryModal(false)}
        >
          <div
            style={{
              backgroundColor: 'var(--card-bg, #fff)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              width: '100%',
              maxWidth: '500px',
              borderRadius: '20px',
              padding: '28px',
              maxHeight: '80vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #8B5CF6, #6366F1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
              </div>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                  AI 대화 요약
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                  {messages.length}개 메시지 분석 완료
                </p>
              </div>
            </div>

            <div style={{
              padding: '16px',
              backgroundColor: 'rgba(139, 92, 246, 0.06)',
              borderRadius: '14px',
              border: '1px solid rgba(139, 92, 246, 0.12)',
              marginBottom: '16px',
            }}>
              <p style={{
                fontSize: '14px',
                color: 'var(--text-primary)',
                lineHeight: '1.8',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                margin: 0,
              }}>
                {summaryText}
              </p>
            </div>

            {summaryRemaining !== null && summaryRemaining !== undefined && (
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '12px' }}>
                이번 달 남은 무료 요약 횟수: {summaryRemaining}회
              </p>
            )}

            <button
              onClick={() => setShowSummaryModal(false)}
              style={{
                width: '100%',
                padding: '14px',
                backgroundColor: 'var(--button-primary)',
                color: '#FFFFFF',
                borderRadius: '12px',
                fontWeight: '600',
                border: 'none',
                cursor: 'pointer',
                fontSize: '15px',
                transition: 'all 0.2s',
              }}
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* 평가 모달 */}
      {showEval && (
        <div
          style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, backgroundColor: 'rgba(0,0,0,0.5)', padding: '24px' }}
          onClick={() => setShowEval(false)}
        >
          <div
            style={{ backgroundColor: 'var(--card-bg, #fff)', backdropFilter: 'blur(20px)', width: '100%', maxWidth: '520px', borderRadius: '20px', padding: '28px', maxHeight: '80vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '6px', color: 'var(--text-primary)' }}>일정 멤버 평가</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>함께한 멤버들을 평가해주세요. 평가는 익명으로 진행됩니다.</p>

            {members.filter(m => m.user_id !== currentUser?.id).length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px 0' }}>평가할 멤버가 없습니다.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {members.filter(m => m.user_id !== currentUser?.id).map(member => {
                  const direction = evalVotes[member.user_id];
                  return (
                    <div key={member.user_id} style={{ padding: '14px 16px', borderRadius: '14px', backgroundColor: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.06)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: '600', fontSize: '14px', color: 'var(--text-primary)' }}>{member.profiles?.nickname || '멤버'}</span>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => {
                              const newDir = direction === 'up' ? null : 'up';
                              setEvalVotes(prev => ({ ...prev, [member.user_id]: newDir }));
                              if (!newDir) setEvalKeywords(prev => ({ ...prev, [member.user_id]: [] }));
                            }}
                            style={{ fontSize: '22px', background: 'none', border: direction === 'up' ? '2px solid var(--button-primary)' : '2px solid transparent', borderRadius: '8px', cursor: 'pointer', padding: '4px 8px', opacity: direction === 'down' ? 0.35 : 1, transition: 'all 0.15s' }}
                          >👍</button>
                          <button
                            onClick={() => {
                              const newDir = direction === 'down' ? null : 'down';
                              setEvalVotes(prev => ({ ...prev, [member.user_id]: newDir }));
                              setEvalKeywords(prev => ({ ...prev, [member.user_id]: [] }));
                            }}
                            style={{ fontSize: '22px', background: 'none', border: direction === 'down' ? '2px solid #EF4444' : '2px solid transparent', borderRadius: '8px', cursor: 'pointer', padding: '4px 8px', opacity: direction === 'up' ? 0.35 : 1, transition: 'all 0.15s' }}
                          >👎</button>
                        </div>
                      </div>
                      {direction === 'up' && (
                        <div style={{ marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {evalKeywordTypes.map(kw => {
                            const selected = (evalKeywords[member.user_id] || []).includes(kw.id);
                            return (
                              <button key={kw.id} onClick={() => toggleKeyword(member.user_id, kw.id)} style={{ padding: '5px 12px', borderRadius: '20px', border: selected ? '2px solid var(--button-primary)' : '2px solid rgba(0,0,0,0.1)', backgroundColor: selected ? 'rgba(107,144,128,0.15)' : 'rgba(255,255,255,0.7)', color: selected ? 'var(--button-primary)' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '12px', fontWeight: selected ? '600' : '400', transition: 'all 0.15s', fontFamily: 'inherit' }}>
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
                onClick={handleSubmitEval}
                disabled={evalSubmitting}
                style={{ flex: 1, padding: '14px 0', backgroundColor: evalSubmitting ? 'rgba(0,0,0,0.06)' : 'var(--button-primary)', color: evalSubmitting ? 'var(--text-muted)' : 'white', borderRadius: '12px', fontWeight: '600', border: 'none', cursor: evalSubmitting ? 'not-allowed' : 'pointer', fontSize: '15px' }}
              >
                {evalSubmitting ? '제출 중...' : '평가 완료'}
              </button>
              <button
                onClick={() => setShowEval(false)}
                style={{ flex: 1, padding: '14px 0', backgroundColor: 'rgba(0,0,0,0.06)', color: 'var(--text-secondary)', borderRadius: '12px', fontWeight: '500', border: 'none', cursor: 'pointer', fontSize: '15px' }}
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
