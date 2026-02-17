---
name: verify-auth
description: 인증 및 보안 패턴, ProtectedRoute 사용, 권한 체크를 검증합니다. 인증 로직 또는 보호된 페이지 추가 후 사용.
---

# 인증 및 보안 패턴 검증

## Purpose

이 스킬은 다음을 검증합니다:

1. **ProtectedRoute 사용** — 보호가 필요한 페이지에 ProtectedRoute가 적용되었는지 확인
2. **인증 상태 체크** — 사용자 인증 상태를 확인하는 로직이 있는지 검증
3. **AuthContext 사용** — 인증 정보가 AuthContext를 통해 관리되는지 확인
4. **비밀번호 처리** — 비밀번호 입력 필드가 적절한 type을 사용하는지 확인
5. **권한 검증** — 특정 작업 수행 전 권한을 확인하는지 검증

## When to Run

- 새로운 페이지를 추가한 후 (ProtectedRoute 필요 여부 확인)
- 인증 로직을 수정한 후
- 권한 체크 로직을 추가/수정한 후
- 로그인/회원가입 폼을 수정한 후
- Pull Request 생성 전
- 코드 리뷰 중

## Related Files

| File | Purpose |
|------|---------|
| `src/context/AuthContext.jsx` | 인증 컨텍스트 제공 |
| `src/components/ProtectedRoute.jsx` | 보호된 라우트 컴포넌트 |
| `src/components/AuthGate.jsx` | 프로필 기반 리다이렉션 |
| `src/pages/LoginPage.jsx` | 로그인/회원가입 페이지 |
| `src/pages/MyPage.jsx` | 사용자 페이지 (보호 필요) |
| `src/pages/CreateGatheringPage.jsx` | 모임 생성 페이지 (보호 필요) |
| `src/pages/GatheringDetailPage.jsx` | 모임 상세 페이지 |
| `src/pages/GatheringListPage.jsx` | 모임 목록 페이지 |
| `src/pages/ManageGatheringPage.jsx` | 모임 관리 페이지 (보호 필요) |
| `src/pages/ProfileEditPage.jsx` | 프로필 수정 페이지 (보호 필요) |
| `src/pages/NotificationsPage.jsx` | 알림 페이지 (보호 필요) |
| `src/App.jsx` | 라우트 정의 |

## Workflow

### Step 1: ProtectedRoute 사용 검증

**검사:** App.jsx에서 보호가 필요한 페이지가 ProtectedRoute로 감싸져 있는지 확인합니다.

**파일:** `src/App.jsx`

```bash
grep -A3 "<Route" src/App.jsx
```

보호가 필요한 페이지들을 확인하고, ProtectedRoute 또는 AuthGate로 감싸져 있는지 검토합니다.

**PASS 기준:**
- 인증이 필요한 페이지가 `<ProtectedRoute>` 또는 `<AuthGate>`로 감싸짐
- 공개 페이지(LoginPage 등)는 보호되지 않음

**FAIL 기준:**
- 개인정보를 다루는 페이지가 보호되지 않음
- 수정/삭제 기능이 있는 페이지가 보호되지 않음

**보호가 필요한 페이지:**
- MyPage, ProfileEditPage
- CreateGatheringPage, ManageGatheringPage
- NotificationsPage
- 기타 사용자별 데이터를 다루는 페이지

**수정 방법:**
```jsx
// ❌ 잘못된 예
<Route path="/my" element={<MyPage />} />

// ✅ 올바른 예
<Route
  path="/my"
  element={
    <ProtectedRoute>
      <MyPage />
    </ProtectedRoute>
  }
/>
```

### Step 2: useAuth 사용 검증

**검사:** 인증 상태가 필요한 컴포넌트에서 useAuth hook을 사용하는지 확인합니다.

```bash
grep -l "user\|auth" src/pages/*.jsx src/components/*.jsx | xargs grep -L "useAuth"
```

**PASS 기준:**
- 사용자 정보가 필요한 컴포넌트에서 `useAuth()` hook 사용
- user, signIn, signOut 등을 AuthContext에서 가져옴

**FAIL 기준:**
- supabase.auth.getUser()를 직접 호출 (Context 사용 권장)
- 인증 상태를 로컬에서 중복 관리

**수정 방법:**
```jsx
// ❌ 잘못된 예 (직접 호출)
const [user, setUser] = useState(null)
useEffect(() => {
  supabase.auth.getUser().then(({ data }) => setUser(data.user))
}, [])

// ✅ 올바른 예 (Context 사용)
import { useAuth } from '../context/AuthContext'

function MyComponent() {
  const { user, loading } = useAuth()
  // ...
}
```

### Step 3: 비밀번호 입력 필드 검증

**검사:** 비밀번호 입력 필드가 type="password"를 사용하는지 확인합니다.

```bash
grep -rn "password" src/ --include="*.jsx" | grep "<input" | grep -v 'type="password"'
```

**PASS 기준:**
- 비밀번호 관련 input이 `type="password"` 사용
- placeholder 또는 name에 "password"가 있으면 type도 "password"

**FAIL 기준:**
- 비밀번호 입력인데 type이 "text" 또는 미지정

**수정 방법:**
```jsx
// ❌ 잘못된 예
<input
  placeholder="비밀번호"
  value={password}
  onChange={(e) => setPassword(e.target.value)}
/>

// ✅ 올바른 예
<input
  type="password"
  placeholder="비밀번호"
  value={password}
  onChange={(e) => setPassword(e.target.value)}
/>
```

### Step 4: AuthContext Provider 검증

**검사:** App이 AuthProvider로 감싸져 있는지 확인합니다.

**파일:** `src/App.jsx`

```bash
grep -n "AuthProvider" src/App.jsx
```

**PASS 기준:**
- App 컴포넌트가 `<AuthProvider>`로 감싸짐
- AuthProvider가 최상위에 위치

**FAIL 기준:**
- AuthProvider가 없거나 잘못된 위치에 있음

**수정 방법:**
```jsx
// ❌ 잘못된 예
export default function App() {
  return (
    <Routes>
      {/* ... */}
    </Routes>
  )
}

// ✅ 올바른 예
export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* ... */}
      </Routes>
    </AuthProvider>
  )
}
```

### Step 5: 권한 체크 로직 검증

**검사:** 특정 작업(수정, 삭제 등)을 수행하기 전에 권한을 확인하는지 검토합니다.

```bash
grep -rn "isHost\|isCreator\|user\.id.*==\|creator_id" src/ --include="*.jsx" --include="*.js"
```

**PASS 기준:**
- 수정/삭제 버튼이 권한 있는 사용자에게만 표시됨
- 서버 요청 전에 권한 확인

**FAIL 기준:**
- 누구나 수정/삭제 버튼을 볼 수 있음
- 클라이언트 측 권한 확인이 없음

**수정 방법:**
```jsx
// ❌ 잘못된 예
<button onClick={deleteGathering}>삭제</button>

// ✅ 올바른 예
{isCreator && (
  <button onClick={deleteGathering}>삭제</button>
)}

// ✅ 더 나은 예 (사용자 ID 비교)
{user?.id === gathering.creator_id && (
  <button onClick={deleteGathering}>삭제</button>
)}
```

### Step 6: 로그인 후 리다이렉션 검증

**검사:** 로그인 성공 후 적절한 페이지로 이동하는지 확인합니다.

**파일:** `src/pages/LoginPage.jsx`

```bash
grep -A10 "signIn\|signUp" src/pages/LoginPage.jsx | grep -E "navigate|Navigate"
```

**PASS 기준:**
- 로그인 성공 시 메인 페이지 또는 이전 페이지로 이동
- 에러 발생 시 사용자에게 알림

**FAIL 기준:**
- 로그인 후 페이지 이동 없음
- 에러 처리가 없음

**수정 방법:**
```jsx
// ❌ 잘못된 예
const handleSubmit = async (e) => {
  e.preventDefault()
  await signIn(email, password)
  // 리다이렉션 없음
}

// ✅ 올바른 예
const handleSubmit = async (e) => {
  e.preventDefault()
  setError('')

  const { error } = await signIn(email, password)

  if (error) {
    setError(error.message)
  } else {
    navigate('/')
  }
}
```

### Step 7: 로그아웃 기능 검증

**검사:** 로그아웃 기능이 제공되고 있는지 확인합니다.

```bash
grep -rn "signOut\|로그아웃" src/ --include="*.jsx"
```

**PASS 기준:**
- 로그아웃 버튼 또는 링크가 존재
- signOut 함수 호출

**FAIL 기준:**
- 로그아웃 기능이 없음

**수정 방법:**
```jsx
// ✅ 올바른 예
import { useAuth } from '../context/AuthContext'

function Header() {
  const { user, signOut } = useAuth()

  return (
    <div>
      {user && (
        <button onClick={signOut}>로그아웃</button>
      )}
    </div>
  )
}
```

## Output Format

검증 결과는 다음 형식으로 보고합니다:

```markdown
## 인증 및 보안 패턴 검증 결과

| 페이지/컴포넌트 | 검사 항목 | 상태 | 상세 |
|----------------|----------|------|------|
| `src/App.jsx` | AuthProvider | ✅ PASS | - |
| `src/pages/MyPage.jsx` | ProtectedRoute | ✅ PASS | - |
| `src/pages/CreateGatheringPage.jsx` | ProtectedRoute | ❌ FAIL | 보호 필요 |
| `src/pages/LoginPage.jsx:40` | 비밀번호 필드 | ✅ PASS | - |
| `src/components/GatheringCard.jsx:25` | 권한 체크 | ❌ FAIL | 삭제 버튼 노출 |

**총 검사 항목:** N개
**통과:** X개
**실패:** Y개

**보안 권고사항:**
- CreateGatheringPage를 ProtectedRoute로 감싸야 합니다
- 삭제 버튼에 isCreator 체크 추가 필요
```

## Exceptions

다음은 **위반이 아닙니다**:

1. **공개 페이지** — LoginPage, 공개 모임 목록 등은 ProtectedRoute 불필요
2. **읽기 전용 페이지** — 누구나 볼 수 있는 상세 페이지 (단, 수정/삭제는 권한 체크 필요)
3. **AuthContext 내부** — AuthContext.jsx 자체는 supabase를 직접 호출하는 것이 정상
4. **AuthGate vs ProtectedRoute** — 둘 다 사용 가능, 목적에 따라 선택
   - ProtectedRoute: 로그인 안 하면 로그인 페이지로
   - AuthGate: 프로필이 없으면 프로필 설정 페이지로
5. **개발용 디버그 코드** — console.log로 user 출력 등은 개발 중 허용
6. **테스트 코드** — 테스트에서는 인증을 mock할 수 있음
