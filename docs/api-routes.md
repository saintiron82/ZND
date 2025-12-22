# API Routes 구조 문서

> 마지막 업데이트: 2024-12-21

## 📁 모듈 구조

```
desk/
├── manual_crawler.py          # Flask 앱 엔트리 포인트 (~55줄)
└── src/
    └── routes/                # Flask Blueprint 모듈
        ├── __init__.py        # Blueprint export
        ├── automation.py      # 자동화 파이프라인 API
        ├── desk.py            # 조판(Desk) API - 기사 관리
        ├── desk_publish.py    # 발행 API - 기사 발행, 캐시 동기화
        ├── desk_schedule.py   # 스케줄 API - 자동 크롤링 스케줄
        ├── publications.py    # 발행 관리 API
        ├── batch.py           # 배치 처리 API
        ├── crawler.py         # 크롤링/추출 API
        └── cleanup.py         # 데이터 정리 API
```

---

## 🔗 전체 라우트 목록

### 1. Automation API (`routes/automation.py`)

| Method | Route | 함수 | 설명 |
|--------|-------|------|------|
| POST | `/api/automation/collect` | `automation_collect` | 타겟에서 새 링크 수집 |
| POST | `/api/automation/extract` | `automation_extract` | 수집된 링크 콘텐츠 추출 |
| POST | `/api/automation/analyze` | `automation_analyze` | MLL 분석 실행 |
| POST | `/api/automation/stage` | `automation_stage` | 조판 처리 (점수 재검증) |
| POST | `/api/automation/publish` | `automation_publish` | 발행 (data/ 폴더 생성) |
| POST | `/api/automation/all` | `automation_all` | 1~4단계 연속 실행 |
| POST | `/api/desk/recalculate` | `automation_stage_recalc` | 점수 재계산 |

---

### 2. Desk API (`routes/desk.py`)

| Method | Route | 함수 | 설명 |
|--------|-------|------|------|
| GET | `/`, `/desk` | `desk_view` | 조판 UI 페이지 |
| GET | `/api/desk/list` | `desk_list` | 분석된 기사 목록 |
| GET | `/api/desk/file` | `desk_file` | 기사 상세 조회 |
| POST | `/api/desk/reject_selected` | `desk_reject_selected` | 선택 기사 거부 |
| POST | `/api/desk/restore_selected` | `desk_restore_selected` | 거부 기사 복구 |
| POST | `/api/desk/update_categories` | `desk_update_categories` | 카테고리 업데이트 |
| POST | `/api/desk/reset_dedup` | `desk_reset_dedup` | 중복 상태 초기화 |
| POST | `/api/desk/delete_file` | `desk_delete_file` | 파일 삭제 |
| POST | `/api/desk/clear_cache` | `desk_clear_cache` | 날짜별 캐시 삭제 |
| POST | `/api/desk/publish_selected` | `desk_publish_selected` | 선택 기사 발행 |

---

### 3. Publications API (`routes/publications.py`)

| Method | Route | 함수 | 설명 |
|--------|-------|------|------|
| GET | `/api/publications/list` | `publications_list` | 발행 회차 목록 |
| GET | `/api/publications/view` | `publications_view` | 회차 상세 기사 목록 |
| POST | `/api/publications/release` | `publications_release` | Preview→Released |
| POST | `/api/publications/move_articles` | `publications_move_articles` | 기사 이동 (미구현) |
| POST | `/api/desk/delete_from_db` | `publications_delete_from_db` | Firestore에서 삭제 |
| POST | `/api/desk/unpublish_selected` | `publications_unpublish_selected` | 발행 취소 |

---

### 4. Batch API (`routes/batch.py`)

| Method | Route | 함수 | 설명 |
|--------|-------|------|------|
| GET | `/api/batch/list_ready` | `list_ready_batches` | 대기 배치 목록 |
| GET | `/api/batch/get_content` | `get_batch_content` | 배치 내용 조회 |
| POST | `/api/batch/inject` | `inject_batch_results` | 외부 분석 결과 주입 |
| POST | `/api/batch/create` | `api_create_batch` | 새 배치 생성 |
| GET | `/api/batch/list` | `api_list_batches` | 배치 목록 |
| POST | `/api/batch/publish` | `api_publish_batch` | 배치 발행 |
| POST | `/api/batch/discard` | `api_discard_batch` | 배치 폐기 |

---

### 5. Crawler API (`routes/crawler.py`)

| Method | Route | 함수 | 설명 |
|--------|-------|------|------|
| GET | `/crawler` | `crawler_page` | 크롤러 UI |
| GET | `/inspector` | `inspector_page` | 인스펙터 UI |
| GET | `/api/targets` | `get_targets` | 타겟 목록 |
| GET | `/api/dedup_categories` | `get_dedup_categories` | 중복제거 카테고리 |
| GET | `/api/fetch` | `fetch` | 링크 수집 |
| GET | `/api/extract` | `extract` | 콘텐츠 추출 |
| GET | `/api/force_extract` | `force_extract` | 강제 추출 (캐시 무시) |
| POST | `/api/extract_batch` | `extract_batch` | 일괄 추출 |
| POST | `/api/save` | `save` | 스테이징에 저장 |
| POST | `/api/skip` | `skip` | 기사 스킵 |
| POST | `/api/update_cache` | `update_cache` | 캐시 업데이트 |

---

### 6. Cleanup API (`routes/cleanup.py`)

| Method | Route | 함수 | 설명 |
|--------|-------|------|------|
| GET | `/api/dates` | `get_dates` | 날짜별 폴더 목록 |
| GET | `/api/articles_by_date` | `get_articles_by_date` | 날짜별 기사 목록 |
| GET | `/api/search_cache` | `search_cache` | 캐시 검색 |
| GET | `/api/find_duplicate_caches` | `find_duplicate_caches` | 중복 캐시 찾기 |
| POST | `/api/cleanup_duplicate_caches` | `cleanup_duplicate_caches` | 중복 캐시 정리 |
| GET | `/api/find_orphan_data_files` | `find_orphan_data_files` | 고아 파일 찾기 |
| POST | `/api/cleanup_orphan_data_files` | `cleanup_orphan_data_files` | 고아 파일 정리 |
| POST | `/api/delete_cache_file` | `delete_cache_file` | 캐시 파일 삭제 |
| POST | `/api/cleanup_cache_file` | `cleanup_cache_file` | 캐시 파일 정리 |
| POST | `/api/find_by_article_ids` | `find_by_article_ids` | article_id로 검색 |

---

### 7. 유틸리티 (manual_crawler.py 내장)

| Method | Route | 함수 | 설명 |
|--------|-------|------|------|
| POST | `/api/verify_score` | `verify_score` | 점수 검증 |
| POST | `/api/inject_correction` | `inject_correction` | 수동 교정값 주입 |
| POST | `/api/mark_worthless` | `mark_worthless` | 무가치 표시 |
| POST | `/api/reload_history` | `reload_history` | 히스토리 리로드 |
| POST | `/api/check_quality` | `check_quality` | URL 품질 체크 |
| GET | `/api/find_duplicate_data` | `find_duplicate_data` | 중복 데이터 찾기 |
| POST | `/api/refresh_article` | `refresh_article` | 기사 새로고침 |

---

## 📊 통계

- **전체 라우트 수**: 61개
- **Blueprint 모듈**: 6개
- **메인 파일 크기**: ~250줄 (리팩토링 전 3,169줄)
