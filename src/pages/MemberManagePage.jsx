import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useIsMobile } from '../hooks/useIsMobile';

export default function MemberManagePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [gathering, setGathering] = useState(null);
  const [members, setMembers] = useState([]);
  const [pendingApplicants, setPendingApplicants] = useState([]);
  const [activeTab, setActiveTab] = useState('members');
  const [loading, setLoading] = useState(true);
  const isMobile = useIsMobile();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    checkUser();
  }, []);

  useEffect(() => {
    if (user) {
      fetchGathering();
    }
  }, [id, user]);

  useEffect(() => {
    if (gathering) {
      fetchMembers();
      if (gathering.approval_required) {
        fetchPendingApplicants();
      }
    }
  }, [gathering?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchGathering = async () => {
    try {
      const { data, error } = await supabase
        .from('gatherings')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      if (data.creator_id !== user.id) {
        alert('멤버 관리 권한이 없습니다.');
        navigate(`/gatherings/${id}`);
        return;
      }

      setGathering(data);
      setLoading(false);
    } catch (error) {
      console.error('모임 정보 로드 오류:', error);
      alert('모임 정보를 불러오는데 실패했습니다.');
      navigate('/gatherings');
    }
  };

  const fetchMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('gathering_members')
        .select('*, profiles:user_id (nickname, is_premium, custom_badge)')
        .eq('gathering_id', id)
        .eq('status', 'approved');

      if (error) throw error;
      setMembers(data || []);
    } catch (error) {
      console.error('참가자 목록 로드 오류:', error);
    }
  };

  const fetchPendingApplicants = async () => {
    try {
      const { data, error } = await supabase
        .from('gathering_members')
        .select('*, profiles:user_id (nickname, age_range, location, favorite_game_categories, bio, is_premium, custom_badge)')
        .eq('gathering_id', id)
        .eq('status', 'pending');

      if (error) throw error;
      setPendingApplicants(data || []);
    } catch (error) {
      console.error('지원자 목록 로드 오류:', error);
    }
  };

  const handleKickMember = async (memberId, memberUserId) => {
    if (!confirm('정말 이 참가자를 강제 퇴출하시겠습니까?')) return;

    try {
      // RLS 정책 상 delete가 안 될 수 있으므로 status를 kicked로 변경 (soft-delete)
      // 멤버 조회 시 status='approved' 필터가 있어 자동 제외됨
      const { error } = await supabase
        .from('gathering_members')
        .update({ status: 'kicked' })
        .eq('id', memberId);

      if (error) throw error;

      const { error: updateError } = await supabase
        .from('gatherings')
        .update({ current_members: gathering.current_members - 1 })
        .eq('id', id);

      if (updateError) throw updateError;

      // 퇴출 알림 전송
      await supabase.from('notifications').insert({
        user_id: memberUserId,
        type: 'member_kicked',
        gathering_id: id,
        related_user_id: user.id
      });

      setGathering(prev => ({ ...prev, current_members: prev.current_members - 1 }));
      setMembers(prev => prev.filter(m => m.id !== memberId));
      alert('참가자를 퇴출했습니다.');
    } catch (error) {
      console.error('참가자 퇴출 오류:', error);
      alert('참가자 퇴출 중 오류가 발생했습니다.');
    }
  };

  const handleApprove = async (applicant) => {
    try {
      const { error: updateError } = await supabase
        .from('gathering_members')
        .update({ status: 'approved' })
        .eq('id', applicant.id);

      if (updateError) throw updateError;

      const { error: gatheringError } = await supabase
        .from('gatherings')
        .update({ current_members: gathering.current_members + 1 })
        .eq('id', id);

      if (gatheringError) throw gatheringError;

      await supabase.from('notifications').insert({
        user_id: applicant.user_id,
        type: 'application_approved',
        gathering_id: id,
        related_user_id: user.id
      });

      setGathering(prev => ({ ...prev, current_members: prev.current_members + 1 }));
      setPendingApplicants(prev => prev.filter(a => a.id !== applicant.id));
      fetchMembers();
      alert('지원자를 승인했습니다.');
    } catch (error) {
      console.error('승인 오류:', error);
      alert('승인 중 오류가 발생했습니다.');
    }
  };

  const handleReject = async (applicant) => {
    try {
      const { error: updateError } = await supabase
        .from('gathering_members')
        .update({ status: 'rejected' })
        .eq('id', applicant.id);

      if (updateError) throw updateError;

      await supabase.from('notifications').insert({
        user_id: applicant.user_id,
        type: 'application_rejected',
        gathering_id: id,
        related_user_id: user.id
      });

      setPendingApplicants(prev => prev.filter(a => a.id !== applicant.id));
      alert('지원자를 거절했습니다.');
    } catch (error) {
      console.error('거절 오류:', error);
      alert('거절 중 오류가 발생했습니다.');
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px', height: '40px',
            border: '3px solid rgba(255,255,255,0.3)',
            borderTop: '3px solid var(--button-primary)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto'
          }} />
          <p style={{ marginTop: '16px', color: 'var(--text-secondary)', fontSize: '14px' }}>로딩 중...</p>
        </div>
      </div>
    );
  }

  if (!gathering) return null;

  const tabs = [{ key: 'members', label: `멤버 목록 (${members.length})` }];
  if (gathering.approval_required) {
    tabs.push({ key: 'pending', label: `승인 대기 (${pendingApplicants.length})` });
  }

  return (
    <div style={{
      maxWidth: '800px',
      margin: '0 auto',
      padding: isMobile ? '16px 12px' : '32px 24px',
      ...(isMobile ? {
        width: '90%',
        background: '#FFFFFF',
        borderRadius: '16px',
        minHeight: '100%',
      } : {})
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <button
          onClick={() => navigate(`/gatherings/${id}`)}
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
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--button-primary)', margin: 0 }}>
          멤버 관리
        </h1>
      </div>

      {/* Tab Navigation */}
      <div style={{
        borderBottom: '2px solid rgba(0,0,0,0.06)',
        marginBottom: '20px',
        display: 'flex',
        gap: '4px'
      }}>
        {tabs.map((tab) => (
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
              fontSize: '15px',
              transition: 'all 0.2s'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Members Tab */}
      {activeTab === 'members' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {members.map((member) => {
            const isGatheringCreator = member.user_id === gathering.creator_id;
            return (
              <div key={member.id} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '14px 16px',
                backgroundColor: isGatheringCreator ? 'rgba(107, 144, 128, 0.12)' : 'rgba(255,255,255,0.75)',
                borderRadius: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                  <span style={{ fontWeight: '500', color: 'var(--text-primary)', fontSize: '14px' }}>
                    {member.profiles?.nickname || '알 수 없음'}
                  </span>
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
                  {member.profiles?.is_premium && (
                    <span style={{ fontSize: '12px' }}>👑</span>
                  )}
                </div>
                {!isGatheringCreator && (
                  <button
                    onClick={() => handleKickMember(member.id, member.user_id)}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: 'var(--danger)',
                      color: 'white',
                      borderRadius: '8px',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: '600'
                    }}
                  >
                    강제 퇴출
                  </button>
                )}
              </div>
            );
          })}
          {members.length === 0 && (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>참가자가 없습니다.</p>
          )}
        </div>
      )}

      {/* Pending Applicants Tab */}
      {activeTab === 'pending' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {pendingApplicants.map((applicant) => (
            <div
              key={applicant.id}
              style={{
                padding: '16px',
                backgroundColor: 'rgba(255,255,255,0.75)',
                borderRadius: '14px',
                border: '1px solid rgba(0,0,0,0.06)',
                overflow: 'hidden',
              }}
            >
              <div style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <p style={{ fontWeight: 'bold', color: 'var(--text-primary)', margin: 0 }}>
                    {applicant.profiles?.nickname || '익명'}
                  </p>
                  {applicant.profiles?.custom_badge && (
                    <span style={{
                      padding: '1px 6px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: '500',
                      backgroundColor: 'rgba(107, 144, 128, 0.15)',
                      color: 'var(--button-primary)',
                    }}>
                      {applicant.profiles.custom_badge}
                    </span>
                  )}
                  {applicant.profiles?.is_premium && (
                    <span style={{ fontSize: '12px' }}>👑</span>
                  )}
                </div>
                {applicant.profiles?.age_range && (
                  <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    나이대: {applicant.profiles.age_range}
                  </p>
                )}
                {applicant.profiles?.location && (
                  <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    지역: {applicant.profiles.location}
                  </p>
                )}
                {applicant.profiles?.favorite_game_categories?.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '4px' }}>
                    {applicant.profiles.favorite_game_categories.map((cat, i) => (
                      <span key={i} style={{
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        backgroundColor: 'rgba(107, 144, 128, 0.1)',
                        color: 'var(--button-primary)',
                      }}>
                        {cat}
                      </span>
                    ))}
                  </div>
                )}
                {applicant.profiles?.bio && (
                  <p style={{ fontSize: '14px', color: 'var(--text-primary)', marginTop: '8px', wordBreak: 'break-word', overflowWrap: 'break-word', whiteSpace: 'pre-wrap', margin: '8px 0 0 0' }}>
                    {applicant.profiles.bio}
                  </p>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => handleApprove(applicant)}
                  style={{
                    flex: 1,
                    padding: '10px 0',
                    backgroundColor: 'var(--button-primary)',
                    color: 'white',
                    borderRadius: '10px',
                    fontWeight: 'bold',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  승인
                </button>
                <button
                  onClick={() => handleReject(applicant)}
                  style={{
                    flex: 1,
                    padding: '10px 0',
                    backgroundColor: '#EF4444',
                    color: 'white',
                    borderRadius: '10px',
                    fontWeight: 'bold',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  거절
                </button>
              </div>
            </div>
          ))}
          {pendingApplicants.length === 0 && (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>대기 중인 지원자가 없습니다.</p>
          )}
        </div>
      )}
    </div>
  );
}
