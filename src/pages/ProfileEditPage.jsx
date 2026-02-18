import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import PremiumModal from '../components/PremiumModal';
import { useIsMobile } from '../hooks/useIsMobile';


export default function ProfileEditPage() {
  const { user, profile: authProfile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(true);

  const [nickname, setNickname] = useState("");
  const [favoriteGameCategories, setFavoriteGameCategories] = useState([]);
  const [birthYear, setBirthYear] = useState("");
  const [ageRange, setAgeRange] = useState("");
  const [location, setLocation] = useState("");
  const [favoriteGameTitle, setFavoriteGameTitle] = useState("");
  const [recentGames, setRecentGames] = useState("");
  const [bio, setBio] = useState("");

  const [customBadge, setCustomBadge] = useState("");

  const [customTagInput, setCustomTagInput] = useState("");
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [showAISection, setShowAISection] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      setNickname(data.nickname || "");
      setCustomBadge(data.custom_badge || "");
      setFavoriteGameCategories(data.favorite_game_categories || []);
      setBirthYear(data.birth_year?.toString() || "");
      setAgeRange(data.age_range || "");
      setLocation(data.location || "");
      setFavoriteGameTitle(data.favorite_game_title || "");
      setRecentGames(data.recent_games || "");
      setBio(data.bio || "");
    } catch (error) {
      console.error('프로필 로드 실패:', error);
      alert('프로필을 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }

  const addCustomTags = () => {
    const input = customTagInput.trim();
    if (!input) return;
    const newTags = input.split(',').map(t => t.trim()).filter(t => t);
    setFavoriteGameCategories(prev => [...new Set([...prev, ...newTags])]);
    setCustomTagInput("");
  };

  const removeTag = (tag) => {
    setFavoriteGameCategories(prev => prev.filter(t => t !== tag));
  };

  async function handleAIGenerate() {
    if (!aiInput.trim()) {
      alert('자기소개 내용을 입력해주세요.');
      return;
    }

    if (!authProfile?.is_premium && (authProfile?.ai_writing_left ?? 3) <= 0) {
      setShowPremiumModal(true);
      return;
    }

    setIsGeneratingAI(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-profile', {
        body: { rawIntro: aiInput }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data.bio) setBio(data.bio);
      if (data.favorite_game_title) setFavoriteGameTitle(data.favorite_game_title);
      if (data.recent_games) setRecentGames(data.recent_games);
      if (data.favorite_game_categories?.length > 0) setFavoriteGameCategories(data.favorite_game_categories);
      if (data.age_range) setAgeRange(data.age_range);
      if (data.location) setLocation(data.location);

      if (!authProfile?.is_premium) {
        await supabase
          .from('profiles')
          .update({ ai_writing_left: Math.max(0, (authProfile?.ai_writing_left ?? 3) - 1) })
          .eq('id', user.id);
        await refreshProfile();
      }

      alert('AI가 프로필을 생성했습니다! 확인 후 수정하세요.');
    } catch (err) {
      console.error('AI 생성 오류:', err);
      alert('AI 생성 중 오류가 발생했습니다: ' + (err.message || '알 수 없는 오류'));
    } finally {
      setIsGeneratingAI(false);
    }
  }

  async function handleSubmit() {
    if (!nickname || favoriteGameCategories.length === 0) {
      alert("닉네임과 선호 게임은 필수입니다!");
      return;
    }

    try {
      const profileData = {
        nickname,
        favorite_game_categories: favoriteGameCategories,
        birth_year: birthYear ? parseInt(birthYear) : null,
        age_range: ageRange || null,
        location: location || null,
        favorite_game_title: favoriteGameTitle || null,
        recent_games: recentGames || null,
        bio: bio || null,
      };

      if (authProfile?.is_premium) {
        profileData.custom_badge = customBadge || null;
      }

      const { error } = await supabase
        .from("profiles")
        .update(profileData)
        .eq('id', user.id);

      if (error) throw error;

      alert('프로필이 수정되었습니다!');
      navigate('/profile');
    } catch (error) {
      console.error('프로필 수정 실패:', error);
      alert('프로필 수정에 실패했습니다: ' + (error.message || '알 수 없는 오류'));
    }
  }

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

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: isMobile ? '12px 4px' : '32px 24px', ...(isMobile ? { width: '93%' } : {}) }}>
      <h1 style={{
        fontSize: '24px',
        fontWeight: '700',
        color: 'var(--button-primary)',
        marginBottom: '24px'
      }}>
        프로필 수정
      </h1>

      {/* AI로 프로필 생성 */}
      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={() => setShowAISection(!showAISection)}
          className="glass"
          style={{
            position: 'relative',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 16px',
            borderRadius: '12px',
            border: '1px solid rgba(0,0,0,0.06)',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '600',
            color: 'var(--button-primary)',
            transition: 'all 0.2s'
          }}
        >
          <span>✨ AI로 프로필 자동 생성</span>
          <span>{showAISection ? '▼' : '▶'}</span>
          {!authProfile?.is_premium && (
            <span style={{
              position: 'absolute',
              top: '-7px',
              right: '-7px',
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              backgroundColor: '#5a8a72',
              color: '#FFFFFF',
              fontSize: '11px',
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid white',
              lineHeight: 1,
            }}>
              {authProfile?.ai_writing_left ?? 3}
            </span>
          )}
        </button>

        {showAISection && (
          <div className="glass-strong" style={{
            marginTop: '12px',
            padding: '16px',
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <textarea
              placeholder="예) 20대 후반 직장인이고, 주말에 보드게임이나 방탈출 좋아합니다."
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              style={{
                ...inputStyle,
                height: '80px',
                resize: 'none'
              }}
              onFocus={focusHandler}
              onBlur={blurHandler}
            />
            <button
              onClick={handleAIGenerate}
              disabled={isGeneratingAI}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: 'var(--button-primary)',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: isGeneratingAI ? 'not-allowed' : 'pointer',
                opacity: isGeneratingAI ? 0.6 : 1,
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => { if (!isGeneratingAI) e.currentTarget.style.backgroundColor = 'var(--button-primary-hover)'; }}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--button-primary)'}
            >
              {isGeneratingAI ? '생성 중...' : 'AI로 프로필 생성하기 ✨'}
            </button>
          </div>
        )}
      </div>

      <div className="glass-strong" style={{
        padding: '24px',
        borderRadius: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
      }}>
        {/* 닉네임 */}
        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: 'var(--text-secondary)' }}>
            닉네임 *
          </label>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            style={inputStyle}
            onFocus={focusHandler}
            onBlur={blurHandler}
          />
        </div>

        {/* 커스텀 뱃지 (프리미엄 전용) */}
        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: 'var(--text-secondary)' }}>
            커스텀 뱃지
          </label>
          {authProfile?.is_premium ? (
            <>
              <input
                type="text"
                value={customBadge}
                onChange={(e) => {
                  if (e.target.value.length <= 10) setCustomBadge(e.target.value);
                }}
                maxLength={10}
                placeholder="닉네임 옆에 표시될 뱃지 (최대 10자)"
                style={inputStyle}
                onFocus={focusHandler}
                onBlur={blurHandler}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  미리보기: <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{nickname || '닉네임'}</span>
                  {customBadge && (
                    <span style={{
                      marginLeft: '6px',
                      padding: '1px 6px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: '500',
                      backgroundColor: 'rgba(107, 144, 128, 0.15)',
                      color: 'var(--button-primary)',
                    }}>
                      {customBadge}
                    </span>
                  )}
                </div>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{customBadge.length}/10</span>
              </div>
            </>
          ) : (
            <div
              onClick={() => setShowPremiumModal(true)}
              style={{
                padding: '12px 14px',
                border: '1px solid rgba(0,0,0,0.08)',
                borderRadius: '10px',
                backgroundColor: 'rgba(0,0,0,0.02)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                🔒 프리미엄 회원 전용 기능입니다
              </span>
              <span style={{ fontSize: '12px', color: 'var(--button-primary)', fontWeight: '600' }}>
                업그레이드
              </span>
            </div>
          )}
        </div>

        {/* 선호 게임 태그 */}
        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: 'var(--text-secondary)' }}>
            하고 싶은 것
          </label>
          <div>
            <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px', color: 'var(--text-muted)' }}>
              직접 태그 입력 (쉼표로 구분, Enter로 추가)
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                placeholder="예) 경찰과 도둑, 스팀 게임, 배드민턴"
                value={customTagInput}
                onChange={(e) => setCustomTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomTags(); } }}
                style={{ ...inputStyle, fontSize: '13px', flex: 1 }}
                onFocus={focusHandler}
                onBlur={blurHandler}
              />
              <button
                onClick={addCustomTags}
                style={{
                  padding: '0 16px',
                  backgroundColor: 'var(--button-primary)',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--button-primary-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--button-primary)'}
              >
                추가
              </button>
            </div>
          </div>

          {/* 선택된 태그 칩 */}
          {favoriteGameCategories.length > 0 && (
            <div style={{ marginTop: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', marginBottom: '8px', color: 'var(--text-muted)' }}>
                선택된 태그
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {favoriteGameCategories.map((tag) => (
                  <span
                    key={tag}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '5px 10px 5px 12px',
                      borderRadius: '20px',
                      fontSize: '13px',
                      fontWeight: '500',
                      border: '2px solid #A8B8A5',
                      backgroundColor: 'rgba(168,184,165,0.15)',
                      color: '#5A7A6D',
                    }}
                  >
                    #{tag}
                    <button
                      onClick={() => removeTag(tag)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        border: 'none',
                        backgroundColor: 'rgba(168,184,165,0.25)',
                        color: '#5A7A6D',
                        cursor: 'pointer',
                        fontSize: '12px',
                        lineHeight: 1,
                        padding: 0,
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(168,184,165,0.4)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(168,184,165,0.25)'; }}
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 나이 */}
        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: 'var(--text-secondary)' }}>나이</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="number"
              placeholder="태어난 년도 (예: 1995)"
              value={birthYear}
              onChange={(e) => setBirthYear(e.target.value)}
              style={{ ...inputStyle, flex: 1 }}
              onFocus={focusHandler}
              onBlur={blurHandler}
            />
            <select
              value={ageRange}
              onChange={(e) => setAgeRange(e.target.value)}
              style={{ ...inputStyle, flex: 1 }}
              onFocus={focusHandler}
              onBlur={blurHandler}
            >
              <option value="">연령대 선택</option>
              <option value="20대 초반">20대 초반</option>
              <option value="20대 중반">20대 중반</option>
              <option value="20대 후반">20대 후반</option>
              <option value="30대 초반">30대 초반</option>
              <option value="30대 중반">30대 중반</option>
              <option value="30대 후반">30대 후반</option>
              <option value="40대+">40대+</option>
            </select>
          </div>
        </div>

        {/* 지역 */}
        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: 'var(--text-secondary)' }}>지역</label>
          <input
            type="text"
            placeholder="예) 강남구, 홍대"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            style={inputStyle}
            onFocus={focusHandler}
            onBlur={blurHandler}
          />
        </div>

        {/* 취미 */}
        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: 'var(--text-secondary)' }}>
            취미
          </label>
          <input
            type="text"
            placeholder="예) 유튜브 보기, 뜨개질, 배드민턴"
            value={favoriteGameTitle}
            onChange={(e) => setFavoriteGameTitle(e.target.value)}
            style={inputStyle}
            onFocus={focusHandler}
            onBlur={blurHandler}
          />
        </div>

        {/* 좋아하는 것 */}
        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: 'var(--text-secondary)' }}>
            좋아하는 것
          </label>
          <input
            type="text"
            placeholder="예) 보드게임, 고양이, 딸기"
            value={recentGames}
            onChange={(e) => setRecentGames(e.target.value)}
            style={inputStyle}
            onFocus={focusHandler}
            onBlur={blurHandler}
          />
        </div>

        {/* 자기소개 */}
        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: 'var(--text-secondary)' }}>
            자유 자기소개
          </label>
          <textarea
            placeholder="자유롭게 자기소개를 작성해주세요"
            value={bio}
            onChange={(e) => {
              if (e.target.value.length <= 500) {
                setBio(e.target.value);
              }
            }}
            maxLength={500}
            style={{
              ...inputStyle,
              height: '100px',
              resize: 'none'
            }}
            onFocus={focusHandler}
            onBlur={blurHandler}
          />
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', textAlign: 'right' }}>
            {bio.length}/500
          </p>
        </div>

        {/* 저장 및 취소 버튼 */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handleSubmit}
            disabled={!nickname || favoriteGameCategories.length === 0}
            style={{
              flex: 1,
              padding: '14px',
              backgroundColor: 'var(--button-primary)',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '12px',
              fontSize: '15px',
              fontWeight: '600',
              cursor: (!nickname || favoriteGameCategories.length === 0) ? 'not-allowed' : 'pointer',
              opacity: (!nickname || favoriteGameCategories.length === 0) ? 0.5 : 1,
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = 'var(--button-primary-hover)'; }}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--button-primary)'}
          >
            저장하기
          </button>
          <button
            onClick={() => navigate('/profile')}
            style={{
              padding: '14px 24px',
              backgroundColor: 'rgba(255,255,255,0.5)',
              color: 'var(--text-secondary)',
              border: '1px solid rgba(0,0,0,0.08)',
              borderRadius: '12px',
              fontSize: '15px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.7)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.5)'}
          >
            취소
          </button>
        </div>
      </div>

      <PremiumModal
        isOpen={showPremiumModal}
        onClose={() => setShowPremiumModal(false)}
      />
    </div>
  );
}
