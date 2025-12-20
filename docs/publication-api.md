# 발행 시스템 (Issue-Based Publishing) 기술 문서

Web 프론트엔드에서 MLL 발행 시스템을 사용하기 위한 API 및 데이터 구조 설명입니다.

---

## 핵심 개념

| 용어 | 설명 |
|------|------|
| **Issue (회차)** | 한 번의 발행 이벤트 (예: "12/20 1차 발행") |
| **PublicationRecord** | Firestore `publications` 컬렉션에 저장되는 회차 메타데이터 |
| **publish_id** | 회차의 고유 식별자 (Firestore Document ID) |
| **edition_code** | 회차 코드 (예: `241220_1`, `241220_2`) |
| **edition_name** | 사용자 표시용 회차명 (예: "12/20 1차 발행") |

---

## Firestore 컬렉션 구조

### 1. `articles` - 발행된 기사
```json
{
  "id": "abc123_hash",
  "title_ko": "기사 제목",
  "summary": "요약",
  "url": "https://...",
  "score": 7.5,
  "published_at": "2024-12-20T10:00:00Z",
  "publish_id": "firestore_doc_id",
  "edition_name": "12/20 1차 발행"
}
```

### 2. `publications` - 회차 메타데이터
```json
{
  "id": "firestore_auto_id",
  "published_at": "2024-12-20T10:00:00Z",
  "date": "2024-12-20",
  "edition_code": "241220_1",
  "edition_name": "12/20 1차 발행",
  "article_count": 5,
  "articles": [
    { "id": "abc123", "title": "제목1", "url": "...", "filename": "...", "date": "2024-12-20" }
  ]
}
```

---

## API 엔드포인트

### 📋 회차 목록 조회
```
GET /api/publications/list
GET /api/publications/list?date=2024-12-20  (선택: 날짜 필터)
```

**응답:**
```json
{
  "success": true,
  "issues": [
    {
      "id": "abc123",
      "edition_name": "12/20 1차 발행",
      "edition_code": "241220_1",
      "article_count": 5,
      "published_at": "2024-12-20T10:00:00Z",
      "date": "2024-12-20"
    }
  ]
}
```

---

### 📰 특정 회차 기사 조회
```
GET /api/publications/view?publish_id={publish_id}
```

**응답:**
```json
{
  "success": true,
  "publication": { /* PublicationRecord */ },
  "articles": [
    {
      "title_ko": "기사 제목",
      "summary": "요약",
      "url": "https://...",
      "impact_score": 7.5,
      "zero_echo_score": 3.2
    }
  ]
}
```

---

### 🚀 기사 발행 (신규 회차 / 기존 회차 추가)
```
POST /api/staging/publish_selected
Content-Type: application/json
```

**요청 (신규 회차):**
```json
{
  "filenames": ["article1.json", "article2.json"],
  "mode": "new"
}
```

**요청 (기존 회차에 추가):**
```json
{
  "filenames": ["article3.json"],
  "mode": "append",
  "target_publish_id": "existing_publish_id"
}
```

**응답:**
```json
{
  "success": true,
  "published": 2,
  "failed": 0,
  "publish_id": "new_or_existing_id",
  "edition_name": "12/20 1차 발행",
  "message": "2개 기사 발행 완료 (12/20 1차 발행)"
}
```

---

## 로컬 파일 구조

```
data/
└── 2024-12-20/
    ├── source_abc123.json          # 개별 기사 파일
    ├── source_def456.json
    └── issue_241220_1.json         # 회차 인덱스 파일
```

### 회차 인덱스 파일 (`issue_{edition_code}.json`)
```json
{
  "publish_id": "firestore_doc_id",
  "edition_code": "241220_1",
  "edition_name": "12/20 1차 발행",
  "published_at": "2024-12-20T10:00:00Z",
  "article_count": 5,
  "articles": [
    { "id": "abc123", "title": "제목", "filename": "source_abc123.json" }
  ]
}
```

---

## Web 사용 가이드

### 1. 최신 회차 목록 가져오기
```javascript
const response = await fetch('/api/publications/list');
const { issues } = await response.json();
// issues[0] = 가장 최근 회차
```

### 2. 특정 회차의 기사 표시하기
```javascript
const response = await fetch(`/api/publications/view?publish_id=${publishId}`);
const { articles, publication } = await response.json();
// articles = 기사 배열
// publication.edition_name = 회차명
```

### 3. 발행된 기사 식별하기
기사에 다음 필드가 있으면 발행된 상태:
```javascript
if (article.publish_id && article.edition_name) {
  // 발행됨
  console.log(`${article.edition_name}에 포함됨`);
}
```

---

## 주의사항

1. **회차 순서**: `published_at` 기준 내림차순 정렬 권장
2. **같은 날 여러 회차**: `edition_code`로 구분 (예: `241220_1`, `241220_2`)
3. **기사 날짜 vs 발행 날짜**: 기사의 `crawled_at`과 회차의 `published_at`은 다를 수 있음
4. **articles.date**: 기사 원본 날짜 (파일 위치 결정에 사용)
