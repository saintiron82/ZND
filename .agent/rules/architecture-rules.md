# Architecture & Design Philosophy Rules

## Mission
"Signal Only." (오직 신호만 남긴다.)

## Core Principles
1.  **Separation of Concerns**: 모든 작업은 관심사 분리 원칙을 엄격하게 적용해야 합니다.
2.  **Stability First**: ZND의 구조적 안정성을 최우선으로 확보합니다.

## Component Responsibilities

### Supplier (Python)
*   **Role**: 뉴스 수집, MLL 분석 요청, 데이터 정제 및 Firestore DB에 최종 저장.
*   **Rule**: **데이터 무결성** - 크롤러는 데이터 손실 없이 정확한 스키마를 준수해야 합니다.

### Web (Next.js)
*   **Role**: 독자에게 정제된 뉴스(Signal)를 제공.
*   **Rule**: **읽기 전용** - 웹 레이어는 DB에 데이터를 쓰거나, 로컬 파일 시스템(fs)에 접근할 수 없습니다. 데이터는 오직 Firestore에서만 조회합니다.

### Design Layer (Web)
*   **Role**: UI를 Frame과 Content로 분리.
*   **Rule**: **프레임 불변성** - Header, Nav 등 Frame 영역은 독립된 컴포넌트로 격리하여 Content 변경에 영향을 받지 않아야 합니다.

### Engine (MLL)
*   **Role**: 텍스트 분석, 요약, 점수 산출.
*   **Rule**: **API 계약 준수** - MLL의 JSON 스키마를 완벽히 이해하고 비용을 최소화해야 합니다.
