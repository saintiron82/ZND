---
trigger: always_on
---

# Data & Quality Rules

## Core Data Schema (articles collection)
| Field Name | Type | Key Constraint |
| :--- | :--- | :--- |
| id | String | Firestore Document ID. |
| title_ko | String | 한국어로 번역/생성된 제목. |
| summary | String | MLL이 요약한 핵심 내용. |
| score | Number | 기사 가치 점수 (0~10). **4점 미만은 Noise로 간주하여 폐기됨.** |
| layout_type | String | UI 배치 힌트 (Hero, Featured, Standard). |
| url | String | 원본 기사 링크. |
| tags | Array | 관련 태그 목록 (예: ["AI", "Tech"]). |
| crawled_at | Timestamp | 수집 시각. (클라이언트 전달 시 직렬화 필수) |

## Quality Principles
*   **Noise Filtering**: score 4점 미만 기사는 웹 서비스에 노출되거나 저장되지 않습니다.
*   **Duplicate Prevention**: 크롤러는 visited_urls를 통해 중복 URL의 재분석을 철저히 방지해야 합니다.
