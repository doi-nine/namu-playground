import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function BillSplitCalculator({ gatheringId, isHost, approvedMembers, currentUserId }) {
    const [totalAmount, setTotalAmount] = useState('');
    const [billSplit, setBillSplit] = useState(null);
    const [checks, setChecks] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadBillSplit();
    }, [gatheringId]);

    async function loadBillSplit() {
        try {
            const { data: splitData, error: splitError } = await supabase
                .from('bill_splits')
                .select('*')
                .eq('gathering_id', gatheringId)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (splitError) {
                console.error('Error loading bill split:', splitError);
                return;
            }

            if (splitData) {
                setBillSplit(splitData);

                const { data: checksData, error: checksError } = await supabase
                    .from('bill_split_checks')
                    .select('*')
                    .eq('bill_split_id', splitData.id);

                if (checksError) {
                    console.error('Error loading checks:', checksError);
                    return;
                }

                setChecks(checksData || []);
            }
        } catch (error) {
            console.error('Error in loadBillSplit:', error);
        }
    }

    async function handleCreateSplit() {
        if (!totalAmount || totalAmount <= 0) {
            alert('총 금액을 입력해주세요.');
            return;
        }

        if (approvedMembers.length === 0) {
            alert('승인된 참가자가 없습니다.');
            return;
        }

        setLoading(true);

        try {
            const perPersonAmount = Math.ceil(parseInt(totalAmount) / approvedMembers.length);

            const { data: splitData, error: splitError } = await supabase
                .from('bill_splits')
                .insert({
                    gathering_id: gatheringId,
                    total_amount: parseInt(totalAmount),
                    per_person_amount: perPersonAmount,
                    created_by: currentUserId
                })
                .select()
                .single();

            if (splitError) throw splitError;

            const checkInserts = approvedMembers.map(member => ({
                bill_split_id: splitData.id,
                user_id: member.user_id,
                is_paid: false
            }));

            const { error: checksError } = await supabase
                .from('bill_split_checks')
                .insert(checkInserts);

            if (checksError) throw checksError;

            await loadBillSplit();
            setTotalAmount('');
        } catch (error) {
            console.error('Error creating bill split:', error);
            alert('정산 계산기 생성 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    }

    async function handleToggleCheck(checkId, currentStatus) {
        try {
            const { error } = await supabase
                .from('bill_split_checks')
                .update({
                    is_paid: !currentStatus,
                    checked_at: !currentStatus ? new Date().toISOString() : null
                })
                .eq('id', checkId);

            if (error) throw error;

            setChecks(checks.map(check =>
                check.id === checkId
                    ? { ...check, is_paid: !currentStatus, checked_at: !currentStatus ? new Date().toISOString() : null }
                    : check
            ));
        } catch (error) {
            console.error('Error toggling check:', error);
            alert('상태 변경 중 오류가 발생했습니다.');
        }
    }

    async function handleReset() {
        if (!confirm('정산 내역을 초기화하시겠습니까?')) return;

        setLoading(true);

        try {
            const { error } = await supabase
                .from('bill_splits')
                .delete()
                .eq('id', billSplit.id);

            if (error) throw error;

            setBillSplit(null);
            setChecks([]);
        } catch (error) {
            console.error('Error resetting bill split:', error);
            alert('초기화 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    }

    const getMemberName = (userId) => {
        const member = approvedMembers.find(m => m.user_id === userId);
        return member?.profiles?.nickname || '알 수 없음';
    };

    const getMemberBadge = (userId) => {
        const member = approvedMembers.find(m => m.user_id === userId);
        return member?.profiles?.custom_badge || null;
    };

    const paidCount = checks.filter(c => c.is_paid).length;
    const totalCount = checks.length;

    const inputStyle = {
        width: '100%',
        padding: '12px 14px',
        border: '1px solid rgba(0,0,0,0.08)',
        borderRadius: '10px',
        fontSize: '16px',
        color: 'var(--text-primary)',
        backgroundColor: 'rgba(255,255,255,0.6)',
        outline: 'none',
        boxSizing: 'border-box'
    };

    if (!billSplit) {
        return (
            <div className="glass-strong" style={{
                borderRadius: '16px',
                padding: '24px'
            }}>
                {isHost ? (
                    <>
                        <div style={{ marginBottom: '14px' }}>
                            <label style={{
                                display: 'block',
                                fontSize: '13px',
                                fontWeight: '600',
                                marginBottom: '6px',
                                color: 'var(--text-secondary)'
                            }}>
                                총 금액
                            </label>
                            <input
                                type="number"
                                value={totalAmount}
                                onChange={(e) => setTotalAmount(e.target.value)}
                                placeholder="예: 50000"
                                style={inputStyle}
                            />
                        </div>

                        <div style={{
                            backgroundColor: 'rgba(255,255,255,0.5)',
                            padding: '14px',
                            borderRadius: '10px',
                            marginBottom: '14px',
                            border: '1px solid rgba(0,0,0,0.06)'
                        }}>
                            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                                참가자 수
                            </div>
                            <div style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-primary)' }}>
                                {approvedMembers.length}명
                            </div>
                        </div>

                        {totalAmount && (
                            <div style={{
                                backgroundColor: 'rgba(107,144,128,0.15)',
                                padding: '14px',
                                borderRadius: '10px',
                                marginBottom: '14px',
                                border: '1px solid rgba(107,144,128,0.2)'
                            }}>
                                <div style={{ fontSize: '13px', color: 'var(--button-primary)', marginBottom: '4px' }}>
                                    1인당 금액
                                </div>
                                <div style={{ fontSize: '22px', fontWeight: '700', color: 'var(--button-primary)' }}>
                                    {Math.ceil(parseInt(totalAmount) / approvedMembers.length).toLocaleString()}원
                                </div>
                            </div>
                        )}

                        <button
                            onClick={handleCreateSplit}
                            disabled={loading || !totalAmount}
                            style={{
                                width: '100%',
                                padding: '14px',
                                backgroundColor: totalAmount ? 'var(--button-primary)' : 'rgba(0,0,0,0.04)',
                                color: totalAmount ? '#FFFFFF' : 'var(--text-muted)',
                                border: 'none',
                                borderRadius: '12px',
                                fontSize: '15px',
                                fontWeight: '600',
                                cursor: totalAmount ? 'pointer' : 'not-allowed',
                                transition: 'all 0.2s'
                            }}
                        >
                            {loading ? '생성 중...' : '정산 계산기 생성'}
                        </button>
                    </>
                ) : (
                    <div style={{
                        textAlign: 'center',
                        padding: '32px',
                        color: 'var(--text-muted)',
                        fontSize: '14px'
                    }}>
                        방장이 정산 계산기를 생성하면<br />
                        여기에 표시됩니다.
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="glass-strong" style={{
            borderRadius: '16px',
            padding: '24px'
        }}>
            {/* 정산 정보 */}
            <div style={{
                backgroundColor: 'rgba(255,255,255,0.5)',
                padding: '16px',
                borderRadius: '12px',
                marginBottom: '16px',
                border: '1px solid rgba(0,0,0,0.06)'
            }}>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '16px'
                }}>
                    <div>
                        <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>총 금액</div>
                        <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>
                            {billSplit.total_amount.toLocaleString()}원
                        </div>
                    </div>
                    <div>
                        <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>1인당</div>
                        <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--button-primary)' }}>
                            {billSplit.per_person_amount.toLocaleString()}원
                        </div>
                    </div>
                </div>
            </div>

            {/* 진행 상황 */}
            <div style={{
                backgroundColor: 'rgba(107,144,128,0.15)',
                padding: '14px',
                borderRadius: '10px',
                marginBottom: '16px',
                textAlign: 'center',
                border: '1px solid rgba(107,144,128,0.2)'
            }}>
                <div style={{ fontSize: '13px', color: 'var(--button-primary)', marginBottom: '4px' }}>송금 완료</div>
                <div style={{ fontSize: '22px', fontWeight: '700', color: 'var(--button-primary)' }}>
                    {paidCount} / {totalCount}
                </div>
            </div>

            {/* 참가자 체크리스트 */}
            <div style={{
                backgroundColor: 'rgba(255,255,255,0.5)',
                borderRadius: '12px',
                border: '1px solid rgba(0,0,0,0.06)',
                overflow: 'hidden'
            }}>
                {checks.map((check, index) => {
                    const memberName = getMemberName(check.user_id);
                    const isCurrentUser = check.user_id === currentUserId;

                    return (
                        <div
                            key={check.id}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '14px 16px',
                                borderBottom: index < checks.length - 1 ? '1px solid rgba(0,0,0,0.06)' : 'none',
                                backgroundColor: check.is_paid ? 'rgba(107,144,128,0.08)' : 'transparent'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{
                                    width: '36px',
                                    height: '36px',
                                    borderRadius: '50%',
                                    backgroundColor: check.is_paid ? 'var(--button-primary)' : 'rgba(0,0,0,0.06)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    color: check.is_paid ? '#FFFFFF' : 'var(--text-muted)'
                                }}>
                                    {check.is_paid ? '✓' : memberName[0]}
                                </div>
                                <div>
                                    <div style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                                        {memberName}
                                        {getMemberBadge(check.user_id) && (
                                            <span style={{
                                                padding: '1px 6px',
                                                borderRadius: '4px',
                                                fontSize: '11px',
                                                fontWeight: '500',
                                                backgroundColor: 'rgba(107, 144, 128, 0.15)',
                                                color: 'var(--button-primary)',
                                            }}>
                                                {getMemberBadge(check.user_id)}
                                            </span>
                                        )}
                                        {isCurrentUser && (
                                            <span style={{
                                                marginLeft: '8px',
                                                fontSize: '12px',
                                                color: 'var(--button-primary)',
                                                fontWeight: '500'
                                            }}>
                                                (나)
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                                        {billSplit.per_person_amount.toLocaleString()}원
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={() => handleToggleCheck(check.id, check.is_paid)}
                                disabled={!isCurrentUser && !isHost}
                                style={{
                                    padding: '8px 14px',
                                    backgroundColor: check.is_paid ? 'rgba(0,0,0,0.04)' : 'var(--button-primary)',
                                    color: check.is_paid ? 'var(--text-muted)' : '#FFFFFF',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontSize: '13px',
                                    fontWeight: '600',
                                    cursor: (isCurrentUser || isHost) ? 'pointer' : 'not-allowed',
                                    opacity: (!isCurrentUser && !isHost) ? 0.5 : 1,
                                    transition: 'all 0.2s'
                                }}
                            >
                                {check.is_paid ? '완료됨' : '송금 완료'}
                            </button>
                        </div>
                    );
                })}
            </div>

            {/* 초기화 버튼 (방장만) */}
            {isHost && (
                <button
                    onClick={handleReset}
                    disabled={loading}
                    style={{
                        width: '100%',
                        marginTop: '16px',
                        padding: '12px',
                        backgroundColor: 'transparent',
                        color: 'var(--danger)',
                        border: '1px solid var(--danger)',
                        borderRadius: '10px',
                        fontSize: '14px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                    }}
                >
                    {loading ? '초기화 중...' : '정산 내역 초기화'}
                </button>
            )}
        </div>
    );
}
