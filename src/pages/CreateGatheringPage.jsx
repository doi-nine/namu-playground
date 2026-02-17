import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { AVAILABLE_TAGS } from '../constants/tags';
import PremiumModal from '../components/PremiumModal';
import { useAuth } from '../context/AuthContext';

export default function CreateGatheringPage() {
    const navigate = useNavigate();

    const [mode, setMode] = useState('toggle');
    const { user, profile, refreshProfile } = useAuth();
    const [showPremiumModal, setShowPremiumModal] = useState(false);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [locationType, setLocationType] = useState('offline');
    const [offlineLocation, setOfflineLocation] = useState('');
    const [onlineLink, setOnlineLink] = useState('');
    const [dateTime, setDateTime] = useState('');
    const [maxMembers, setMaxMembers] = useState(10);
    const [tags, setTags] = useState([]);
    const [approvalRequired, setApprovalRequired] = useState(false);
    const [aiInput, setAiInput] = useState('');
    const [aiResult, setAiResult] = useState(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [focusedInput, setFocusedInput] = useState(null);
    const [tagInput, setTagInput] = useState('');

    const isPremium = profile?.is_premium;
    const maxTagCount = isPremium ? 6 : 3;
    const maxMemberLimit = isPremium ? 100 : 20;

    const handleAIGenerate = async () => {
        if (!aiInput.trim()) {
            setError('어떤 모임을 만들고 싶은지 입력해주세요.');
            return;
        }

        if (!profile?.is_premium && profile?.ai_recommendations_left <= 0) {
            setShowPremiumModal(true);
            return;
        }

        setIsGenerating(true);
        setError('');
        try {
            const { data, error: aiError } = await supabase.functions.invoke('ai-generate-gathering', {
                body: { prompt: aiInput }
            });

            if (aiError) throw aiError;

            if (!data || !data.title || !data.description || !data.tags || data.tags.length === 0) {
                throw new Error('AI가 모임 정보를 생성하지 못했습니다.');
            }

            if (!profile?.is_premium) {
                const { error: updateError } = await supabase
                    .from('profiles')
                    .update({
                        ai_recommendations_left: Math.max(0, (profile?.ai_recommendations_left || 0) - 1)
                    })
                    .eq('id', user.id);

                if (updateError) console.error('횟수 차감 오류:', updateError);

                if (refreshProfile) {
                    await refreshProfile();
                }
            }

            setAiResult(data);
            setTitle(data.title || '');
            setDescription(data.description || '');
            if (data.tags && Array.isArray(data.tags)) {
                setTags(data.tags);
            } else if (data.tags && typeof data.tags === 'string') {
                setTags(data.tags.split(',').map(t => t.trim()));
            } else {
                setTags([]);
            }
        } catch (err) {
            console.error('AI 생성 오류:', err);
            setError('AI 생성 중 오류가 발생했습니다. 다시 시도해주세요.');
        } finally {
            setIsGenerating(false);
        }
    };

    const validateForm = () => {
        if (tags.length === 0) return '최소 1개의 태그를 입력해주세요.';
        if (!title.trim()) return '제목을 입력해주세요.';
        if (!dateTime) return '날짜와 시간을 선택해주세요.';
        if (locationType === 'offline' && !offlineLocation.trim()) {
            return '오프라인 장소를 입력해주세요.';
        }
        if (locationType === 'online' && !onlineLink.trim()) {
            return '온라인 링크를 입력해주세요.';
        }
        if (maxMembers < 2 || maxMembers > maxMemberLimit) {
            return `최대 인원은 2~${maxMemberLimit}명 사이로 설정해주세요.`;
        }
        return null;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!user) {
            alert('로그인이 필요합니다.');
            return;
        }

        const validationError = validateForm();
        if (validationError) {
            alert(validationError);
            return;
        }

        setIsSubmitting(true);

        try {
            const datetimeISO = new Date(dateTime).toISOString();
            const processedTags = tags.map(tag => tag.replace(/^#/, '').trim()).filter(t => t);

            const { data: gatheringData, error: gatheringError } = await supabase
                .from('gatherings')
                .insert([
                    {
                        title: title,
                        description: description,
                        datetime: datetimeISO,
                        location_type: locationType,
                        location: locationType === 'offline' ? offlineLocation : null,
                        online_link: locationType === 'online' ? onlineLink : null,
                        max_members: parseInt(maxMembers),
                        current_members: 1,
                        approval_required: approvalRequired,
                        creator_id: user.id,
                        tags: processedTags
                    }
                ])
                .select()
                .single();

            if (gatheringError) throw gatheringError;

            const { error: memberError } = await supabase
                .from('gathering_members')
                .insert([
                    {
                        gathering_id: gatheringData.id,
                        user_id: user.id,
                        status: 'approved',
                        role: 'creator'
                    }
                ]);

            if (memberError) throw memberError;

            alert('모임이 성공적으로 생성되었습니다!');
            navigate(`/gatherings/${gatheringData.id}`);

        } catch (error) {
            console.error('모임 생성 오류 상세:', error);
            console.error('에러 메시지:', error.message);
            console.error('에러 상세:', JSON.stringify(error, null, 2));
            alert('모임 생성 중 오류가 발생했습니다: ' + error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const inputStyle = (name) => ({
        width: '100%',
        padding: '12px 16px',
        border: '1px solid',
        borderColor: focusedInput === name ? 'var(--button-primary)' : 'rgba(0,0,0,0.08)',
        borderRadius: '12px',
        backgroundColor: 'rgba(255,255,255,0.5)',
        color: 'var(--text-primary)',
        outline: 'none',
        fontSize: '14px',
        boxSizing: 'border-box',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        boxShadow: focusedInput === name ? '0 0 0 3px rgba(107,144,128,0.15)' : 'none',
    });

    const textareaStyle = (name) => ({
        ...inputStyle(name),
        resize: 'none',
    });

    const toggleBtnStyle = (isActive) => ({
        flex: 1,
        padding: '12px 0',
        borderRadius: '10px',
        fontWeight: '600',
        border: 'none',
        cursor: 'pointer',
        transition: 'all 0.2s',
        backgroundColor: isActive ? 'var(--button-primary)' : 'transparent',
        color: isActive ? '#FFFFFF' : 'var(--text-muted)',
        fontSize: '14px',
    });

    const segmentBtnStyle = (isActive) => ({
        flex: 1,
        padding: '10px 0',
        borderRadius: '10px',
        fontWeight: '500',
        border: 'none',
        cursor: 'pointer',
        transition: 'all 0.2s',
        backgroundColor: isActive ? 'var(--button-primary)' : 'rgba(0,0,0,0.04)',
        color: isActive ? '#FFFFFF' : 'var(--text-secondary)',
        fontSize: '14px',
    });

    const handleTagInputKeyDown = (e) => {
        if (e.key === ',' || e.key === 'Enter') {
            e.preventDefault();
            const value = tagInput.trim().replace(/^#/, '');
            if (value && !tags.includes(value)) {
                if (tags.length >= maxTagCount) return;
                setTags(prev => [...prev, value]);
            }
            setTagInput('');
        }
    };

    const handleTagInputBlurCommit = () => {
        const value = tagInput.trim().replace(/^#/, '');
        if (value && !tags.includes(value) && tags.length < maxTagCount) {
            setTags(prev => [...prev, value]);
        }
        setTagInput('');
        setFocusedInput(null);
    };

    const removeTag = (index) => {
        setTags(prev => prev.filter((_, i) => i !== index));
    };

    const renderTagInput = (prefix) => (
        <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: 'var(--text-primary)' }}>태그 *</label>
            {tags.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                    {tags.map((tag, index) => (
                        <span key={index} style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '5px 10px',
                            backgroundColor: '#FFFFFF',
                            border: '2px solid var(--button-primary)',
                            color: 'var(--button-primary)',
                            borderRadius: '20px',
                            fontSize: '13px',
                            fontWeight: '500',
                        }}>
                            #{tag}
                            <button
                                onClick={() => removeTag(index)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--text-muted)',
                                    cursor: 'pointer',
                                    padding: '0 2px',
                                    fontSize: '14px',
                                    lineHeight: 1,
                                    display: 'flex',
                                    alignItems: 'center',
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--danger)'}
                                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                            >
                                ×
                            </button>
                        </span>
                    ))}
                </div>
            )}
            <input
                type="text"
                placeholder={tags.length >= maxTagCount ? `태그 최대 ${maxTagCount}개` : '태그 입력 후 쉼표(,) 또는 Enter'}
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagInputKeyDown}
                disabled={tags.length >= maxTagCount}
                style={{
                    ...inputStyle(`${prefix}tags`),
                    opacity: tags.length >= maxTagCount ? 0.5 : 1,
                }}
                onFocus={() => setFocusedInput(`${prefix}tags`)}
                onBlur={handleTagInputBlurCommit}
            />
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                {tags.length}/{maxTagCount}개 · 쉼표(,) 또는 Enter로 태그 추가
            </p>
        </div>
    );

    const renderLocationFields = (prefix) => (
        <>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <button onClick={() => setLocationType('offline')} style={segmentBtnStyle(locationType === 'offline')}>오프라인</button>
                <button onClick={() => setLocationType('online')} style={segmentBtnStyle(locationType === 'online')}>온라인</button>
            </div>
            {locationType === 'offline' && (
                <input
                    type="text"
                    placeholder="예) 강남역 스타벅스"
                    value={offlineLocation}
                    onChange={(e) => setOfflineLocation(e.target.value)}
                    style={inputStyle(`${prefix}offlineLocation`)}
                    onFocus={() => setFocusedInput(`${prefix}offlineLocation`)}
                    onBlur={() => setFocusedInput(null)}
                />
            )}
            {locationType === 'online' && (
                <input
                    type="url"
                    placeholder="예) https://discord.gg/..."
                    value={onlineLink}
                    onChange={(e) => setOnlineLink(e.target.value)}
                    style={inputStyle(`${prefix}onlineLink`)}
                    onFocus={() => setFocusedInput(`${prefix}onlineLink`)}
                    onBlur={() => setFocusedInput(null)}
                />
            )}
        </>
    );

    const renderDetailFields = (prefix) => (
        <>
            <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: 'var(--text-primary)' }}>날짜 및 시간 *</label>
                <input
                    type="datetime-local"
                    value={dateTime}
                    onChange={(e) => setDateTime(e.target.value)}
                    style={inputStyle(`${prefix}dateTime`)}
                    onFocus={() => setFocusedInput(`${prefix}dateTime`)}
                    onBlur={() => setFocusedInput(null)}
                />
            </div>
            <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: 'var(--text-primary)' }}>최대 인원: {maxMembers}명</label>
                <input
                    type="range"
                    min="2"
                    max={maxMemberLimit}
                    value={maxMembers}
                    onChange={(e) => setMaxMembers(Number(e.target.value))}
                    style={{ width: '100%', height: '8px', borderRadius: '8px', appearance: 'none', cursor: 'pointer', accentColor: 'var(--button-primary)' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>2명</span>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{maxMemberLimit}명</span>
                </div>
            </div>
            <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: 'var(--text-primary)' }}>참가 방식</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => setApprovalRequired(false)} style={segmentBtnStyle(!approvalRequired)}>자유 참가</button>
                    <button onClick={() => setApprovalRequired(true)} style={segmentBtnStyle(approvalRequired)}>승인제</button>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
                    {approvalRequired ? '참가 신청 시 내가 확인 후 수락합니다' : '누구나 자유롭게 참가할 수 있습니다'}
                </p>
            </div>
        </>
    );

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '32px 24px', paddingBottom: '100px' }}>
            {/* 페이지 타이틀 */}
            <h1 style={{
                fontSize: '24px',
                fontWeight: '700',
                marginBottom: '24px',
                color: 'var(--button-primary)',
            }}>
                새 모임 만들기
            </h1>

            {/* 모드 토글: 직접 / AI */}
            <div className="glass" style={{
                display: 'flex',
                gap: '6px',
                marginBottom: '24px',
                padding: '5px',
                borderRadius: '14px',
            }}>
                <button onClick={() => setMode('toggle')} style={toggleBtnStyle(mode === 'toggle')}>직접 만들기</button>
                <button onClick={() => setMode('ai')} style={toggleBtnStyle(mode === 'ai')}>AI로 만들기</button>
            </div>

            {/* ─── 직접 만들기 모드 ─── */}
            {mode === 'toggle' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* 장소 타입 */}
                    <div className="glass-strong" style={{ borderRadius: '16px', padding: '24px' }}>
                        <h2 style={{ fontWeight: '600', fontSize: '15px', color: 'var(--text-primary)', marginBottom: '12px' }}>장소 타입 *</h2>
                        {renderLocationFields('')}
                    </div>

                    {/* 제목 & 설명 */}
                    <div className="glass-strong" style={{ borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div>
                            <label style={{ display: 'block', fontWeight: '600', fontSize: '15px', marginBottom: '8px', color: 'var(--text-primary)' }}>제목 *</label>
                            <input
                                type="text"
                                placeholder="모임 제목을 입력하세요"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                style={inputStyle('title')}
                                onFocus={() => setFocusedInput('title')}
                                onBlur={() => setFocusedInput(null)}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontWeight: '600', fontSize: '15px', marginBottom: '8px', color: 'var(--text-primary)' }}>설명 (선택)</label>
                            <textarea
                                placeholder="모임에 대해 자세히 설명해주세요"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={4}
                                style={textareaStyle('description')}
                                onFocus={() => setFocusedInput('description')}
                                onBlur={() => setFocusedInput(null)}
                            />
                        </div>
                    </div>

                    {/* 세부 설정 */}
                    <div className="glass-strong" style={{ borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <h2 style={{ fontWeight: '600', fontSize: '15px', color: 'var(--text-primary)' }}>세부 설정</h2>
                        {renderTagInput('')}
                        {renderDetailFields('')}
                    </div>
                </div>
            )}

            {/* ─── AI로 만들기 모드 ─── */}
            {mode === 'ai' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* AI 입력 */}
                    <div className="glass-strong" style={{ borderRadius: '16px', padding: '24px' }}>
                        <h2 style={{ fontWeight: '600', fontSize: '15px', color: 'var(--text-primary)', marginBottom: '12px' }}>어떤 모임을 만들고 싶으신가요?</h2>
                        <textarea
                            placeholder="예) 주말에 강남에서 보드게임 하면서 놀 사람 구해요. 초보자도 환영하고, 20대~30대 위주로 모이면 좋겠어요."
                            value={aiInput}
                            onChange={(e) => setAiInput(e.target.value)}
                            rows={5}
                            style={textareaStyle('aiInput')}
                            onFocus={() => setFocusedInput('aiInput')}
                            onBlur={() => setFocusedInput(null)}
                        />
                        <button
                            onClick={handleAIGenerate}
                            disabled={isGenerating}
                            style={{
                                marginTop: '16px',
                                width: '100%',
                                backgroundColor: isGenerating ? 'rgba(0,0,0,0.12)' : 'var(--button-primary)',
                                color: '#FFFFFF',
                                padding: '14px 0',
                                borderRadius: '12px',
                                fontWeight: '600',
                                border: 'none',
                                cursor: isGenerating ? 'not-allowed' : 'pointer',
                                transition: 'background-color 0.2s',
                                fontSize: '15px',
                            }}
                            onMouseEnter={(e) => { if (!isGenerating) e.currentTarget.style.backgroundColor = 'var(--button-primary-hover)'; }}
                            onMouseLeave={(e) => { if (!isGenerating) e.currentTarget.style.backgroundColor = 'var(--button-primary)'; }}
                        >
                            {isGenerating ? '생성 중...' : 'AI로 글 만들기'}
                        </button>
                    </div>

                    {aiResult && (
                        <>
                            {/* AI 결과 */}
                            <div className="glass-strong" style={{ borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <h2 style={{ fontWeight: '600', fontSize: '15px', color: 'var(--button-primary)' }}>AI가 만든 내용 (수정 가능)</h2>
                                {renderTagInput('ai')}
                                <div>
                                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: 'var(--text-primary)' }}>제목</label>
                                    <input
                                        type="text"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        style={inputStyle('aiTitle')}
                                        onFocus={() => setFocusedInput('aiTitle')}
                                        onBlur={() => setFocusedInput(null)}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: 'var(--text-primary)' }}>설명</label>
                                    <textarea
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        rows={4}
                                        style={textareaStyle('aiDescription')}
                                        onFocus={() => setFocusedInput('aiDescription')}
                                        onBlur={() => setFocusedInput(null)}
                                    />
                                </div>
                            </div>

                            {/* 추가 정보 입력 */}
                            <div className="glass-strong" style={{ borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <h2 style={{ fontWeight: '600', fontSize: '15px', color: 'var(--text-primary)' }}>추가 정보 입력</h2>
                                <div>
                                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: 'var(--text-primary)' }}>장소 타입 *</label>
                                    {renderLocationFields('ai')}
                                </div>
                                {renderDetailFields('ai')}
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* 에러 메시지 */}
            {error && (
                <div style={{
                    backgroundColor: 'rgba(220,38,38,0.06)',
                    border: '1px solid rgba(220,38,38,0.15)',
                    color: 'var(--danger)',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    marginTop: '16px',
                    fontSize: '14px',
                    fontWeight: '500',
                }}>
                    {error}
                </div>
            )}

            {/* 모임 만들기 버튼 */}
            <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                style={{
                    width: '100%',
                    backgroundColor: isSubmitting ? 'rgba(0,0,0,0.12)' : 'var(--button-primary)',
                    color: '#FFFFFF',
                    padding: '16px 0',
                    borderRadius: '14px',
                    fontWeight: '700',
                    fontSize: '16px',
                    border: 'none',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    transition: 'background-color 0.2s',
                    marginTop: '24px',
                }}
                onMouseEnter={(e) => { if (!isSubmitting) e.currentTarget.style.backgroundColor = 'var(--button-primary-hover)'; }}
                onMouseLeave={(e) => { if (!isSubmitting) e.currentTarget.style.backgroundColor = 'var(--button-primary)'; }}
            >
                {isSubmitting ? '저장 중...' : '모임 만들기'}
            </button>
            <PremiumModal isOpen={showPremiumModal} onClose={() => setShowPremiumModal(false)} />
        </div>
    );
}
