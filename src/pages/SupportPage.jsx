import { useNavigate } from 'react-router-dom';

export default function SupportPage() {
  const navigate = useNavigate();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', padding: '32px 24px', textAlign: 'center' }}>
      <div style={{ fontSize: '48px', marginBottom: '20px' }}>🛠️</div>
      <h1 style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '12px' }}>
        고객센터
      </h1>
      <p style={{ fontSize: '15px', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '32px' }}>
        고객센터는 아직 준비중입니다.
      </p>
      <button
        onClick={() => navigate(-1)}
        style={{
          padding: '12px 32px',
          background: 'var(--button-primary)',
          color: '#FFFFFF',
          borderRadius: '12px',
          border: 'none',
          fontSize: '15px',
          fontWeight: '600',
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        돌아가기
      </button>
    </div>
  );
}
