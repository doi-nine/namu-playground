---
name: verify-imports
description: import 순서, 경로 일관성, 사용하지 않는 import를 검증합니다. 파일 추가 또는 import 구조 변경 후 사용.
---

# Import 구조 검증

## Purpose

이 스킬은 다음을 검증합니다:

1. **Import 순서** — 외부 라이브러리, 내부 모듈, 스타일 순으로 정렬되었는지 확인
2. **경로 일관성** — 상대 경로가 일관되게 사용되고 있는지 확인
3. **사용하지 않는 Import** — import했지만 사용하지 않는 모듈이 있는지 확인
4. **명명된 Import** — 구조분해가 올바르게 사용되고 있는지 확인
5. **중복 Import** — 같은 모듈을 여러 번 import하지 않는지 확인

## When to Run

- 새로운 파일을 생성한 후
- import 구조를 변경한 후
- 리팩토링 후
- Pull Request 생성 전
- 코드 리뷰 중

## Related Files

| File | Purpose |
|------|---------|
| `src/App.jsx` | 메인 앱 컴포넌트 |
| `src/main.jsx` | 앱 진입점 |
| `src/components/*.jsx` | 모든 컴포넌트 파일 |
| `src/pages/*.jsx` | 모든 페이지 파일 |
| `src/context/AuthContext.jsx` | 컨텍스트 파일 |
| `src/lib/supabase.js` | 라이브러리 설정 |

## Workflow

### Step 1: Import 순서 검증

**검사:** import 문이 다음 순서로 정렬되어 있는지 확인합니다:
1. React 및 외부 라이브러리
2. 내부 컴포넌트 및 모듈
3. 스타일 또는 에셋

```bash
find src -name "*.jsx" -o -name "*.js" | head -10 | xargs -I {} sh -c 'echo "=== {} ===" && head -20 {}'
```

각 파일의 import 섹션을 확인합니다.

**PASS 기준:**
- React import가 최상단
- 외부 라이브러리 (react-router-dom, @supabase 등) 그 다음
- 내부 모듈 (../lib, ../context, ../components) 마지막
- 그룹 간 빈 줄로 구분 (권장)

**FAIL 기준:**
- 순서가 뒤섞여 있음
- React import가 하단에 위치

**수정 방법:**
```jsx
// ❌ 잘못된 예 (순서 뒤섞임)
import { supabase } from '../lib/supabase'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

// ✅ 올바른 예 (순서 정렬)
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// ✅ 더 나은 예 (그룹 구분)
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
```

### Step 2: 상대 경로 일관성 검증

**검사:** 상대 경로가 파일 위치에 맞게 올바르게 사용되고 있는지 확인합니다.

```bash
grep -rn "from ['\"]\.\./" src/ --include="*.jsx" --include="*.js"
```

**PASS 기준:**
- 상대 경로의 깊이가 파일 위치에 정확히 일치
- 예: `src/pages/LoginPage.jsx`에서 `../context/AuthContext` (한 단계 위)
- 예: `src/components/AuthGate.jsx`에서 `../lib/supabase` (한 단계 위)

**FAIL 기준:**
- 불필요하게 깊은 경로 (예: `../../src/lib/supabase`)
- 잘못된 경로 (파일이 존재하지 않는 경로)

**수정 방법:**
```jsx
// 파일 위치: src/pages/LoginPage.jsx

// ❌ 잘못된 예
import { useAuth } from '../../src/context/AuthContext' // 불필요하게 깊음

// ✅ 올바른 예
import { useAuth } from '../context/AuthContext' // 한 단계 위
```

### Step 3: 중복 Import 검증

**검사:** 같은 모듈을 여러 번 import하지 않는지 확인합니다.

각 파일에서 import 문을 분석하여 중복을 찾습니다.

**PASS 기준:**
- 각 모듈을 한 번만 import
- 같은 모듈의 여러 export를 하나의 import 문으로 통합

**FAIL 기준:**
- 같은 모듈을 여러 줄에서 import

**수정 방법:**
```jsx
// ❌ 잘못된 예 (중복 import)
import { useState } from 'react'
import { useEffect } from 'react'
import { useRef } from 'react'

// ✅ 올바른 예 (통합)
import { useState, useEffect, useRef } from 'react'
```

### Step 4: 파일 확장자 일관성 검증

**검사:** import 경로에 파일 확장자가 일관되게 사용되고 있는지 확인합니다.

```bash
grep -rn "from ['\"]\.\..*\.jsx" src/ --include="*.jsx" --include="*.js"
```

**PASS 기준:**
- 확장자를 생략하거나 일관되게 사용
- 프로젝트 전반에 동일한 패턴 적용

**FAIL 기준:**
- 어떤 파일은 확장자 포함, 어떤 파일은 생략 (비일관성)

**이 프로젝트의 권장 방식:**
- 확장자 생략 (Vite가 자동으로 해석)

**수정 방법:**
```jsx
// ⚠️ 동작하지만 비일관적
import AuthGate from './components/AuthGate.jsx'
import ChatTab from './components/ChatTab'

// ✅ 일관된 방식 (확장자 생략)
import AuthGate from './components/AuthGate'
import ChatTab from './components/ChatTab'
```

### Step 5: Default vs Named Import 검증

**검사:** default export와 named export가 올바르게 import되고 있는지 확인합니다.

```bash
grep -rn "^export default function" src/ --include="*.jsx" | cut -d: -f1 | while read file; do
  basename=$(basename "$file" .jsx)
  grep "import.*from.*$(dirname $file | sed 's|src/||')" src/ 2>/dev/null | grep -v "{ $basename }"
done
```

**PASS 기준:**
- default export는 `import Component from './Component'` 형태
- named export는 `import { something } from './module'` 형태

**FAIL 기준:**
- default export를 `{ Component }` 형태로 import
- named export를 default import로 사용

**수정 방법:**
```jsx
// 파일: src/components/AuthGate.jsx
export default function AuthGate() { ... }

// ❌ 잘못된 예
import { AuthGate } from './components/AuthGate' // default인데 named로 import

// ✅ 올바른 예
import AuthGate from './components/AuthGate' // default import
```

```jsx
// 파일: src/lib/supabase.js
export const supabase = createClient(...)

// ❌ 잘못된 예
import supabase from '../lib/supabase' // named인데 default로 import

// ✅ 올바른 예
import { supabase } from '../lib/supabase' // named import
```

### Step 6: React Import 최적화 검증

**검사:** React 17+ 환경에서 불필요한 React import가 있는지 확인합니다.

```bash
grep -rn "^import React from 'react'" src/ --include="*.jsx" --include="*.js"
```

**PASS 기준:**
- JSX만 사용하는 파일은 React import 불필요 (Vite가 자동 처리)
- React.memo, React.forwardRef 등 직접 사용 시에만 import

**FAIL 기준:**
- JSX만 쓰는데 `import React from 'react'` 포함

**이 프로젝트의 권장 방식:**
- 필요한 hooks만 명시적으로 import
- React는 특별한 경우가 아니면 import하지 않음

**수정 방법:**
```jsx
// ❌ 불필요한 예 (React 17+ 환경)
import React from 'react'
import { useState } from 'react'

export default function MyComponent() {
  const [value, setValue] = useState(0)
  return <div>{value}</div>
}

// ✅ 올바른 예
import { useState } from 'react'

export default function MyComponent() {
  const [value, setValue] = useState(0)
  return <div>{value}</div>
}
```

### Step 7: ESLint no-unused-vars 검증

**검사:** import했지만 사용하지 않는 변수가 있는지 확인합니다.

```bash
npm run lint 2>&1 | grep "is defined but never used"
```

**PASS 기준:**
- 모든 import된 모듈이 코드에서 사용됨
- ESLint 경고 없음

**FAIL 기준:**
- import했지만 사용하지 않는 모듈 존재

**수정 방법:**
```jsx
// ❌ 잘못된 예
import { useState, useEffect, useRef } from 'react' // useRef 미사용

export default function MyComponent() {
  const [value, setValue] = useState(0)
  // useRef는 사용하지 않음
  return <div>{value}</div>
}

// ✅ 올바른 예 (사용하지 않는 import 제거)
import { useState } from 'react'

export default function MyComponent() {
  const [value, setValue] = useState(0)
  return <div>{value}</div>
}
```

## Output Format

검증 결과는 다음 형식으로 보고합니다:

```markdown
## Import 구조 검증 결과

| 파일 | 검사 항목 | 상태 | 상세 |
|------|----------|------|------|
| `src/pages/LoginPage.jsx` | Import 순서 | ✅ PASS | - |
| `src/components/AuthGate.jsx` | 경로 일관성 | ✅ PASS | - |
| `src/pages/MyPage.jsx:3` | 중복 import | ❌ FAIL | react를 2번 import |
| `src/components/ChatTab.jsx:5` | 사용하지 않는 import | ❌ FAIL | useCallback 미사용 |

**총 검사 항목:** N개
**통과:** X개
**실패:** Y개

**최적화 권장사항:**
- MyPage.jsx의 중복 import 통합 필요
- ChatTab.jsx의 useCallback import 제거 가능
```

## Exceptions

다음은 **위반이 아닙니다**:

1. **타입 import** — TypeScript 사용 시 `import type { ... }` 패턴은 별도 처리
2. **동적 import** — `import()` 함수를 사용한 코드 스플리팅
3. **사이드 이펙트 import** — `import './styles.css'` 같은 스타일 import
4. **개발 전용 import** — 개발 중 디버깅을 위한 일시적 import
5. **조건부 사용** — 조건문 내에서만 사용하는 import (ESLint가 오탐할 수 있음)
6. **설정 파일** — `vite.config.js`, `eslint.config.js` 등은 다른 import 패턴 사용
7. **Re-export** — barrel export 파일 (`index.js`)은 import만 하고 직접 사용 안 함
