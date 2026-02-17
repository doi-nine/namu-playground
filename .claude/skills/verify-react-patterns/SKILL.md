---
name: verify-react-patterns
description: React 컴포넌트 구조, hooks 사용 패턴, 명명 규칙을 검증합니다. 새 컴포넌트 추가 또는 React 코드 수정 후 사용.
---

# React 패턴 검증

## Purpose

이 스킬은 다음을 검증합니다:

1. **컴포넌트 명명 규칙** — 컴포넌트 함수명이 파일명과 일치하고 PascalCase를 사용하는지 확인
2. **Hooks 사용 패턴** — useState, useEffect 등이 올바르게 사용되고 있는지 확인
3. **의존성 배열** — useEffect의 의존성 배열이 누락되지 않았는지 확인
4. **Export 패턴** — default export가 올바르게 사용되고 있는지 확인
5. **Props 구조분해** — props가 일관되게 구조분해되고 있는지 확인

## When to Run

- 새로운 React 컴포넌트를 추가한 후
- 기존 컴포넌트의 hooks 로직을 수정한 후
- 컴포넌트 리팩토링 후
- Pull Request 생성 전
- 코드 리뷰 중

## Related Files

| File | Purpose |
|------|---------|
| `src/components/AuthGate.jsx` | 인증 게이트 컴포넌트 |
| `src/components/ProtectedRoute.jsx` | 보호된 라우트 컴포넌트 |
| `src/components/ChatTab.jsx` | 채팅 탭 컴포넌트 |
| `src/components/BillSplitCalculator.jsx` | 정산 계산기 컴포넌트 |
| `src/components/RandomDrawer.jsx` | 랜덤 추첨 컴포넌트 |
| `src/components/RightSidebar.jsx` | 우측 사이드바 컴포넌트 |
| `src/components/ToolsTab.jsx` | 도구 탭 컴포넌트 |
| `src/context/AuthContext.jsx` | 인증 컨텍스트 |
| `src/pages/LoginPage.jsx` | 로그인 페이지 |
| `src/pages/MyPage.jsx` | 마이 페이지 |
| `src/pages/CreateGatheringPage.jsx` | 모임 생성 페이지 |
| `src/pages/GatheringDetailPage.jsx` | 모임 상세 페이지 |
| `src/pages/GatheringListPage.jsx` | 모임 목록 페이지 |
| `src/pages/ManageGatheringPage.jsx` | 모임 관리 페이지 |
| `src/pages/NotificationsPage.jsx` | 알림 페이지 |
| `src/pages/ProfilePage.jsx` | 프로필 페이지 |
| `src/pages/ProfileEditPage.jsx` | 프로필 수정 페이지 |
| `src/pages/AIRecommendPage.jsx` | AI 추천 페이지 |
| `src/App.jsx` | 앱 루트 컴포넌트 |

## Workflow

### Step 1: 컴포넌트 명명 규칙 검증

**검사:** 모든 컴포넌트 파일에서 default export 함수명이 PascalCase를 사용하고 파일명과 일치하는지 확인합니다.

```bash
grep -rn "^export default function" src/ --include="*.jsx" --include="*.js"
```

**PASS 기준:**
- 함수명이 PascalCase (예: `LoginPage`, `AuthGate`)
- 함수명이 파일명과 일치 (예: `LoginPage.jsx` → `function LoginPage`)

**FAIL 기준:**
- camelCase 함수명 (예: `loginPage`)
- 함수명과 파일명 불일치

**수정 방법:**
```jsx
// ❌ 잘못된 예
export default function loginPage() { ... }

// ✅ 올바른 예
export default function LoginPage() { ... }
```

### Step 2: useState 초기값 검증

**검사:** useState가 적절한 초기값과 함께 사용되는지 확인합니다.

```bash
grep -rn "useState()" src/ --include="*.jsx" --include="*.js"
```

**PASS 기준:**
- useState에 초기값이 명시적으로 제공됨

**FAIL 기준:**
- `useState()` 처럼 초기값 없이 호출

**수정 방법:**
```jsx
// ❌ 잘못된 예
const [value, setValue] = useState()

// ✅ 올바른 예
const [value, setValue] = useState(null)
const [items, setItems] = useState([])
const [loading, setLoading] = useState(false)
```

### Step 3: useEffect 의존성 배열 검증

**검사:** useEffect가 의존성 배열 없이 사용되는 케이스를 찾습니다.

```bash
grep -B2 "useEffect\(" src/ --include="*.jsx" --include="*.js" | grep -v "\[\]" | grep -v "\[.*\]"
```

**PASS 기준:**
- 모든 useEffect가 의존성 배열을 가짐 (빈 배열 `[]` 포함)

**FAIL 기준:**
- useEffect에 의존성 배열이 없음

**수정 방법:**
```jsx
// ❌ 잘못된 예 (의존성 배열 누락)
useEffect(() => {
  fetchData()
})

// ✅ 올바른 예
useEffect(() => {
  fetchData()
}, []) // 컴포넌트 마운트 시에만 실행

useEffect(() => {
  fetchData(id)
}, [id]) // id 변경 시 실행
```

### Step 4: React import 검증

**검사:** 필요한 hooks를 import하고 있는지 확인합니다.

```bash
grep -rn "useState\|useEffect\|useContext\|useRef" src/ --include="*.jsx" --include="*.js"
```

각 파일에서 사용된 hook이 파일 상단에서 import되고 있는지 확인합니다.

**PASS 기준:**
- 사용된 모든 hooks가 'react'에서 import됨

**FAIL 기준:**
- hook 사용은 있으나 import가 없음

**수정 방법:**
```jsx
// ❌ 잘못된 예
import { useState } from 'react'
// ...하지만 useEffect도 사용

// ✅ 올바른 예
import { useState, useEffect } from 'react'
```

### Step 5: Props 구조분해 일관성 검증

**검사:** 컴포넌트 props가 일관되게 구조분해되고 있는지 확인합니다.

```bash
grep -rn "^export default function.*{.*}" src/ --include="*.jsx" --include="*.js"
```

**PASS 기준:**
- props를 받는 컴포넌트는 구조분해 사용
- props가 없는 컴포넌트는 매개변수 없음

**FAIL 기준:**
- `function MyComponent(props)` 형태로 구조분해 없이 사용

**수정 방법:**
```jsx
// ❌ 잘못된 예
export default function MyComponent(props) {
  return <div>{props.title}</div>
}

// ✅ 올바른 예
export default function MyComponent({ title }) {
  return <div>{title}</div>
}
```

## Output Format

검증 결과는 다음 형식으로 보고합니다:

```markdown
## React 패턴 검증 결과

| 파일 | 검사 항목 | 상태 | 상세 |
|------|----------|------|------|
| `src/pages/Example.jsx:10` | 컴포넌트 명명 | ✅ PASS | - |
| `src/components/Widget.jsx:5` | useState 초기값 | ❌ FAIL | 초기값 누락 |
| `src/components/Form.jsx:15` | useEffect 의존성 | ❌ FAIL | 의존성 배열 누락 |

**총 검사 항목:** N개
**통과:** X개
**실패:** Y개
```

## Exceptions

다음은 **위반이 아닙니다**:

1. **테스트 파일** — `*.test.jsx`, `*.spec.jsx` 파일은 다른 패턴 사용 가능
2. **설정 파일** — `vite.config.js`, `eslint.config.js` 등은 React 컴포넌트가 아님
3. **유틸리티 함수** — `src/lib/` 또는 `src/utils/`의 파일은 React 컴포넌트가 아닐 수 있음
4. **의도적인 빈 의존성 배열** — `useEffect(() => {...}, [])` 는 마운트 시에만 실행하려는 의도
5. **Context Provider 컴포넌트** — Context를 제공하는 컴포넌트는 특별한 패턴 사용 가능
6. **HOC (Higher-Order Components)** — HOC는 다른 명명 규칙 사용 가능 (예: `withAuth`)
