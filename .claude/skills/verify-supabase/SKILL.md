---
name: verify-supabase
description: Supabase 사용 패턴, 에러 처리, 쿼리 최적화를 검증합니다. Supabase 쿼리 추가 또는 수정 후 사용.
---

# Supabase 사용 패턴 검증

## Purpose

이 스킬은 다음을 검증합니다:

1. **에러 처리** — Supabase 쿼리 후 에러를 적절히 처리하는지 확인
2. **로딩 상태 관리** — 비동기 작업 중 로딩 상태를 관리하는지 확인
3. **안전한 클라이언트 사용** — supabase 클라이언트가 올바르게 import되고 사용되는지 확인
4. **쿼리 최적화** — 불필요한 데이터 조회를 피하고 select를 명시하는지 확인
5. **환경변수 사용** — Supabase URL과 키가 환경변수로 관리되는지 확인

## When to Run

- 새로운 Supabase 쿼리를 추가한 후
- 데이터베이스 연동 로직을 수정한 후
- 인증 관련 코드를 변경한 후
- Pull Request 생성 전
- 코드 리뷰 중

## Related Files

| File | Purpose |
|------|---------|
| `src/lib/supabase.js` | Supabase 클라이언트 초기화 |
| `src/context/AuthContext.jsx` | 인증 컨텍스트 (Supabase Auth 사용) |
| `src/components/AuthGate.jsx` | 프로필 확인 쿼리 |
| `src/components/ChatTab.jsx` | 메시지 CRUD 작업 |
| `src/components/BillSplitCalculator.jsx` | 정산 데이터 처리 |
| `src/pages/LoginPage.jsx` | 로그인/회원가입 |
| `src/pages/GatheringListPage.jsx` | 모임 목록 조회 |
| `src/pages/GatheringDetailPage.jsx` | 모임 상세 조회 |
| `src/pages/CreateGatheringPage.jsx` | 모임 생성 |
| `src/pages/ManageGatheringPage.jsx` | 모임 수정 |
| `src/pages/MyPage.jsx` | 사용자 데이터 조회 |
| `src/pages/ProfileEditPage.jsx` | 프로필 수정 |
| `src/pages/NotificationsPage.jsx` | 알림 조회 |

## Workflow

### Step 1: Supabase import 검증

**검사:** supabase 클라이언트가 올바른 경로에서 import되고 있는지 확인합니다.

```bash
grep -rn "from.*supabase" src/ --include="*.jsx" --include="*.js"
```

**PASS 기준:**
- `import { supabase } from '../lib/supabase'` 형태로 통일된 경로 사용
- 상대 경로의 깊이가 파일 위치에 맞게 정확함

**FAIL 기준:**
- 다른 경로에서 supabase를 import하거나 직접 생성
- 잘못된 상대 경로 사용

**수정 방법:**
```jsx
// ❌ 잘못된 예
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(url, key) // 직접 생성

// ✅ 올바른 예
import { supabase } from '../lib/supabase' // 통일된 클라이언트 사용
```

### Step 2: 에러 처리 검증

**검사:** Supabase 쿼리 후 error를 체크하는지 확인합니다.

```bash
grep -A5 "await supabase" src/ --include="*.jsx" --include="*.js" | grep -B5 "error"
```

모든 Supabase 비동기 호출 후 error를 확인하는지 검토합니다.

**PASS 기준:**
- `const { data, error } = await supabase...` 형태로 error 구조분해
- error가 발생했을 때 처리 로직 존재 (if (error) {...})

**FAIL 기준:**
- error를 구조분해하지 않음
- error를 확인하지 않고 data만 사용

**수정 방법:**
```jsx
// ❌ 잘못된 예
const { data } = await supabase.from('users').select('*')
console.log(data) // error 무시

// ✅ 올바른 예
const { data, error } = await supabase.from('users').select('*')
if (error) {
  console.error('Error fetching users:', error)
  setError(error.message)
  return
}
console.log(data)
```

### Step 3: 로딩 상태 관리 검증

**검사:** Supabase 쿼리를 수행하는 컴포넌트가 로딩 상태를 관리하는지 확인합니다.

```bash
grep -l "await supabase" src/ --include="*.jsx" --include="*.js" | xargs grep -L "loading\|Loading"
```

**PASS 기준:**
- Supabase 쿼리를 사용하는 컴포넌트에 loading 상태 존재
- 쿼리 전후로 loading 상태 업데이트

**FAIL 기준:**
- 비동기 작업을 수행하지만 loading 상태 관리가 없음

**수정 방법:**
```jsx
// ❌ 잘못된 예
const fetchData = async () => {
  const { data, error } = await supabase.from('items').select('*')
  setItems(data)
}

// ✅ 올바른 예
const [loading, setLoading] = useState(true)

const fetchData = async () => {
  setLoading(true)
  try {
    const { data, error } = await supabase.from('items').select('*')
    if (error) throw error
    setItems(data)
  } catch (error) {
    console.error(error)
  } finally {
    setLoading(false)
  }
}
```

### Step 4: Select 명시 검증

**검사:** Supabase 쿼리에서 select를 명시하고 있는지 확인합니다.

```bash
grep -rn "\.from(" src/ --include="*.jsx" --include="*.js" | grep -v "\.select"
```

**PASS 기준:**
- 모든 쿼리에 `.select()` 또는 `.select('columns')` 명시
- 필요한 컬럼만 select (최적화)

**FAIL 기준:**
- from() 후 select 없이 바로 다른 메소드 체이닝
- 불필요하게 모든 컬럼 조회

**수정 방법:**
```jsx
// ❌ 잘못된 예
const { data } = await supabase.from('users') // select 누락

// ✅ 올바른 예
const { data } = await supabase.from('users').select('id, name, email')

// ✅ 관계 조회 시
const { data } = await supabase
  .from('posts')
  .select('*, profiles(nickname)')
```

### Step 5: 환경변수 검증

**검사:** Supabase 설정 파일에서 환경변수를 사용하는지 확인합니다.

**파일:** `src/lib/supabase.js`

```bash
grep -n "VITE_SUPABASE" src/lib/supabase.js
```

**PASS 기준:**
- `import.meta.env.VITE_SUPABASE_URL` 사용
- `import.meta.env.VITE_SUPABASE_ANON_KEY` 사용
- URL과 키가 하드코딩되지 않음

**FAIL 기준:**
- 하드코딩된 URL 또는 키
- 환경변수를 사용하지 않음

**수정 방법:**
```js
// ❌ 잘못된 예
const supabase = createClient(
  'https://xxx.supabase.co',
  'hardcoded-key'
)

// ✅ 올바른 예
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

### Step 6: Auth 메소드 사용 검증

**검사:** 인증 관련 메소드가 올바르게 사용되고 있는지 확인합니다.

```bash
grep -rn "supabase\.auth\." src/ --include="*.jsx" --include="*.js"
```

**PASS 기준:**
- `supabase.auth.signInWithPassword()` 사용 (권장)
- `supabase.auth.signUp()` 사용
- `supabase.auth.signOut()` 사용
- `supabase.auth.getUser()` 또는 `supabase.auth.onAuthStateChange()` 사용

**FAIL 기준:**
- 더 이상 사용되지 않는 메소드 사용 (예: `signIn()` 대신 `signInWithPassword()` 권장)

**수정 방법:**
```jsx
// ⚠️ 구버전 (동작하지만 권장하지 않음)
const { user, error } = await supabase.auth.signIn({ email, password })

// ✅ 최신 권장 방식
const { data, error } = await supabase.auth.signInWithPassword({ email, password })
```

## Output Format

검증 결과는 다음 형식으로 보고합니다:

```markdown
## Supabase 사용 패턴 검증 결과

| 파일 | 검사 항목 | 상태 | 상세 |
|------|----------|------|------|
| `src/lib/supabase.js:3` | 환경변수 사용 | ✅ PASS | - |
| `src/pages/Example.jsx:20` | 에러 처리 | ❌ FAIL | error 체크 누락 |
| `src/components/List.jsx:15` | 로딩 상태 | ❌ FAIL | loading 상태 관리 없음 |
| `src/pages/Detail.jsx:30` | Select 명시 | ✅ PASS | - |

**총 검사 항목:** N개
**통과:** X개
**실패:** Y개
```

## Exceptions

다음은 **위반이 아닙니다**:

1. **Supabase 클라이언트 초기화 파일** — `src/lib/supabase.js`는 클라이언트를 직접 생성하는 파일이므로 예외
2. **간단한 조회** — 에러가 발생해도 무시해도 되는 선택적 데이터 조회 (예: 프로필 이미지)
3. **Realtime subscription** — `.on()` 또는 `.subscribe()`는 다른 패턴 사용
4. **RPC 호출** — `.rpc()` 함수는 다른 에러 처리 패턴 사용 가능
5. **Count 쿼리** — `.select('*', { count: 'exact', head: true })` 등은 select 패턴이 다름
6. **Auth state listener** — `onAuthStateChange()`는 에러 처리가 다름
7. **maybeSingle()** — 데이터가 없을 수도 있는 경우 error 체크 불필요
