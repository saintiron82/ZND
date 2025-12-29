# ZND Project Terminology & Constants

## Article States (모두 대문자)
| 상태 | 값 | 설명 |
|------|------|------|
| COLLECTED | `"COLLECTED"` | 수집됨, AI 분석 대기 |
| ANALYZING | `"ANALYZING"` | AI 분석 중 |
| ANALYZED | `"ANALYZED"` | 분석 완료, 분류 대기 |
| CLASSIFIED | `"CLASSIFIED"` | 분류 완료, 발행 대기 |
| PUBLISHED | `"PUBLISHED"` | 발행됨 (미리보기) |
| RELEASED | `"RELEASED"` | 공개됨 (웹 표시) |
| REJECTED | `"REJECTED"` | 폐기됨 (Noise/Duplicate) |

### 주의사항
- 모든 ArticleState 값은 **대문자**를 사용합니다.
- 코드에서 상태를 참조할 때 `ArticleState.CLASSIFIED.value`처럼 enum을 사용합니다.
- 문자열 비교 시 반드시 대문자인지 확인합니다.

## Article Schema (V3)
| 섹션 | 용도 | 불변 |
|------|------|------|
| `_header` | 메타 (state, version, updated_at) | 가변 |
| `_original` | 원본 (title, text, url, image) | **불변** |
| `_analysis` | AI 분석 (title_ko, summary, scores) | 가변 |
| `_classification` | 분류 (category, is_selected) | 가변 |
| `_publication` | 발행 (edition_code, edition_name) | 가변 |

## Category Names
- `AI/ML`, `Engineering`, `Business`, `Community`

## Score Fields
| 필드 | 범위 | 설명 |
|------|------|------|
| `impact_score` (IS) | 0-10 | 영향력 점수 |
| `zero_echo_score` (ZS) | 0-10 | 중복성 (낮을수록 독창적) |
| Priority 공식 | - | `IS + (10 - ZS)` |

## Edition Code Format
`YYMMDD_N` 예: `251226_1` (2025년 12월 26일 1호)

## 참조 파일
- `desk/src/core/article_state.py` - ArticleState enum 정의
