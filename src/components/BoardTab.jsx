import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useIsMobile } from '../hooks/useIsMobile';

export default function BoardTab({ gatheringId, memberStatus, isCreator }) {
  const { user: authUser } = useAuth();
  const isMobile = useIsMobile();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [zoomedImage, setZoomedImage] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
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

  if (loading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
        게시글을 불러오는 중...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
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

          return (
            <div
              key={post.id}
              className="glass"
              style={{
                padding: isMobile ? '14px' : '20px',
                borderRadius: '14px',
              }}
            >
              {/* 헤더: 작성자 + 시간 + 삭제 */}
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

                {canDelete && (
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

              {/* 본문 */}
              {post.content && (
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
    </div>
  );
}
