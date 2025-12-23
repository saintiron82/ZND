# ZED Firestore 구조 문서

## 버전: v2.0.0 (2025-12-23)

> 메타 + 내장형 구조로 비용 최적화

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
      "code": "251223_1",
      "name": "1호",
      "count": 15,
      "updated_at": "2025-12-23T10:00:00Z",
      "status": "released"
    }
  ],
  "latest_updated_at": "2025-12-23T10:00:00Z"
}
```

### `_article_ids` (중복 체크)

```json
{
  "ids": ["abc123def456", "ghi789jkl012", ...]
}
```

### `{edition_code}` (회차 문서)

```json
{
  "edition_code": "251223_1",
  "edition_name": "1호",
  "article_count": 15,
  "published_at": "2025-12-23T10:00:00Z",
  "updated_at": "2025-12-23T10:00:00Z",
  "date": "2025-12-23",
  "status": "released",
  "articles": [
    {
      "id": "abc123def456",
      "title_ko": "기사 제목",
      "summary": "요약...",
      "url": "https://...",
      "impact_score": 7.5,
      "zero_echo_score": 8.2,
      "tags": ["AI", "Tech"]
    }
  ]
}
```

---

## ID 체계

| ID | 길이 | 생성 방식 | 예시 |
|----|------|----------|------|
| `edition_code` | 가변 | `YYMMDD_N` 형식 | `251223_1` |
| `article_id` | 12자 | URL MD5 해시 | `abc123def456` |

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
| v2.0.0 | 2025-12-23 | 메타+내장형 구조로 전환, article_id 12자리 통일 |
| v1.0.0 | - | publications + articles 분리 구조 (폐기) |
