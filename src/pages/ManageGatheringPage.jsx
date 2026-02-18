import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useIsMobile } from '../hooks/useIsMobile';

export default function ManageGatheringPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [gathering, setGathering] = useState(null);
  const [loading, setLoading] = useState(true);
  const isMobile = useIsMobile();
  const [isEditing, setIsEditing] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [completing, setCompleting] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    maxMembers: 0
  });

  useEffect(() => {
    checkUser();
  }, []);

  useEffect(() => {
    if (user) {
      fetchGathering();
    }
  }, [id, user]);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
  };

  const fetchGathering = async () => {
    try {
      const { data, error } = await supabase
        .from('gatherings')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      if (data.creator_id !== user.id) {
        alert('모임 관리 권한이 없습니다.');
        navigate(`/gatherings/${id}`);
        return;
      }

      setGathering(data);

      setFormData({
        title: data.title,
        description: data.description,
        maxMembers: data.max_members
      });

      setLoading(false);
    } catch (error) {
      console.error('모임 정보 로드 오류:', error);
      alert('모임 정보를 불러오는데 실패했습니다.');
      navigate('/gatherings');
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();

    try {
      const { error } = await supabase
        .from('gatherings')
        .update({
          title: formData.title,
          description: formData.description,
          max_members: parseInt(formData.maxMembers)
        })
        .eq('id', id);

      if (error) throw error;

      alert('모임 정보가 수정되었습니다.');
      setIsEditing(false);
      fetchGathering();
    } catch (error) {
      console.error('모임 수정 오류:', error);
      alert('모임 수정 중 오류가 발생했습니다.');
    }
  };

  const handleAIGenerate = async () => {
    if (!aiPrompt.trim()) {
      alert('내용을 입력해주세요.');
      return;
    }

    setAiGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-generate-description', {
        body: { prompt: aiPrompt, gathering }
      });

      if (error) {
        console.error('AI 함수 에러:', error);
        throw new Error(error.message || JSON.stringify(error));
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      if (!data?.title && !data?.description) {
        throw new Error('AI 응답이 비어 있습니다.');
      }

      setAiResult({
        title: data.title || '',
        description: data.description || ''
      });
    } catch (error) {
      console.error('AI 생성 오류:', error);
      alert('AI 글 생성 중 오류가 발생했습니다: ' + error.message);
    } finally {
      setAiGenerating(false);
    }
  };

  const handleApplyAI = () => {
    if (!aiResult) return;
    setFormData(prev => ({
      ...prev,
      title: aiResult.title,
      description: aiResult.description
    }));
    setShowAIModal(false);
    setAiPrompt('');
    setAiResult(null);
  };

  const handleCloseAIModal = () => {
    setShowAIModal(false);
    setAiPrompt('');
    setAiResult(null);
  };

  const handleDeleteGathering = async () => {
    if (!confirm('정말 이 모임을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;

    try {
      const { error: membersError } = await supabase
        .from('gathering_members')
        .delete()
        .eq('gathering_id', id);

      if (membersError) throw membersError;

      const { error: gatheringError } = await supabase
        .from('gatherings')
        .delete()
        .eq('id', id);

      if (gatheringError) throw gatheringError;

      alert('모임이 삭제되었습니다.');
      navigate('/gatherings');
    } catch (error) {
      console.error('모임 삭제 오류:', error);
      alert('모임 삭제 중 오류가 발생했습니다.');
    }
  };

  const handleCompleteGathering = async () => {
    if (!confirm('모임을 완료 처리하시겠습니까? 완료 후에는 되돌릴 수 없으며, 모든 참가자가 서로를 평가할 수 있게 됩니다.')) return;

    setCompleting(true);
    try {
      // 1단계: 모임 완료 처리
      const { error: completeError } = await supabase
        .from('gatherings')
        .update({ is_completed: true })
        .eq('id', id);

      if (completeError) throw completeError;

      // 2단계: 알림 전송 (실패해도 완료 처리는 유지)
      try {
        const { data: membersData } = await supabase
          .from('gathering_members')
          .select('user_id')
          .eq('gathering_id', id)
          .eq('status', 'approved');

        const allMemberIds = [...new Set([
          ...(membersData || []).map(m => m.user_id),
          gathering.creator_id
        ])].filter(uid => uid !== user.id);

        if (allMemberIds.length > 0) {
          const notifications = allMemberIds.map(uid => ({
            user_id: uid,
            type: 'gathering_completed',
            gathering_id: id,
            related_user_id: user.id,
          }));
          await supabase.from('notifications').insert(notifications);
        }
      } catch (notifError) {
        console.warn('알림 전송 실패 (무시됨):', notifError);
      }

      navigate(`/gatherings/${id}`);
    } catch (error) {
      console.error('모임 완료 처리 오류:', error);
      alert('모임 완료 처리 중 오류가 발생했습니다: ' + (error.message || JSON.stringify(error)));
    } finally {
      setCompleting(false);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '12px 14px',
    border: '1px solid rgba(0,0,0,0.08)',
    borderRadius: '10px',
    fontSize: '14px',
    color: 'var(--text-primary)',
    backgroundColor: 'rgba(255,255,255,0.6)',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'all 0.2s'
  };

  const focusHandler = (e) => {
    e.target.style.borderColor = 'var(--button-primary)';
    e.target.style.boxShadow = '0 0 0 2px rgba(107,144,128,0.2)';
  };

  const blurHandler = (e) => {
    e.target.style.borderColor = 'rgba(0,0,0,0.08)';
    e.target.style.boxShadow = 'none';
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
        <h1 style={{ fontSize: '24px', fontWeight: '700', margin: 0, color: 'var(--button-primary)' }}>
          모임 관리
        </h1>
      </div>

      {/* 모임 정보 수정 섹션 */}
      <div className="glass-strong" style={{ padding: '24px', borderRadius: '16px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>모임 정보</h2>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {isEditing && (
              <button
                type="button"
                onClick={() => setShowAIModal(true)}
                style={{
                  padding: '8px 14px',
                  background: 'var(--button-primary)',
                  color: 'white',
                  borderRadius: '10px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  transition: 'all 0.2s'
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a4 4 0 0 1 4 4c0 1.95-1.4 3.58-3.25 3.93L12 22" />
                  <path d="M12 2a4 4 0 0 0-4 4c0 1.95 1.4 3.58 3.25 3.93" />
                  <path d="M5 10c0 4.42 3.13 8 7 8s7-3.58 7-8" />
                </svg>
                AI 자동 생성
              </button>
            )}
            {!isEditing && (
              <button onClick={() => setIsEditing(true)} style={{
                padding: '8px 16px',
                backgroundColor: 'var(--button-primary)',
                color: 'white',
                borderRadius: '10px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '600',
                transition: 'all 0.2s'
              }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--button-primary-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--button-primary)'}
              >수정</button>
            )}
          </div>
        </div>

        {isEditing ? (
          <form onSubmit={handleUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '13px', color: 'var(--text-secondary)' }}>제목</label>
              <input type="text" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} required style={inputStyle} onFocus={focusHandler} onBlur={blurHandler} />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '13px', color: 'var(--text-secondary)' }}>설명</label>
              <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} required rows="4" style={{ ...inputStyle, resize: 'none' }} onFocus={focusHandler} onBlur={blurHandler} />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '13px', color: 'var(--text-secondary)' }}>최대 인원</label>
              <input type="number" value={formData.maxMembers} onChange={(e) => setFormData({ ...formData, maxMembers: e.target.value })} min={gathering.current_members} required style={inputStyle} onFocus={focusHandler} onBlur={blurHandler} />
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>현재 참가자 수: {gathering.current_members}명</p>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="submit" style={{
                padding: '12px 24px',
                backgroundColor: 'var(--button-primary)',
                color: 'white',
                borderRadius: '10px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                transition: 'all 0.2s'
              }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--button-primary-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--button-primary)'}
              >저장</button>
              <button type="button" onClick={() => setIsEditing(false)} style={{
                padding: '12px 24px',
                backgroundColor: 'rgba(255,255,255,0.5)',
                color: 'var(--text-secondary)',
                borderRadius: '10px',
                border: '1px solid rgba(0,0,0,0.08)',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                transition: 'all 0.2s'
              }}>취소</button>
            </div>
          </form>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <p style={{ color: 'var(--text-primary)', fontSize: '14px', margin: 0 }}><strong>제목:</strong> {gathering.title}</p>
            <p style={{ color: 'var(--text-primary)', fontSize: '14px', margin: 0 }}><strong>설명:</strong> {gathering.description}</p>
            <p style={{ color: 'var(--text-primary)', fontSize: '14px', margin: 0 }}><strong>인원:</strong> {gathering.current_members}/{gathering.max_members}명</p>
          </div>
        )}
      </div>

      {/* 모임 삭제 섹션 */}
      <div style={{
        backgroundColor: 'rgba(220,38,38,0.04)',
        padding: '24px',
        borderRadius: '16px',
        border: '1px solid rgba(220,38,38,0.12)'
      }}>
        <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px', color: 'var(--danger)', margin: '0 0 8px 0' }}>위험 구역</h2>
        <p style={{ marginBottom: '14px', color: 'var(--text-muted)', fontSize: '14px', margin: '0 0 14px 0' }}>모임을 삭제하면 모든 데이터가 영구적으로 삭제됩니다.</p>
        <button onClick={handleDeleteGathering} style={{
          padding: '10px 20px',
          backgroundColor: 'var(--danger)',
          color: 'white',
          borderRadius: '10px',
          border: 'none',
          cursor: 'pointer',
          fontWeight: '600',
          fontSize: '14px',
          transition: 'all 0.2s'
        }}>모임 삭제</button>
      </div>

      {/* AI 자동 생성 모달 */}
      {showAIModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            padding: '24px'
          }}
          onClick={handleCloseAIModal}
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
              overflowY: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '6px', color: 'var(--text-primary)' }}>
              AI 글 자동 생성
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              어떤 모임인지 자유롭게 설명해주세요. AI가 제목과 설명을 생성합니다.
            </p>

            {/* 자연어 입력 */}
            <textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="예: 주말에 강남에서 하는 보드게임 모임이야. 초보자도 환영하고 카탄이랑 스플렌더 위주로 할 거야. 분위기는 편하게!"
              rows="4"
              style={{
                ...inputStyle,
                resize: 'none',
                marginBottom: '12px'
              }}
              onFocus={focusHandler}
              onBlur={blurHandler}
              disabled={aiGenerating}
            />

            <button
              type="button"
              onClick={handleAIGenerate}
              disabled={aiGenerating || !aiPrompt.trim()}
              style={{
                width: '100%',
                padding: '12px 0',
                background: aiGenerating || !aiPrompt.trim() ? 'rgba(0,0,0,0.06)' : 'var(--button-primary)',
                color: aiGenerating || !aiPrompt.trim() ? 'var(--text-muted)' : 'white',
                borderRadius: '12px',
                fontWeight: '600',
                border: 'none',
                cursor: aiGenerating || !aiPrompt.trim() ? 'not-allowed' : 'pointer',
                fontSize: '15px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              {aiGenerating ? (
                <>
                  <div style={{
                    width: '16px', height: '16px',
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTop: '2px solid white',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite'
                  }} />
                  생성 중...
                </>
              ) : 'AI로 글 생성하기'}
            </button>

            {/* AI 결과 미리보기 + 수정 */}
            {aiResult && (
              <div style={{ marginTop: '20px' }}>
                <div style={{
                  backgroundColor: 'rgba(107, 144, 128, 0.06)',
                  borderRadius: '14px',
                  padding: '16px',
                  border: '1px solid rgba(107, 144, 128, 0.15)'
                }}>
                  <p style={{ fontSize: '12px', fontWeight: '600', color: 'var(--button-primary)', marginBottom: '10px' }}>
                    AI 생성 결과 (수정 가능)
                  </p>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', fontSize: '12px', color: 'var(--text-secondary)' }}>제목</label>
                  <input
                    type="text"
                    value={aiResult.title}
                    onChange={(e) => setAiResult(prev => ({ ...prev, title: e.target.value }))}
                    style={{ ...inputStyle, marginBottom: '10px' }}
                    onFocus={focusHandler}
                    onBlur={blurHandler}
                  />
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', fontSize: '12px', color: 'var(--text-secondary)' }}>설명</label>
                  <textarea
                    value={aiResult.description}
                    onChange={(e) => setAiResult(prev => ({ ...prev, description: e.target.value }))}
                    rows="5"
                    style={{ ...inputStyle, resize: 'none' }}
                    onFocus={focusHandler}
                    onBlur={blurHandler}
                  />
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                  <button
                    type="button"
                    onClick={handleApplyAI}
                    style={{
                      flex: 1,
                      padding: '12px 0',
                      backgroundColor: 'var(--button-primary)',
                      color: 'white',
                      borderRadius: '12px',
                      fontWeight: '600',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    적용하기
                  </button>
                  <button
                    type="button"
                    onClick={handleCloseAIModal}
                    style={{
                      flex: 1,
                      padding: '12px 0',
                      backgroundColor: 'rgba(0,0,0,0.06)',
                      color: 'var(--text-secondary)',
                      borderRadius: '12px',
                      fontWeight: '500',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    취소
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
