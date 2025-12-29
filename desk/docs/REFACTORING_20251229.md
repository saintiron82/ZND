# Desk 리팩토링 계획 20251229

> **분석일**: 2025-12-29
> **대상**: `d:/ZND/desk/` 폴더 전체
> **문서 목적**: 코드 분석 결과 및 리팩토링 계획 영구 보존

---

## 1. 전체 구조 요약

```
desk/
├── app.py                 # Flask 진입점
├── src/
│   ├── core_logic.py      # 🔴 1,005줄 (분리 필요)
│   ├── db_client.py       # 🔴 1,030줄 (중복, 통합 필요)
│   ├── score_engine.py    # 🔴 122줄 (중복 파일)
│   ├── pipeline.py        # 426줄
│   ├── mll_client.py      # 180줄
│   ├── api/               # API 라우트
│   ├── core/              # ⭐ 신규 구조
│   │   ├── article_manager.py   # 791줄
│   │   ├── article_registry.py  # 595줄
│   │   ├── firestore_client.py  # 651줄
│   │   ├── db_gateway.py        # 253줄
│   │   └── score_engine.py      # 269줄 (정식 버전)
│   └── crawler/
├── static/js/
│   └── desk.js            # 🔴 2,609줄 (분리 필요)
└── [레거시 스크립트 10개+]
```

---

## 2. 발견된 핵심 문제점

### 2.1 심각 (Critical)

| 문제 | 파일 | 설명 |
|------|------|------|
| **DB 클라이언트 3중 구조** | `db_client.py`, `firestore_client.py`, `db_gateway.py` | 동일 목적의 클래스 3개 병존 |
| **score_engine.py 이중 파일** | `src/score_engine.py`, `src/core/score_engine.py` | 동일 이름, 다른 기능 범위 |

### 2.2 경고 (Warning)

| 문제 | 파일 | 설명 |
|------|------|------|
| **ArticleManager vs ArticleRegistry** | 두 클래스 | 유사한 역할, API마다 다르게 사용 |
| **core_logic.py 거대화** | 1,005줄 | 과도한 책임 (캐시, 해시, 정규화, 매니페스트) |
| **desk.js 거대화** | 2,609줄 | 모든 페이지 로직 단일 파일, 함수 중복 정의 |

### 2.3 정보 (Info)

| 문제 | 설명 |
|------|------|
| 루트 레벨 스크립트 | 10개+ 일회성/테스트 스크립트 |
| desk_crawler.py | pipeline.py와 역할 중복 가능 |

---

## 3. desk.js 상세 분석

| 섹션 | 줄 범위 | 기능 |
|------|---------|------|
| Common Functions | 1-131 | 공통 유틸리티 |
| Analyzer Page | 132-260 | AI 분석 페이지 |
| Publisher Page | 261-417 | 발행 페이지 |
| **Board Page** | 418-852 | 칸반 보드 (최대) |
| Orphan Recovery | 853-907 | 고아 기사 복구 |
| Column Menu | 908-967 | ⚠️ 함수 중복! |
| Settings Popup | 968-1310 | 설정 + CSS 인라인 125줄 |
| Collection Progress | 1317-1621 | 수집 프로그래스바 |
| Raw Viewer | 1623-1834 | JSON 뷰어 |
| **Classification** | 1835-2609 | 분류 모달 (2번째로 큼) |

**함수 중복**: `toggleColumnMenu()`, `columnAction()` 각각 2번 정의됨

---

## 4. 리팩토링 계획

### Phase 1: 레거시 스크립트 정리 (위험도: ⭐)
- [x] **삭제 대상**:
  - [x] `calc_user_score.py`
  - [x] `check_cache_states.py`
  - [x] `check_db.py`
  - [x] `compare_logic.py`
  - [x] `debug_path.py`
  - [x] `diagnose_sync.py`
  - [x] `repro_score.py`
  - [x] `test_recover.py`
  - [x] `verify_manager.py`

- [x] **보존 대상**: `migrate_cache.py`, `recover_orphans.py`

---

### Phase 2: score_engine.py 통합 (위험도: ⭐⭐)

- [x] `src/score_engine.py` (122줄) 삭제
- [x] `src/core/score_engine.py` (269줄) 확인 및 유지
- [x] `pipeline.py`의 import 경로 수정 (`src.score_engine` -> `src.core.score_engine`)

```diff
# 삭제
- src/score_engine.py (122줄)

# 유지
+ src/core/score_engine.py (269줄)

# pipeline.py 수정
- from src.score_engine import process_raw_analysis
+ from src.core.score_engine import process_raw_analysis
```

---

### Phase 3: DB 클라이언트 단일화 (위험도: ⭐⭐⭐)

**현재**: DBClient- [x] `src/db_client.py`의 히스토리/저장 로직을 `src/core/firestore_client.py`로 이식
- [x] `pipeline.py`의 `DBClient` 의존성 제거 및 `FirestoreClient` 연결
- [x] `src/db_client.py` 삭제
- [x] `desk_crawler.py` 등 다른 진입점의 `db_client` import 확인 및 제거] 3. DBClient deprecated 표시 후 관찰
- [ ] 4. (안정화 후) DBClient 삭제

---

### Phase 4: core_logic.py 분리 (위험도: ⭐⭐⭐)

**현재**: 1,005줄 단일 파일
**목표**:

```
src/utils/
├── __init__.py
├── url_utils.py        # URL 해시, 정규화
├── cache_manager.py    # 캐시 CRUD
├── field_normalizer.py # 필드 정규화
└── manifest.py         # 매니페스트 관리
```

- [ ] `src/utils/` 디렉토리 및 파일 생성
- [ ] `url_utils.py` 구현
- [ ] `cache_manager.py` 로직 이동
- [ ] `field_normalizer.py` 로직 이동
- [ ] `manifest.py` 로직 이동
- [ ] `core_logic.py`에서 분리된 모듈 import 하도록 수정

---

### Phase 5: desk.js 모듈화 (위험도: ⭐⭐)

**현재**: 2,609줄 단일 파일
**목표**:

```
static/js/
├── common.js
├── analyzer.js
├── publisher.js
├── board.js
├── classification.js
├── settings.js
└── index.js
```

추가 작업:
- [ ] 중복 함수 제거
- [ ] 인라인 CSS를 별도 파일로 분리
- [ ] 전역 변수 캡슐화

---

## 5. 권장 진행 순서

1→2→5→3→4 (위험도 낮은 것부터)

---

## 6. 파일 크기 현황

| 파일 | 줄 수 | 상태 |
|------|-------|------|
| desk.js | 2,609 | 🔴 분리 필요 |
| db_client.py | 1,030 | 🔴 통합 필요 |
| core_logic.py | 1,005 | 🔴 분리 필요 |
| article_manager.py | 791 | 🟠 크지만 허용 |
| board.py | 735 | 🟠 크지만 허용 |
| firestore_client.py | 651 | 🟡 적정 |
| article_registry.py | 595 | 🟡 적정 |
