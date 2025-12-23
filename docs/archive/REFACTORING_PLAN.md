# 🧹 ZED 코드 클린업 및 리팩토링 계획

> **상태**: 계획 수립 완료, 실행 대기
> **작성일**: 2025-12-22

---

## 📋 개요

### 목표
1. **Phase 1**: 불필요 파일 삭제 및 미사용 기능 제거
2. **Phase 2**: 코드 정리 및 책임 분리 (모듈화)

---

## Phase 1: 불필요 파일/기능 삭제

### 🗑️ 삭제 대상 파일

#### 테스트 파일 (루트에 산재)
| 파일 | 크기 | 판단 |
|------|------|------|
| `test_age_filter.py` | - | ❌ 삭제 (개발용) |
| `test_async_crawler.py` | - | ❌ 삭제 |
| `test_crawler.py` | - | ❌ 삭제 |
| `test_db.py` | - | ❌ 삭제 (임시 생성) |
| `test_imports.py` | - | ❌ 삭제 |
| `test_manual_crawler_import.py` | - | ❌ 삭제 |
| `test_robots.py` | - | ❌ 삭제 |
| `test_schema_adapter.py` | - | ❌ 삭제 |
| `test_schema_save.py` | - | ❌ 삭제 |
| `test_selector.py` | - | ❌ 삭제 |
| `test_output.txt` | - | ❌ 삭제 (임시 파일) |

> **조치**: 필요한 테스트는 `tests/` 폴더로 이동, 나머지 삭제

#### 유지보수 스크립트 (scripts/maintenance/)
| 파일 | 용도 | 판단 |
|------|------|------|
| `apply_desk_changes.py` | 일회성 마이그레이션 | ❓ 리뷰 필요 |
| `apply_desk_html_changes.py` | 일회성 변경 | ❓ 리뷰 필요 |
| `fix_encoding.py` | 인코딩 수정 | ❓ 리뷰 필요 |
| `migrate_*.py` | 마이그레이션 완료됨 | ❌ 삭제 가능 |
| `cleanup_firestore.py` | 가끔 필요 | ✅ 유지 |
| `delete_duplicates.py` | 가끔 필요 | ✅ 유지 |

---

### 🔧 제거 대상 기능

#### desk.py에서 제거 검토
| 기능 | 라인 | 사용 빈도 | 판단 |
|------|------|----------|------|
| ~~`desk_delete_legacy()`~~ | ~~379-414~~ | ~~LEGACY_CALL 관련~~ | ✅ **삭제 완료** |
| `desk_reset_dedup()` | 334-376 | dedup 초기화 | ✅ 유지 (UI에서 사용 중) |

#### desk.html에서 제거 검토
- 사용하지 않는 모달/UI 요소
- 중복된 스타일 정의
- 주석 처리된 코드

---

## Phase 2: 코드 정리 및 책임 분리

### 📁 HTML 파일 분리

#### Before
```
desk/templates/desk.html (3,242줄)
├── CSS (~800줄, 인라인)
├── HTML (~150줄)
└── JavaScript (~2,300줄, 인라인)
```

#### After
```
desk/
├── templates/
│   └── desk.html           # HTML만 (~200줄)
└── static/
    ├── css/
    │   └── desk.css        # 스타일 (~800줄)
    └── js/
        └── desk.js         # 로직 (~2,300줄)
```

#### staging.html도 동일 패턴 적용

---

### 📁 Python 파일 분리 ✅ 완료

#### desk.py 분리 (완료)
```
desk/src/routes/
├── desk.py                 # 기본 뷰 + 기사 CRUD (~480줄) ✅
├── desk_publish.py         # 발행 관련 (~320줄) ✅
└── desk_schedule.py        # 스케줄 관리 (~190줄) ✅
```

#### 함수 재배치
| 현재 위치 | 함수 | 이동 위치 |
|----------|------|----------|
| desk.py | `desk_publish_selected()` | desk_publish.py |
| desk.py | `publication_config()` | desk_publish.py |
| desk.py | `cache_sync()` | desk_publish.py |
| desk.py | `*_schedule*()` 6개 | desk_schedule.py |
| desk.py | `run_crawl_now()` | desk_schedule.py |

---

## ⏰ 실행 순서

### Step 1: 백업
```bash
git stash  # 또는 새 브랜치 생성
```

### Step 2: 불필요 파일 삭제 (Phase 1)
1. 루트의 test_* 파일 삭제
2. scripts/maintenance/ 정리
3. 임시 파일 삭제

### Step 3: HTML 분리 (Phase 2-A)
1. desk.css 추출
2. desk.js 추출
3. desk.html에서 외부 파일 참조
4. 테스트

### Step 4: Python 분리 (Phase 2-B)
1. desk_schedule.py 생성 및 이동
2. desk_publish.py 생성 및 이동
3. Blueprint 등록 수정
4. 테스트

### Step 5: 커밋 및 푸시

---

## ✅ 체크리스트

### Phase 1
- [ ] test_* 파일 10개 삭제
- [ ] test_output.txt 삭제
- [ ] scripts/maintenance/ 정리 (마스터 확인 후)
- [ ] 미사용 기능 제거 (마스터 확인 후)

### Phase 2
- [ ] desk.css 분리
- [ ] desk.js 분리
- [ ] staging.css/js 분리
- [ ] desk_schedule.py 분리
- [ ] desk_publish.py 분리
- [ ] 전체 기능 테스트

---

## 📌 주의사항

> [!WARNING]
> Python 파일 분리 시 Flask Blueprint 라우팅 주의
> - 기존 API 경로 유지 필수
> - `from ... import` 의존성 확인

> [!IMPORTANT]
> HTML 분리 시 Flask static URL 설정 확인
> - `url_for('static', filename='...')` 사용
> - 브라우저 캐시 무효화 고려 (버전 쿼리 추가)

---

*이 계획은 마스터 승인 후 실행 예정*
