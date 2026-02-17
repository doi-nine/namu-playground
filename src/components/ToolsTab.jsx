import { useState } from 'react';
import RandomDrawer from './RandomDrawer';
import BillSplitCalculator from './BillSplitCalculator';

export default function ToolsTab({ gatheringId, memberStatus, isCreator, currentMembers, members, currentUserId }) {
    const [activeTool, setActiveTool] = useState(null);

    const canUseTool = memberStatus === 'approved' || isCreator;

    if (!canUseTool) {
        return (
            <div style={{
                padding: '48px 24px',
                textAlign: 'center',
                color: 'var(--text-muted)'
            }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🛠️</div>
                <div style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px', color: 'var(--text-primary)' }}>
                    참가 후 도구를 사용하세요!
                </div>
                <div style={{ fontSize: '14px' }}>
                    모임에 참가 승인을 받으면 도구를 사용할 수 있습니다.
                </div>
            </div>
        );
    }

    const approvedMembers = members.filter(m => m.status === 'approved');

    if (activeTool === 'random') {
        return (
            <div>
                <button
                    onClick={() => setActiveTool(null)}
                    style={{
                        padding: '8px 16px',
                        background: 'rgba(255,255,255,0.5)',
                        color: 'var(--text-secondary)',
                        border: '1px solid rgba(0,0,0,0.06)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        marginBottom: '16px',
                        fontSize: '14px',
                        fontWeight: '500'
                    }}
                >
                    ← 도구 목록으로
                </button>
                <RandomDrawer
                    gatheringId={gatheringId}
                    members={members}
                    isCreator={isCreator}
                />
            </div>
        );
    }

    if (activeTool === 'bill') {
        return (
            <div>
                <button
                    onClick={() => setActiveTool(null)}
                    style={{
                        padding: '8px 16px',
                        background: 'rgba(255,255,255,0.5)',
                        color: 'var(--text-secondary)',
                        border: '1px solid rgba(0,0,0,0.06)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        marginBottom: '16px',
                        fontSize: '14px',
                        fontWeight: '500'
                    }}
                >
                    ← 도구 목록으로
                </button>
                <BillSplitCalculator
                    gatheringId={gatheringId}
                    isHost={isCreator}
                    approvedMembers={approvedMembers}
                    currentUserId={currentUserId}
                />
            </div>
        );
    }

    return (
        <div style={{ padding: '24px 0' }}>
            <h3 style={{
                fontSize: '18px',
                fontWeight: '600',
                color: 'var(--text-primary)',
                marginBottom: '20px'
            }}>
                게임 도구
            </h3>

            <div style={{
                display: 'grid',
                gap: '12px'
            }}>
                {/* 랜덤 추첨기 */}
                <div
                    onClick={() => setActiveTool('random')}
                    className="glass-strong"
                    style={{
                        padding: '20px',
                        borderRadius: '14px',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.08)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = 'none';
                    }}
                >
                    <div style={{ fontSize: '32px', marginBottom: '10px' }}>🎲</div>
                    <div style={{
                        fontSize: '16px',
                        fontWeight: '600',
                        color: 'var(--text-primary)',
                        marginBottom: '6px'
                    }}>
                        랜덤 추첨기
                    </div>
                    <div style={{
                        fontSize: '13px',
                        color: 'var(--text-muted)'
                    }}>
                        역할을 랜덤으로 배정합니다 (마피아, 라이어, 팀나누기 등)
                    </div>
                </div>

                {/* 정산 계산기 */}
                <div
                    onClick={() => setActiveTool('bill')}
                    className="glass-strong"
                    style={{
                        padding: '20px',
                        borderRadius: '14px',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.08)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = 'none';
                    }}
                >
                    <div style={{ fontSize: '32px', marginBottom: '10px' }}>💰</div>
                    <div style={{
                        fontSize: '16px',
                        fontWeight: '600',
                        color: 'var(--text-primary)',
                        marginBottom: '6px'
                    }}>
                        정산 계산기
                    </div>
                    <div style={{
                        fontSize: '13px',
                        color: 'var(--text-muted)'
                    }}>
                        N빵 계산 및 송금 완료 체크
                    </div>
                </div>
            </div>
        </div>
    );
}
