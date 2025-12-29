# ZED Firestore 구조 문서

## 버전: v3.0.0 (2025-12-29)

> 메타 + 내장형 구조로 비용 최적화, 스키마 버전 관리 강화

---

## 컬렉션 구조

```
publications/
├── _meta                     ← 목록/버전 체크 (경량)
├── _article_ids              ← 중복 체크 (경량)
└── {edition_code}            ← 회차 문서 (헤더 + articles 내장)
```

---

## 문서 상세

### `_meta` (목록/버전 체크)

```json
{
  "issues": [
    {
      "edition_code": "251229_10",
      "edition_name": "제10호",
      "article_count": 3,
      "published_at": "2025-12-29T08:35:30.705666+00:00",
      "updated_at": "2025-12-29T08:35:28.922636+00:00",
      "status": "released",
      "schema_version": "3.0.0"
    }
  ],
  "latest_updated_at": "2025-12-29T08:35:28.922636+00:00"
}
```

### `_article_ids` (중복 체크)

```json
{
  "ids": ["abc123def456", "ghi789jkl012", ...]
}
```

### `{edition_code}` (회차 문서 - v3.0.0)

```json
{
  "edition_code": "251229_10",
  "edition_name": "제10호",
  "article_count": 3,
  "article_ids": ["bb23a68c8640", "55cf5457f1b1", "7fb0b2793245"],
  "published_at": "2025-12-29T08:35:30.705666+00:00",
  "updated_at": "2025-12-29T08:35:28.922636+00:00",
  "date": "2025-12-29",
  "status": "preview",
  "schema_version": "3.0.0",
  "articles": [
    {
      "id": "bb23a68c8640",
      "title_ko": "기사 제목",
      "title": "원문 제목",
      "title_en": "",
      "summary": "요약...",
      "url": "https://...",
      "source_id": "aitimes",
      "category": "AI/ML",
      "layout_type": "Standard",
      "impact_score": 4.5,
      "zero_echo_score": 4.2,
      "tags": ["AI", "Tech"],
      "published_at": "2025-12-29T13:03:28+09:00",
      "date": "2025-12-29",
      "filename": "aitimes_bb23a68c8640.json"
    }
  ]
}
```

---

## 스키마 버전 비교

| 버전 | 필드명 | 설명 |
|------|--------|------|
| v2.0.0 | `code`, `name`, `count` | 레거시 필드 (하위 호환) |
| v3.0.0 | `edition_code`, `edition_name`, `article_count` | 정규화된 필드 |

### Web 해석기 (schemaParser.ts)
- 양쪽 버전 모두 지원
- `edition_code` 우선, `code` 폴백

---

## ID 체계

| ID | 길이 | 생성 방식 | 예시 |
|----|------|----------|------|
| `edition_code` | 가변 | `YYMMDD_N` 형식 | `251229_10` |
| `article_id` | 12자 | URL MD5 해시 | `bb23a68c8640` |

---

## 비용 효율

| 작업 | READ 횟수 |
|------|----------|
| 목록 조회 | 1 (`_meta`) |
| 상세 조회 | 1 (회차 문서) |
| 중복 체크 | 1 (`_article_ids`) |

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|----------|
| v3.0.0 | 2025-12-29 | 필드명 정규화 (`edition_code`, `edition_name`), 스키마 버전 필드 추가 |
| v2.0.0 | 2025-12-23 | 메타+내장형 구조로 전환, article_id 12자리 통일 |
| v1.0.0 | - | publications + articles 분리 구조 (폐기) |

