# ZED 프로젝트 문서 인덱스

## 목적
AI 어시스턴트(예나)가 프로젝트 관련 판단을 내릴 때 참조할 수 있는 공식 문서 목록

---

## 📚 문서 목록

### 아키텍처 & 설계

| 문서 | 경로 | 설명 |
|------|------|------|
| **프로젝트 아키텍처** | [docs/ARCHITECTURE.md](file:///d:/ZND/docs/ARCHITECTURE.md) | 전체 시스템 구조 (V2 Meta+Embedded 반영됨) |
| **시스템 통합 문서** | [docs/SYSTEM_DOCUMENTATION.md](file:///d:/ZND/docs/SYSTEM_DOCUMENTATION.md) | 데이터 구조, 생성/발행 로직, 포맷 총정리 |
| **Firestore 구조** | [docs/FIRESTORE_STRUCTURE.md](file:///d:/ZND/docs/FIRESTORE_STRUCTURE.md) | 데이터베이스 스키마 (버전별) |
| **리팩토링 계획** | [docs/archive/REFACTORING_PLAN.md](file:///d:/ZND/docs/archive/REFACTORING_PLAN.md) | 코드 개선 로드맵 (보관됨) |

### API 명세

| 문서 | 경로 | 설명 |
|------|------|------|
| **API 라우트** | [docs/api-routes.md](file:///d:/ZND/docs/api-routes.md) | Desk API 엔드포인트 목록 |


### 운영 & 배포

| 문서 | 경로 | 설명 |
|------|------|------|
| **GCP VM 배포** | [docs/DEPLOY_GCP_VM_GUIDE.md](file:///d:/ZND/docs/DEPLOY_GCP_VM_GUIDE.md) | VM 배포 가이드 |
| **트러블슈팅** | [docs/TROUBLESHOOTING.md](file:///d:/ZND/docs/TROUBLESHOOTING.md) | 문제 해결 가이드 |

---

## 🔧 규칙 파일

| 파일 | 경로 | 설명 |
|------|------|------|
| **아키텍처 규칙** | [.gemini/rules/architecture-rules.md](file:///d:/ZND/.gemini/rules/architecture-rules.md) | 설계 원칙 |
| **코딩 표준** | [.gemini/rules/coding-standards.md](file:///d:/ZND/.gemini/rules/coding-standards.md) | 코드 작성 규칙 |
| **데이터 스키마** | [.gemini/rules/data-schema.md](file:///d:/ZND/.gemini/rules/data-schema.md) | 데이터 구조 정의 |
| **커뮤니케이션** | [.gemini/rules/rule.md](file:///d:/ZND/.gemini/rules/rule.md) | 응답 스타일, 페르소나 |

---

## 참조 우선순위

1. **규칙 파일** (.gemini/rules/) - 최우선
2. **아키텍처 문서** - 설계 결정 시
3. **API 명세** - 엔드포인트 관련 작업 시
4. **운영 문서** - 배포/트러블슈팅 시
