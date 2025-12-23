# ZED 시스템 통합 문서

## 1. 시스템 개요

ZND (Zero Noise Daily)는 AI를 활용해 정보의 홍수 속에서 소음(Noise)을 걸러내고 가치 있는 정보(Signal)만 제공하는 뉴스 큐레이션 플랫폼입니다. 시스템은 운영을 위한 Desk 클라이언트(Python/Flask)와 서비스를 위한 Web 클라이언트(Next.js)로 구성됩니다.

---

## 2. 로컬 데이터 구조

Desk 클라이언트는 Firestore에 발행하기 전까지 모든 데이터를 로컬 파일 시스템에서 관리합니다.

### 2.1 디렉터리 구조

```
d:\ZND\desk\
├── cache\                      # 임시 및 스테이징 데이터
│   ├── YYYY-MM-DD\            # 날짜별 버킷
│   │   └── {source_id}_{hash}.json  # 개별 기사 파일
│   └── batches\               # 배치 처리 매니페스트 (자동 크롤러용)
│
├── data\                       # 발행된 회차 인덱스 (백업용)
│   └── YYYY-MM-DD\
│       └── issue_{edition_code}.json
```

### 2.2 파일 유형

| 유형 | 경로 패턴 | 설명 |
|------|-----------|------|
| **초안 기사 (Draft)** | `cache/DATE/{sid}_{hash}.json` | 원본 콘텐츠, AI 분석 결과, 스테이징 상태 저장. |
| **회차 인덱스 (Index)** | `data/DATE/issue_{code}.json` | 발행된 회차의 로컬 백업 파일. |

---

## 3. 정보 생성 로직

정보는 **수동(Manual)**과 **자동(Auto)** 두 가지 채널로 생성되며, 처리 로직은 `pipeline.py`를 공유합니다.

### 3.1 파이프라인 흐름

1.  **수집 (Extraction)**: HTML 가져오기, 텍스트/메타데이터 추출 (Playwright/HTTP).
2.  **캐싱 (Caching)**: 원본 데이터를 `cache/`에 저장 (상태: RAW).
3.  **분석 (MLL Analysis)**: AI가 요약문 작성, 영향력 점수(IS), 제로에코 점수(ZES) 산출.
4.  **스테이징 (Staging)**: 사용자 검토 후 저장 (상태: `saved: true`).

### 3.2 수동 크롤러 (`manual_crawler.py`)

-   **API 기반 동작**:
    -   `/api/extract`: 추출 실행.
    -   `/api/update_cache`: MLL 분석 결과 병합.
    -   `/api/save`: 기사를 스테이징 상태로 저장.
-   **Inspector UI**: 초안을 검토하고 편집하는 도구.

### 3.3 자동 크롤러 (`src/crawler/`)

-   **배치 처리**: `targets.json`에 정의된 대상을 순회.
-   **오케스트레이션**: `AsyncCrawler`를 사용해 여러 URL 동시 처리.
-   **로직**: 추출 -> MLL -> 스테이징(설정에 따라) 또는 Inbox(검토 대기)로 자동 분류.

---

## 4. 발행 로직

발행은 **스테이징된(Staged)** 기사들을 모아 하나의 **발행 회차(Issue)**로 만들어 Firestore에 업로드하는 과정입니다.

### 4.1 Desk Publish (`desk_publish.py`)

1.  **선택 (Selection)**: 사용자가 Desk UI에서 발행할 기사 선택 (`/api/desk/publish_selected`).
2.  **회차 생성 (Edition Creation)**:
    -   회차 코드 생성 (예: `251223_1`).
    -   Firestore에 `publications/{edition_code}` 문서 생성.
    -   **V2 구조**: 기사 데이터 전체를 회차 문서 내 `articles` 배열에 **직접 내장**.

## Environment Variables

The project uses `.env` files for configuration.
- `desk/.env`: Configuration for the Desk system (Flask).
- `web/.env.local`: Configuration for the Web interface (Next.js).

### Google Cloud Service Account Key
To access Firebase/Firestore, a Service Account Key JSON file is required.
- **Path**: `desk/zeroechodaily-serviceAccountKey.json`
- **Important**: This file contains sensitive credentials and is git-ignored. Do not commit it.
- **Environment Variable**: `FIREBASE_SERVICE_ACCOUNT_KEY` (optional, defaults to looking for the file in well-known locations)
3.  **메타 업데이트 (Meta Update)**:
    -   `publications/_meta` 업데이트 (회차 목록, 최신 버전 정보).
    -   `publications/_article_ids` 업데이트 (전역 중복 체크용 인덱스).
4.  **로컬 확정 (Local Finalization)**:
    -   로컬 캐시 파일 업데이트: `status: PUBLISHED`, `published: true`.
    -   로컬 인덱스 저장: `data/DATE/issue_{code}.json`.

---

## 5. 데이터 포맷

### 5.1 기사 스키마 (JSON)

```json
{
  "article_id": "12자리_MD5해시",
  "url": "https://...",
  "source_id": "techcrunch",
  "title": "원본 제목",
  "title_ko": "한글 제목",
  "summary": "AI가 생성한 요약문...",
  "text": "본문 전체 텍스트...",
  "published_at": "ISO8601형식_날짜",
  "crawled_at": "ISO8601형식_날짜",
  
  // 점수 (Scoring)
  "zero_echo_score": 8.5,  // 높을수록 좋음 (Low Noise)
  "impact_score": 7.2,     // 높을수록 영향력 큼
  
  // 상태 플래그
  "status": "PUBLISHED", // RAW, ANALYZED, ACCEPTED, PUBLISHED, TRASH
  "saved": true,       // 스테이징 여부
  "published": true    // 발행 여부
}
```

### 5.2 Firestore 스키마 (읽기 최적화)

상세 내용은 [docs/FIRESTORE_STRUCTURE.md](file:///d:/ZND/docs/FIRESTORE_STRUCTURE.md)를 참조하세요.

```json
// publications/{edition_code}
{
  "edition_code": "251223_1",
  "articles": [ { ...내장된 기사 데이터... } ]
}
```

---

## 6. 핵심 원칙

1.  **로컬 우선 편집 (Local-First Editing)**: 모든 콘텐츠 수정은 `cache/`의 로컬 JSON 파일에서 이루어집니다.
2.  **읽기 전용 웹 (Read-Only Web)**: 웹 클라이언트는 Firestore의 `_meta`와 회차 문서만 읽으며, 쓰기 권한은 없습니다.
3.  **경량화 체크**: 버전 확인과 중복 체크는 최적화된 `_meta`와 `_article_ids` 문서(1 Read)만 사용합니다.
