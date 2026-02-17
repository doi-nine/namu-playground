import { useState } from "react";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";

const GAME_CATEGORIES = [
  "경찰과 도둑",
  "마피아 게임",
  "보드게임",
  "방탈출",
  "PC 게임",
  "콘솔 게임",
  "모바일 게임",
  "카드 게임",
];

export default function ProfileSetupPage() {
  const [mode, setMode] = useState(null);
  const [step, setStep] = useState(0);
  const navigate = useNavigate();

  const [nickname, setNickname] = useState("");
  const [favoriteGameCategories, setFavoriteGameCategories] = useState([]);
  const [birthYear, setBirthYear] = useState("");
  const [ageRange, setAgeRange] = useState("");
  const [location, setLocation] = useState("");
  const [favoriteGameTitle, setFavoriteGameTitle] = useState("");
  const [recentGames, setRecentGames] = useState("");
  const [bio, setBio] = useState("");

  const [rawIntro, setRawIntro] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiResult, setAiResult] = useState(null);

  const toggleCategory = (category) => {
    setFavoriteGameCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    );
  };

  const handleAIGenerate = async () => {
    if (!rawIntro.trim()) {
      alert("자기소개를 입력해주세요!");
      return;
    }

    setAiGenerating(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      const response = await supabase.functions.invoke('ai-profile', {
        body: { rawIntro },
        headers: {
          Authorization: `Bearer ${session?.access_token}`
        }
      });

      if (response.error) throw response.error;

      const aiData = response.data;

      if (aiData?.error) {
        throw new Error(aiData.error);
      }

      setFavoriteGameCategories(aiData.favorite_game_categories || []);
      setFavoriteGameTitle(aiData.favorite_game_title || "");
      setRecentGames(aiData.recent_games || "");
      setBio(aiData.bio || "");
      setAgeRange(aiData.age_range || "");
      setLocation(aiData.location || "");
      setAiResult(aiData);

      setStep(3);
    } catch (error) {
      console.error('AI 생성 실패:', error);
      alert('AI 프로필 생성에 실패했습니다: ' + (error.message || '알 수 없는 오류'));
    } finally {
      setAiGenerating(false);
    }
  };

  const handleSubmit = async () => {
    if (!nickname || favoriteGameCategories.length === 0) {
      alert("닉네임과 선호 게임은 필수입니다!");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        alert('로그인 정보를 찾을 수 없습니다.');
        return;
      }

      const profileData = {
        id: user.id,
        email: user.email,
        nickname,
        favorite_game_categories: favoriteGameCategories,
        birth_year: birthYear ? parseInt(birthYear) : null,
        age_range: ageRange || null,
        location: location || null,
        favorite_game_title: favoriteGameTitle || null,
        recent_games: recentGames || null,
        bio: bio || null,
        raw_intro: mode === 'ai' ? rawIntro : null,
        is_ai_generated: mode === 'ai',
      };

      const { data, error } = await supabase
        .from("profiles")
        .upsert(profileData, { onConflict: 'id' })
        .select();

      if (error) {
        console.error('프로필 저장 실패:', error);
        alert(`프로필 저장에 실패했습니다: ${error.message}`);
        return;
      }

      console.log('프로필 저장 성공:', data);
      setStep(4);

    } catch (error) {
      console.error('프로필 저장 중 예외 발생:', error);
      alert('프로필 저장 중 오류가 발생했습니다.');
    }
  };

  const handleRecommendChoice = (wantRecommendation) => {
    if (wantRecommendation) {
      navigate('/ai-recommend', {
        state: {
          justCreatedProfile: {
            nickname,
            favorite_game_categories: favoriteGameCategories,
            birth_year: birthYear ? parseInt(birthYear) : null,
            age_range: ageRange || null,
            location: location || null,
            favorite_game_title: favoriteGameTitle || null,
            recent_games: recentGames || null,
            bio: bio || null,
          }
        }
      });
    } else {
      navigate('/');
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
    transition: 'all 0.2s',
    fontFamily: 'inherit',
  };

  const focusHandler = (e) => {
    e.target.style.borderColor = 'var(--button-primary)';
    e.target.style.boxShadow = '0 0 0 2px rgba(107,144,128,0.2)';
  };

  const blurHandler = (e) => {
    e.target.style.borderColor = 'rgba(0,0,0,0.08)';
    e.target.style.boxShadow = 'none';
  };

  const labelStyle = {
    display: 'block',
    fontSize: '13px',
    fontWeight: '600',
    marginBottom: '6px',
    color: 'var(--text-secondary)',
  };

  const progress = mode === 'ai' ? (step / 4) * 100 : (step / 3) * 100;

  const glassContainer = {
    width: '100%',
    maxWidth: '750px',
    margin: '0 auto',
    background: 'linear-gradient(135deg, rgba(255,255,255,0.7), rgba(255,255,255,0.3))',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.5)',
    borderRadius: '24px',
    padding: '40px 40px 16px 40px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.8)',
  };

  // 모드 선택 화면
  if (!mode) {
    return (
      <div style={{ minHeight: '100vh', padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={glassContainer}>
          <div style={{ maxWidth: '800px', margin: '0 auto', padding: '32px 24px' }}>
            <h1 style={{
              fontSize: '24px',
              fontWeight: '700',
              color: 'var(--button-primary)',
              marginBottom: '8px',
            }}>
              환영합니다!
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '28px' }}>
              프로필 작성 방법을 선택해주세요
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <button
                onClick={() => { setMode('ai'); setStep(1); }}
                style={{
                  width: '100%',
                  padding: '24px',
                  textAlign: 'left',
                  backgroundColor: 'var(--button-primary)',
                  color: '#FFFFFF',
                  borderRadius: '14px',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--button-primary-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--button-primary)'}
              >
                <div style={{ fontSize: '18px', fontWeight: '700', marginBottom: '6px' }}>✨ AI로 빠르게 작성</div>
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.85)' }}>
                  자기소개만 쓰면 AI가 자동으로 프로필을 완성해줘요
                </div>
              </button>

              <button
                onClick={() => { setMode('manual'); setStep(1); }}
                style={{
                  width: '100%',
                  padding: '24px',
                  textAlign: 'left',
                  backgroundColor: 'rgba(255, 255, 255, 0.75)',
                  color: 'var(--text-primary)',
                  borderRadius: '14px',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.9)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.75)'}
              >
                <div style={{ fontSize: '18px', fontWeight: '700', marginBottom: '6px' }}>✏️ 직접 작성</div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  항목별로 직접 선택하며 작성해요
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', padding: '24px', display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
      <div style={glassContainer}>
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '32px 24px' }}>
      <h1 style={{
        fontSize: '24px',
        fontWeight: '700',
        color: 'var(--button-primary)',
        marginBottom: '24px',
      }}>
        프로필 작성
      </h1>

      {/* Progress Bar */}
      <div style={{
        width: '100%',
        height: '6px',
        borderRadius: '3px',
        backgroundColor: 'rgba(0,0,0,0.06)',
        marginBottom: '24px',
      }}>
        <div style={{
          height: '6px',
          borderRadius: '3px',
          width: `${progress}%`,
          backgroundColor: 'var(--button-primary)',
          transition: 'width 0.3s ease',
        }} />
      </div>

      {/* AI 모드 - Step 1: 닉네임 */}
      {mode === 'ai' && step === 1 && (
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.75)',
          borderRadius: '14px',
          padding: '24px',
        }}>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px', color: 'var(--text-primary)' }}>
            닉네임을 입력해주세요
          </h2>
          <div>
            <label style={labelStyle}>닉네임 *</label>
            <input
              type="text"
              placeholder="닉네임"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              style={inputStyle}
              onFocus={focusHandler}
              onBlur={blurHandler}
            />
          </div>
          <button
            onClick={() => setStep(2)}
            disabled={!nickname}
            style={{
              width: '100%',
              padding: '14px',
              marginTop: '20px',
              backgroundColor: 'var(--button-primary)',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '12px',
              fontSize: '15px',
              fontWeight: '600',
              cursor: !nickname ? 'not-allowed' : 'pointer',
              opacity: !nickname ? 0.5 : 1,
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = 'var(--button-primary-hover)'; }}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--button-primary)'}
          >
            다음
          </button>
        </div>
      )}

      {/* AI 모드 - Step 2: 자기소개 입력 */}
      {mode === 'ai' && step === 2 && (
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.75)',
          borderRadius: '14px',
          padding: '24px',
        }}>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '4px', color: 'var(--text-primary)' }}>
            자기소개를 자유롭게 써주세요
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '16px' }}>
            좋아하는 게임, 플레이 스타일, 만나고 싶은 사람 등 자유롭게 작성해주세요!
          </p>
          <div>
            <label style={labelStyle}>자기소개</label>
            <textarea
              placeholder="예: 안녕하세요! 보드게임 카페에서 친구들이랑 게임하는 걸 좋아합니다. 특히 마피아 게임이랑 코드네임을 즐겨하고, 주말에 시간이 많아서 새로운 사람들 만나서 같이 게임하고 싶어요."
              value={rawIntro}
              onChange={(e) => setRawIntro(e.target.value)}
              style={{
                ...inputStyle,
                height: '160px',
                resize: 'none',
              }}
              onFocus={focusHandler}
              onBlur={blurHandler}
            />
          </div>
          <button
            onClick={handleAIGenerate}
            disabled={!rawIntro || aiGenerating}
            style={{
              width: '100%',
              padding: '14px',
              marginTop: '20px',
              backgroundColor: aiGenerating ? 'var(--text-muted)' : 'var(--button-primary)',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '12px',
              fontSize: '15px',
              fontWeight: '600',
              cursor: (!rawIntro || aiGenerating) ? 'not-allowed' : 'pointer',
              opacity: (!rawIntro || aiGenerating) ? 0.6 : 1,
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = 'var(--button-primary-hover)'; }}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = aiGenerating ? 'var(--text-muted)' : 'var(--button-primary)'}
          >
            {aiGenerating ? '✨ AI가 프로필을 만들고 있어요...' : '✨ AI로 프로필 완성하기'}
          </button>
        </div>
      )}

      {/* 수동 모드 - Step 1: 닉네임 + 게임 카테고리 */}
      {mode === 'manual' && step === 1 && (
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.75)',
          borderRadius: '14px',
          padding: '24px',
        }}>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px', color: 'var(--text-primary)' }}>
            닉네임과 선호 게임
          </h2>

          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>닉네임 *</label>
            <input
              type="text"
              placeholder="닉네임"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              style={inputStyle}
              onFocus={focusHandler}
              onBlur={blurHandler}
            />
          </div>

          <div>
            <label style={labelStyle}>선호하는 게임 * (중복 선택 가능)</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {GAME_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => toggleCategory(cat)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '20px',
                    fontSize: '13px',
                    border: favoriteGameCategories.includes(cat) ? 'none' : '1px solid rgba(0,0,0,0.06)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    fontWeight: favoriteGameCategories.includes(cat) ? '600' : '400',
                    backgroundColor: favoriteGameCategories.includes(cat) ? 'var(--button-primary)' : 'rgba(255,255,255,0.5)',
                    color: favoriteGameCategories.includes(cat) ? '#FFFFFF' : 'var(--text-secondary)',
                    fontFamily: 'inherit',
                  }}
                >
                  {favoriteGameCategories.includes(cat) && '✓ '}
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => setStep(2)}
            disabled={!nickname || favoriteGameCategories.length === 0}
            style={{
              width: '100%',
              padding: '14px',
              marginTop: '20px',
              backgroundColor: 'var(--button-primary)',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '12px',
              fontSize: '15px',
              fontWeight: '600',
              cursor: (!nickname || favoriteGameCategories.length === 0) ? 'not-allowed' : 'pointer',
              opacity: (!nickname || favoriteGameCategories.length === 0) ? 0.5 : 1,
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = 'var(--button-primary-hover)'; }}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--button-primary)'}
          >
            다음
          </button>
        </div>
      )}

      {/* 수동 모드 - Step 2: 추가 정보 */}
      {mode === 'manual' && step === 2 && (
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.75)',
          borderRadius: '14px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--text-primary)' }}>
            추가 정보 (선택사항)
          </h2>

          {/* 나이 */}
          <div>
            <label style={labelStyle}>나이</label>
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
                <option value="20대 후반">20대 후반</option>
                <option value="30대 초반">30대 초반</option>
                <option value="30대 후반">30대 후반</option>
                <option value="40대+">40대+</option>
              </select>
            </div>
          </div>

          {/* 지역 */}
          <div>
            <label style={labelStyle}>지역</label>
            <input
              type="text"
              placeholder="예: 강남구, 홍대"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              style={inputStyle}
              onFocus={focusHandler}
              onBlur={blurHandler}
            />
          </div>

          {/* 최애 게임 */}
          <div>
            <label style={labelStyle}>가장 좋아하는 게임</label>
            <input
              type="text"
              placeholder="예: 스플렌더, 코드네임"
              value={favoriteGameTitle}
              onChange={(e) => setFavoriteGameTitle(e.target.value)}
              style={inputStyle}
              onFocus={focusHandler}
              onBlur={blurHandler}
            />
          </div>

          {/* 최근 플레이 */}
          <div>
            <label style={labelStyle}>최근 플레이중인 게임</label>
            <input
              type="text"
              placeholder="예: 발로란트, TFT"
              value={recentGames}
              onChange={(e) => setRecentGames(e.target.value)}
              style={inputStyle}
              onFocus={focusHandler}
              onBlur={blurHandler}
            />
          </div>

          {/* 자기소개 */}
          <div>
            <label style={labelStyle}>자유 자기소개</label>
            <textarea
              placeholder="자유롭게 자기소개를 작성해주세요"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              style={{
                ...inputStyle,
                height: '100px',
                resize: 'none',
              }}
              onFocus={focusHandler}
              onBlur={blurHandler}
            />
          </div>

          <button
            onClick={() => setStep(3)}
            style={{
              width: '100%',
              padding: '14px',
              backgroundColor: 'var(--button-primary)',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '12px',
              fontSize: '15px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--button-primary-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--button-primary)'}
          >
            다음
          </button>
        </div>
      )}

      {/* Step 3: 프로필 미리보기 */}
      {step === 3 && (
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.75)',
          borderRadius: '14px',
          padding: '24px',
        }}>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px', color: 'var(--text-primary)' }}>
            프로필 미리보기
          </h2>

          <div style={{
            backgroundColor: 'rgba(255,255,255,0.5)',
            border: '1px solid rgba(0,0,0,0.06)',
            borderRadius: '12px',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}>
            <div>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>닉네임</span>
              <p style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)', margin: '4px 0 0' }}>{nickname}</p>
            </div>

            <div>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>선호 게임</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                {favoriteGameCategories.map(cat => (
                  <span
                    key={cat}
                    style={{
                      padding: '4px 12px',
                      borderRadius: '20px',
                      background: '#FFFFFF',
                      border: '2px solid #6B9080',
                      color: '#6B9080',
                      fontSize: '12px',
                      fontWeight: '500',
                    }}
                  >
                    {cat}
                  </span>
                ))}
              </div>
            </div>

            {(birthYear || ageRange) && (
              <div>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>나이</span>
                <p style={{ fontSize: '14px', color: 'var(--text-primary)', margin: '4px 0 0' }}>{ageRange || `${birthYear}년생`}</p>
              </div>
            )}

            {location && (
              <div>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>지역</span>
                <p style={{ fontSize: '14px', color: 'var(--text-primary)', margin: '4px 0 0' }}>{location}</p>
              </div>
            )}

            {favoriteGameTitle && (
              <div>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>최애 게임</span>
                <p style={{ fontSize: '14px', color: 'var(--text-primary)', margin: '4px 0 0' }}>{favoriteGameTitle}</p>
              </div>
            )}

            {recentGames && (
              <div>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>최근 플레이</span>
                <p style={{ fontSize: '14px', color: 'var(--text-primary)', margin: '4px 0 0' }}>{recentGames}</p>
              </div>
            )}

            {bio && (
              <div>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>소개</span>
                <p style={{ fontSize: '14px', color: 'var(--text-primary)', margin: '4px 0 0', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{bio}</p>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button
              onClick={() => setStep(2)}
              style={{
                padding: '14px 24px',
                backgroundColor: 'rgba(255,255,255,0.5)',
                color: 'var(--text-secondary)',
                border: '1px solid rgba(0,0,0,0.08)',
                borderRadius: '12px',
                fontSize: '15px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.7)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.5)'}
            >
              수정하기
            </button>
            <button
              onClick={handleSubmit}
              style={{
                flex: 1,
                padding: '14px',
                backgroundColor: 'var(--button-primary)',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '12px',
                fontSize: '15px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--button-primary-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--button-primary)'}
            >
              완료
            </button>
          </div>
        </div>
      )}

      {/* Step 4: 프로필 완성 + AI 추천 안내 */}
      {step === 4 && (
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.75)',
          borderRadius: '14px',
          padding: '32px 24px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '56px', marginBottom: '16px' }}>🎉</div>
          <h2 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '8px', color: 'var(--text-primary)' }}>
            프로필 완성!
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '28px' }}>
            {nickname}님의 프로필이 저장되었습니다
          </p>

          <div style={{
            padding: '24px',
            backgroundColor: 'var(--button-primary)',
            color: '#FFFFFF',
            borderRadius: '14px',
            marginBottom: '24px',
          }}>
            <div style={{ fontSize: '18px', fontWeight: '700', marginBottom: '6px' }}>✨ AI 모임 추천</div>
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }}>
              프로필을 기반으로 맞춤 모임을 추천받으실래요?
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              onClick={() => handleRecommendChoice(true)}
              style={{
                width: '100%',
                padding: '14px',
                backgroundColor: 'var(--button-primary)',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '12px',
                fontSize: '15px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--button-primary-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--button-primary)'}
            >
              좋아요! 추천 받을래요
            </button>
            <button
              onClick={() => handleRecommendChoice(false)}
              style={{
                width: '100%',
                padding: '14px',
                backgroundColor: 'rgba(255,255,255,0.5)',
                color: 'var(--text-secondary)',
                border: '1px solid rgba(0,0,0,0.08)',
                borderRadius: '12px',
                fontSize: '15px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.7)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.5)'}
            >
              다음에 할게요
            </button>
          </div>
        </div>
      )}
        </div>
      </div>
    </div>
  );
}
