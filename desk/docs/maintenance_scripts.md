# 유지보수 스크립트 문서

## 발행 스냅샷 복원 스크립트

### 목적
발행 문서(publication document)의 articles 스냅샷에서 유실된 필드를 원본 아티클 데이터에서 복원합니다.

### 발생 상황
발행 과정에서 오류가 발생하거나, 데이터 마이그레이션 문제로 인해 발행 스냅샷의 일부 필드가 유실될 수 있습니다:
- `source_id` (출처)
- `url` (원본 URL)
- `title` (원제목)
- `title_ko` (한국어 제목)
- `summary` (요약)
- `tags` (태그)
- `published_at` (발행일)

### 파일 위치
```
desk/scripts/repair_publication_snapshots.py
```

### 주요 기능
1. **필드 복원**: `source_id`, `url`, `title`, `title_ko`, `summary`, `tags`, `published_at` 등 유실 필드 복구
2. **크로스 환경 조회**: 현재 환경(release/dev)에 원본 아티클이 없으면 다른 환경까지 조회하여 복원 시도
3. **메타 동기화**: 복원 또는 강제 업데이트 시 `_meta` 문서의 타임스탬프도 갱신하여 웹 캐시 무효화 트리거

### 사용 옵션
- `--apply`: 실제 변경사항을 Firestore에 저장 (미지정 시 Dry Run)
- `--env [dev|release]`: 대상 Firestore 환경 지정 (기본값: `release`)
- `--force`: 변경사항이 없어도 타임스탬프 갱신 및 `_meta` 동기화 강제 수행

### 사용 예시

#### 1. 확인만 (Dry Run)
변경 없이 유실된 필드만 확인합니다. 기본적으로 `release` 환경을 조회합니다.
```bash
cd d:\ZND\desk
python scripts/repair_publication_snapshots.py
```

#### 2. 특정 회차 및 환경 지정
```bash
python scripts/repair_publication_snapshots.py 260106_8 --env release
```

#### 3. 실제로 복원 적용
```bash
python scripts/repair_publication_snapshots.py 260106_8 --env release --apply
```

#### 4. 강제 업데이트 (웹 캐시 갱신용)
데이터 변경이 없더라도 타임스탬프를 갱신하여 웹사이트에 반영되도록 합니다.
```bash
python scripts/repair_publication_snapshots.py 260106_8 --env release --apply --force
```

### 동작 원리
1. 지정된 회차(또는 전체)의 articles 스냅샷 검사
2. 유실된 필드 발견 시:
   - 해당 article_id로 원본 아티클 조회 (현재 환경 -> 없으면 타 환경)
   - `_original` 또는 `_header` 섹션에서 데이터 복원
3. `--apply` 실행 시:
   - 해당 발행 문서(`publications/{code}`) 업데이트 및 `updated_at` 갱신
   - `_meta` 문서의 `latest_updated_at` 갱신 (웹 캐시 리프레시 트리거)

### 주의사항
- **반드시 먼저 Dry Run으로 확인** 후 적용하세요.
- `--force` 옵션은 웹페이지에 변경사항이 반영되지 않을 때 유용합니다.
- 실행 전 `desk/.venv` 가상환경이 활성화되어 있어야 합니다. (또는 `.\.venv\Scripts\python.exe` 사용)

---

## 기타 유지보수 스크립트

### fix_article_15d1609e4c79.py
특정 기사를 COLLECTED 상태로 강제 복구하는 스크립트 (일회성)

---

*문서 작성일: 2026-01-06*
