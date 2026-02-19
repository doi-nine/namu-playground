import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useIsMobile } from '../hooks/useIsMobile';

const SUB_TABS = [
  { key: 'free', label: '자유' },
  { key: 'review', label: '후기' },
];

export default function BoardTab({ gatheringId, memberStatus, isCreator, reviewKey }) {
  const { user: authUser } = useAuth();
  const isMobile = useIsMobile();
  const [activeSubTab, setActiveSubTab] = useState('free');
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [zoomedImage, setZoomedImage] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiTone, setAiTone] = useState('중립적');
  const [aiGenerating, setAiGenerating] = useState(false);
  const fileInputRef = useRef(null);

  const canWrite = memberStatus === 'approved' || isCreator;

  useEffect(() => {
    if (gatheringId) {
      fetchPosts();
    }
  }, [gatheringId]);

  const fetchPosts = async () => {
    try {
      const { data, error } = await supabase
        .from('board_posts')
        .select(`
          *,
          profiles:user_id (nickname, custom_badge, is_premium)
        `)
        .eq('gathering_id', gatheringId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPosts(data || []);
    } catch (error) {
      console.error('게시글 로딩 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchReviews = async () => {
    setReviewsLoading(true);
    try {
      const { data, error } = await supabase
        .from('schedule_reviews')
        .select(`
          *,
          schedules:schedule_id (title, datetime, current_members),
          profiles:user_id (nickname, custom_badge)
        `)
        .eq('gathering_id', gatheringId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReviews(data || []);
    } catch (error) {
      console.error('후기 로딩 실패:', error);
    } finally {
      setReviewsLoading(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'review' && gatheringId) {
      fetchReviews();
    }
  }, [activeSubTab, gatheringId, reviewKey]);

  const handleAIGenerate = async () => {
    if (!aiPrompt.trim() || aiGenerating) return;
    setAiGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-generate-post', {
        body: { prompt: aiPrompt.trim(), tone: aiTone },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setContent(data.content || '');
      setShowAIPanel(false);
      setAiPrompt('');
    } catch (err) {
      alert('AI 글 생성 중 오류가 발생했습니다: ' + err.message);
    } finally {
      setAiGenerating(false);
    }
  };

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('이미지는 5MB 이하만 업로드 가능합니다.');
      return;
    }

    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowed.includes(file.type)) {
      alert('JPG, PNG, GIF, WebP 이미지만 업로드 가능합니다.');
      return;
    }

    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async () => {
    if (!content.trim() && !imageFile) return;
    if (!canWrite || submitting) return;

    setSubmitting(true);
    try {
      let imageUrl = null;

      if (imageFile) {
        const ext = imageFile.name.split('.').pop();
        const filePath = `${gatheringId}/${authUser.id}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('board-images')
          .upload(filePath, imageFile, { contentType: imageFile.type });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('board-images')
          .getPublicUrl(filePath);
        imageUrl = urlData.publicUrl;
      }

      const { data, error } = await supabase
        .from('board_posts')
        .insert({
          gathering_id: gatheringId,
          user_id: authUser.id,
          content: content.trim(),
          image_url: imageUrl,
        })
        .select(`
          *,
          profiles:user_id (nickname, custom_badge, is_premium)
        `)
        .single();

      if (error) throw error;

      setPosts((prev) => [data, ...prev]);
      setContent('');
      removeImage();
    } catch (error) {
      console.error('게시글 작성 실패:', error);
      alert('게시글 작성에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditStart = (post) => {
    setEditingId(post.id);
    setEditContent(post.content || '');
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditContent('');
  };

  const handleEditSave = async (postId) => {
    if (!editContent.trim()) return;
    try {
      const { error } = await supabase
        .from('board_posts')
        .update({ content: editContent.trim() })
        .eq('id', postId);
      if (error) throw error;
      setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, content: editContent.trim() } : p));
      setEditingId(null);
      setEditContent('');
    } catch (error) {
      console.error('게시글 수정 실패:', error);
      alert('게시글 수정에 실패했습니다.');
    }
  };

  const handleDelete = async (post) => {
    if (!confirm('이 게시글을 삭제하시겠습니까?')) return;

    setDeletingId(post.id);
    try {
      // 이미지가 있으면 스토리지에서도 삭제
      if (post.image_url) {
        const url = new URL(post.image_url);
        const pathParts = url.pathname.split('/board-images/');
        if (pathParts[1]) {
          await supabase.storage
            .from('board-images')
            .remove([decodeURIComponent(pathParts[1])]);
        }
      }

      const { error } = await supabase
        .from('board_posts')
        .delete()
        .eq('id', post.id);

      if (error) throw error;

      setPosts((prev) => prev.filter((p) => p.id !== post.id));
    } catch (error) {
      console.error('게시글 삭제 실패:', error);
      alert('게시글 삭제에 실패했습니다.');
    } finally {
      setDeletingId(null);
    }
  };

  const formatTime = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '방금 전';
    if (minutes < 60) return `${minutes}분 전`;
    if (hours < 24) return `${hours}시간 전`;
    if (days < 7) return `${days}일 전`;
    return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  };

  if (!canWrite) {
    return (
      <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
        <div style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px', color: 'var(--text-primary)' }}>
          참가 후 게시판을 이용하세요!
        </div>
        <div style={{ fontSize: '14px' }}>
          모임에 참가 승인을 받으면 게시판을 이용할 수 있습니다.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* 서브탭 */}
      <div style={{
        display: 'flex',
        gap: '0',
        borderRadius: '12px',
        overflow: 'hidden',
        border: '1px solid rgba(107, 144, 128, 0.25)',
        background: 'rgba(255,255,255,0.4)',
      }}>
        {SUB_TABS.map((tab, idx) => (
          <button
            key={tab.key}
            onClick={() => setActiveSubTab(tab.key)}
            style={{
              flex: 1,
              padding: '10px 0',
              fontSize: '14px',
              fontWeight: activeSubTab === tab.key ? '700' : '500',
              color: activeSubTab === tab.key ? '#FFFFFF' : 'var(--text-secondary)',
              backgroundColor: activeSubTab === tab.key ? 'var(--button-primary)' : 'transparent',
              border: 'none',
              borderRight: idx < SUB_TABS.length - 1 ? '1px solid rgba(107, 144, 128, 0.25)' : 'none',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 후기 탭 */}
      {activeSubTab === 'review' && (
        reviewsLoading ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
            후기를 불러오는 중...
          </div>
        ) : reviews.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '48px 24px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📝</div>
            <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px', color: 'var(--text-primary)' }}>
              아직 후기가 없습니다
            </div>
            <div style={{ fontSize: '13px' }}>
              완료된 일정에 참여하면 후기를 작성할 수 있어요!
            </div>
          </div>
        ) : (
          reviews.map((review) => {
            const scheduleDate = review.schedules?.datetime
              ? new Date(review.schedules.datetime).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })
              : '';

            return (
              <div
                key={review.id}
                className="glass"
                style={{
                  padding: isMobile ? '14px' : '20px',
                  borderRadius: '14px',
                }}
              >
                {/* 상단: 일정 제목 + 날짜 */}
                <div style={{ marginBottom: '8px' }}>
                  <span style={{ fontSize: '15px', fontWeight: '700', color: 'var(--button-primary)' }}>
                    {review.schedules?.title || '일정'}
                  </span>
                  {scheduleDate && (
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '8px' }}>
                      {scheduleDate}
                    </span>
                  )}
                </div>

                {/* 중단: 참여 인원 + 작성자 + 작성 시간 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
                  {review.schedules?.current_members != null && (
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: '500',
                      backgroundColor: 'rgba(107,144,128,0.12)',
                      color: 'var(--button-primary)',
                    }}>
                      참여 {review.schedules.current_members}명
                    </span>
                  )}
                  <span style={{
                    fontSize: '13px',
                    fontWeight: '600',
                    color: 'var(--text-primary)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}>
                    {review.profiles?.nickname || '알 수 없음'}
                    {review.profiles?.custom_badge && (
                      <span style={{
                        padding: '1px 6px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: '500',
                        backgroundColor: 'rgba(107, 144, 128, 0.15)',
                        color: 'var(--button-primary)',
                      }}>
                        {review.profiles.custom_badge}
                      </span>
                    )}
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {formatTime(review.created_at)}
                  </span>
                </div>

                {/* 하단: AI 요약문 */}
                <p style={{
                  fontSize: '14px',
                  lineHeight: '1.7',
                  color: 'var(--text-primary)',
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}>
                  {review.ai_summary}
                </p>
              </div>
            );
          })
        )
      )}

      {/* 자유 탭 */}
      {activeSubTab === 'free' && (loading ? (
        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
          게시글을 불러오는 중...
        </div>
      ) : (
        <>
      {/* 작성 폼 */}
      <div className="glass-strong" style={{ padding: isMobile ? '14px' : '20px', borderRadius: '14px' }}>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="게시글을 작성하세요..."
          rows={3}
          style={{
            width: '100%',
            padding: '12px',
            background: 'rgba(255,255,255,0.5)',
            border: '1px solid rgba(0,0,0,0.06)',
            borderRadius: '10px',
            color: 'var(--text-primary)',
            fontSize: '14px',
            lineHeight: '1.6',
            resize: 'vertical',
            outline: 'none',
            fontFamily: 'inherit',
            boxSizing: 'border-box',
          }}
        />

        {imagePreview && (
          <div style={{ position: 'relative', marginTop: '10px', display: 'inline-block' }}>
            <img
              src={imagePreview}
              alt="미리보기"
              style={{
                maxWidth: '200px',
                maxHeight: '200px',
                borderRadius: '10px',
                objectFit: 'cover',
              }}
            />
            <button
              onClick={removeImage}
              style={{
                position: 'absolute',
                top: '-8px',
                right: '-8px',
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: 'rgba(0,0,0,0.6)',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ×
            </button>
          </div>
        )}

        {/* AI 작성 패널 */}
        {showAIPanel && (
          <div style={{
            marginTop: '10px',
            padding: '14px',
            backgroundColor: 'rgba(107,144,128,0.06)',
            borderRadius: '12px',
            border: '1px solid rgba(107,144,128,0.15)',
          }}>
            <p style={{ fontSize: '12px', fontWeight: '600', color: 'var(--button-primary)', marginBottom: '10px' }}>
              AI 작성 도우미
            </p>

            {/* 톤 선택 */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
              {['부드럽게', '중립적', '강하게'].map((t) => (
                <button
                  key={t}
                  onClick={() => setAiTone(t)}
                  style={{
                    flex: 1,
                    padding: '7px 0',
                    fontSize: '12px',
                    fontWeight: '600',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    backgroundColor: aiTone === t ? 'var(--button-primary)' : 'rgba(255,255,255,0.7)',
                    color: aiTone === t ? 'white' : 'var(--text-secondary)',
                    border: aiTone === t ? 'none' : '1px solid rgba(0,0,0,0.08)',
                  }}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* 키워드 입력 */}
            <input
              type="text"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="키워드나 짧은 문장을 입력하세요"
              disabled={aiGenerating}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAIGenerate(); }}
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: '13px',
                border: '1px solid rgba(0,0,0,0.1)',
                borderRadius: '8px',
                backgroundColor: 'rgba(255,255,255,0.8)',
                color: 'var(--text-primary)',
                outline: 'none',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
                marginBottom: '10px',
              }}
            />

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleAIGenerate}
                disabled={!aiPrompt.trim() || aiGenerating}
                style={{
                  flex: 1,
                  padding: '9px 0',
                  backgroundColor: aiPrompt.trim() && !aiGenerating ? 'var(--button-primary)' : 'rgba(0,0,0,0.06)',
                  color: aiPrompt.trim() && !aiGenerating ? 'white' : 'var(--text-muted)',
                  borderRadius: '8px',
                  fontWeight: '600',
                  border: 'none',
                  cursor: aiPrompt.trim() && !aiGenerating ? 'pointer' : 'not-allowed',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                {aiGenerating ? (
                  <>
                    <div style={{
                      width: '14px', height: '14px',
                      border: '2px solid rgba(0,0,0,0.1)', borderTop: '2px solid var(--text-muted)',
                      borderRadius: '50%', animation: 'spin 0.8s linear infinite',
                    }} />
                    생성 중...
                  </>
                ) : '생성'}
              </button>
              <button
                onClick={() => { setShowAIPanel(false); setAiPrompt(''); }}
                style={{
                  padding: '9px 16px',
                  backgroundColor: 'rgba(0,0,0,0.06)',
                  color: 'var(--text-secondary)',
                  borderRadius: '8px',
                  fontWeight: '500',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
              >
                닫기
              </button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={handleImageSelect}
              style={{ display: 'none' }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                padding: '8px 14px',
                background: 'rgba(255,255,255,0.5)',
                border: '1px solid rgba(0,0,0,0.08)',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '13px',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              사진
            </button>

            <button
              onClick={() => setShowAIPanel(!showAIPanel)}
              style={{
                padding: '8px 14px',
                background: showAIPanel ? 'rgba(107,144,128,0.15)' : 'rgba(255,255,255,0.5)',
                border: showAIPanel ? '1px solid var(--button-primary)' : '1px solid rgba(0,0,0,0.08)',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '13px',
                color: showAIPanel ? 'var(--button-primary)' : 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: showAIPanel ? '600' : '400',
                transition: 'all 0.2s',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a4 4 0 0 1 4 4v1a3 3 0 0 1 3 3v1a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3v-1a3 3 0 0 1 3-3V6a4 4 0 0 1 4-4z" />
                <path d="M9 18h6" />
                <path d="M10 22h4" />
              </svg>
              AI 작성
            </button>
          </div>

          <button
            onClick={handleSubmit}
            disabled={(!content.trim() && !imageFile) || submitting}
            style={{
              padding: '8px 20px',
              background: (content.trim() || imageFile) && !submitting ? 'var(--button-primary)' : 'rgba(0,0,0,0.06)',
              color: (content.trim() || imageFile) && !submitting ? '#FFFFFF' : 'var(--text-muted)',
              border: 'none',
              borderRadius: '10px',
              fontWeight: '600',
              cursor: (content.trim() || imageFile) && !submitting ? 'pointer' : 'not-allowed',
              fontSize: '14px',
              transition: 'all 0.2s',
            }}
          >
            {submitting ? '게시 중...' : '게시'}
          </button>
        </div>
      </div>

      {/* 게시글 목록 */}
      {posts.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '48px 24px' }}>
          아직 게시글이 없습니다. 첫 게시글을 작성해보세요!
        </div>
      ) : (
        posts.map((post) => {
          const isMyPost = post.user_id === authUser?.id;
          const canDelete = isMyPost || isCreator;
          const isEditing = editingId === post.id;

          return (
            <div
              key={post.id}
              className="glass"
              style={{
                padding: isMobile ? '14px' : '20px',
                borderRadius: '14px',
              }}
            >
              {/* 헤더: 작성자 + 시간 + 수정/삭제 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: 'var(--button-primary)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}>
                    {post.profiles?.nickname || '알 수 없음'}
                    {post.profiles?.custom_badge && (
                      <span style={{
                        padding: '1px 6px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: '500',
                        backgroundColor: 'rgba(107, 144, 128, 0.15)',
                        color: 'var(--button-primary)',
                      }}>
                        {post.profiles.custom_badge}
                      </span>
                    )}
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {formatTime(post.created_at)}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {isMyPost && !isEditing && (
                    <button
                      onClick={() => handleEditStart(post)}
                      style={{
                        padding: '4px 10px',
                        background: 'none',
                        border: '1px solid rgba(107,144,128,0.3)',
                        borderRadius: '6px',
                        color: 'var(--button-primary)',
                        fontSize: '12px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      수정
                    </button>
                  )}
                  {canDelete && !isEditing && (
                    <button
                      onClick={() => handleDelete(post)}
                      disabled={deletingId === post.id}
                      style={{
                        padding: '4px 10px',
                        background: 'none',
                        border: '1px solid rgba(220,38,38,0.2)',
                        borderRadius: '6px',
                        color: 'var(--danger, #dc2626)',
                        fontSize: '12px',
                        cursor: deletingId === post.id ? 'not-allowed' : 'pointer',
                        opacity: deletingId === post.id ? 0.5 : 1,
                        transition: 'all 0.2s',
                      }}
                    >
                      {deletingId === post.id ? '삭제 중' : '삭제'}
                    </button>
                  )}
                </div>
              </div>

              {/* 본문 또는 편집 UI */}
              {isEditing ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={4}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      background: 'rgba(255,255,255,0.7)',
                      border: '1px solid var(--button-primary)',
                      borderRadius: '10px',
                      color: 'var(--text-primary)',
                      fontSize: '14px',
                      lineHeight: '1.6',
                      resize: 'vertical',
                      outline: 'none',
                      fontFamily: 'inherit',
                      boxSizing: 'border-box',
                      boxShadow: '0 0 0 3px rgba(107,144,128,0.15)',
                    }}
                  />
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => handleEditSave(post.id)}
                      disabled={!editContent.trim()}
                      style={{
                        padding: '6px 16px',
                        backgroundColor: editContent.trim() ? 'var(--button-primary)' : 'rgba(0,0,0,0.06)',
                        color: editContent.trim() ? 'white' : 'var(--text-muted)',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: '600',
                        cursor: editContent.trim() ? 'pointer' : 'not-allowed',
                      }}
                    >
                      저장
                    </button>
                    <button
                      onClick={handleEditCancel}
                      style={{
                        padding: '6px 16px',
                        backgroundColor: 'rgba(0,0,0,0.06)',
                        color: 'var(--text-secondary)',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: '500',
                        cursor: 'pointer',
                      }}
                    >
                      취소
                    </button>
                  </div>
                </div>
              ) : (
                post.content && (
                  <p style={{
                    fontSize: '14px',
                    lineHeight: '1.7',
                    color: 'var(--text-primary)',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    margin: 0,
                    marginBottom: post.image_url ? '12px' : 0,
                  }}>
                    {post.content}
                  </p>
                )
              )}

              {/* 이미지 */}
              {post.image_url && (
                <img
                  src={post.image_url}
                  alt="게시글 이미지"
                  onClick={() => setZoomedImage(post.image_url)}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '400px',
                    borderRadius: '10px',
                    objectFit: 'cover',
                    cursor: 'pointer',
                    transition: 'opacity 0.2s',
                  }}
                />
              )}
            </div>
          );
        })
      )}

      {/* 이미지 확대 모달 */}
      {zoomedImage && (
        <div
          onClick={() => setZoomedImage(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            cursor: 'pointer',
            padding: '24px',
          }}
        >
          <img
            src={zoomedImage}
            alt="확대 이미지"
            style={{
              maxWidth: '90vw',
              maxHeight: '90vh',
              objectFit: 'contain',
              borderRadius: '8px',
            }}
          />
        </div>
      )}
        </>
      ))}
    </div>
  );
}
