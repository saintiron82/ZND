# 파이프라인 통합 작업 지시서

> **작성일**: 2026-01-06
> **상태**: 1단계 완료, 2단계 대기

---

## 배경

UI 버튼으로 수집 시 Firestore에 저장되지 않는 버그 발견.
원인: 3개의 독립적인 데이터 처리 경로가 존재하여 일부 경로에서 Firestore 저장 누락.

## 현재 상태 (1단계 핫픽스 완료)

`crawler/core/extractor.py`에 `ArticleManager.create()` 호출 추가로 임시 해결.

```python
# [HOTFIX] Firestore에도 저장 (파이프라인 통합 전 임시 조치)
try:
    from src.core.article_manager import ArticleManager
    manager = ArticleManager()
    manager.create(url, content)
except Exception as e:
    print(f"⚠️ [Extract] Firestore save failed: {e}")
```

---

## 2단계: 구조적 통합 (필수)

### 목표
- 중복 코드 완전 제거
- 단일 파이프라인으로 통일
- `ArticleManager`를 유일한 데이터 저장 진입점으로

### 작업 내용

#### 1. `desk/src/api/collector.py` 수정

**현재 코드** (Line 61-64):
```python
from core.extractor import run_full_pipeline
result = run_full_pipeline(schedule_name="즉시 수집", progress_callback=progress_callback)
```

**변경 후**:
```python
from src.scheduler_pipeline import SchedulerPipeline, PipelinePhase

pipeline = SchedulerPipeline()
result = pipeline.run(
    phases=[PipelinePhase.COLLECT, PipelinePhase.EXTRACT],
    schedule_name="즉시 수집",
    progress_callback=progress_callback
).to_dict()
```

#### 2. `crawler/core/extractor.py` 삭제

- 이 파일은 더 이상 필요 없음
- `desk_archive/deprecated/` 폴더로 이동 (또는 삭제)

#### 3. `desk/src/pipeline.py` 정리

**확인 필요 사항**:
- `extract_article()` → `scheduler_pipeline.py`에서 import 중 (유지)
- `save_article()` → 사용 여부 확인 → 미사용 시 삭제
- `process_article()` → 사용 여부 확인 → 미사용 시 삭제
- `batch_process()` → 사용 여부 확인 → 미사용 시 삭제

**정리 후 유지할 함수**:
- `extract_article()` - 추출 로직 (scheduler_pipeline에서 사용)
- `evaluate_article()` - 평가 로직 (필요 시)

---

## 3단계: 최종 구조

```
desk/
├── src/
│   ├── core/
│   │   ├── article_manager.py   # 모든 CRUD 단일 진입점 ★
│   │   ├── article_registry.py  # 메모리 인덱스
│   │   └── firestore_client.py  # DB 클라이언트
│   ├── scheduler_pipeline.py    # 유일한 파이프라인 ★
│   ├── pipeline.py              # 최소화 (extract_article만)
│   └── api/
│       └── collector.py         # UI → SchedulerPipeline 호출 ★
│
crawler/
├── core/
│   ├── collector.py             # 링크 수집만 (저장 X)
│   └── [extractor.py 삭제]      # 삭제됨 ★
```

---

## 검증 체크리스트

- [ ] UI 버튼 수집 → Firestore 저장 확인
- [ ] 스케줄러 자동 수집 → 동일 경로 확인
- [ ] A 시스템 수집 → B 시스템 표시 확인
- [ ] Registry 초기화 시 동기화 정상 확인

---

## 주의사항

1. **import 경로 확인**: `scheduler_pipeline.py`가 crawler 폴더에서 접근 가능한지
2. **env 로딩**: 스케줄러 호출 시 `.env` 로드 확인
3. **에러 핸들링**: 네트워크 오류 시 graceful degradation

---

## 예상 소요 시간

| 단계 | 작업 | 시간 |
|------|------|------|
| 2-1 | collector.py 수정 | 15분 |
| 2-2 | extractor.py 삭제 | 5분 |
| 2-3 | pipeline.py 정리 | 30분 |
| 3 | 검증 | 20분 |
| **합계** | | **~1시간** |
