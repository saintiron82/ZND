---
trigger: always_on
---

# Coding & Execution Rules

## Type Safety
*   **No Any**: any 타입 사용을 지양합니다.
*   **Interfaces**: 컴포넌트 Props 및 데이터 구조에 대한 명시적인 TypeScript interface 정의를 필수로 합니다.

## API Optimization
*   **Firestore Query**: Web API(route.ts)는 Firestore에서 최신 기사만 orderBy('crawled_at', 'desc')로 가져옵니다.
*   **Efficient Mapping**: 필요한 데이터만 매핑하여 반환해야 합니다.

## Graceful Degradation
*   **Error Handling**: MLL API 지연(5초+)이나 DB 오류 시, 서버 로그에 기록하고 사용자에게는 부드러운 메시지를 제공합니다.

## Styling
*   **Stack**: Tailwind CSS v4와 다크 모드 지원을 기본으로 합니다.

## 인코딩 
  무조건 UTF-8로 해야 한다.
