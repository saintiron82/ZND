# MLL Schema v1.1.0 - ZND News Factory

## 개요
이 문서는 MLL(Machine Learning Layer) 분석 결과의 JSON 스키마 구조를 정의합니다.

**버전**: v1.1.0  
**업데이트 날짜**: 2025-12-29  
**변경 사항**: Signal/Noise/Utility 각 카테고리 3항목 → 4항목 확장

---

## 전체 출력 스키마

```json
{
  "Article_ID": "String",
  "Meta": {
    "Specification_Version": "v1.1.0",
    "Headline": "String", 
    "Summary": "String", 
    "Tags": [] 
  },
  "IS_Analysis": {
    "Score_Commentary": "String", 
    "Calculations": {
      "IW_Analysis": {
        "Inputs": {
          "Pe_Selection_Rule": "P1–P5",
          "Pe_Entity_Name": "String",
          "Pe_Tier": "Integer",
          "Se_Entity_Name": "String", 
          "Se_Tier": "Integer",
          "Selection_Reason": "String"
        },
        "Tier_Score": "Float",
        "Gap_Score": "Float",
        "IW_Score": "Float"
      },
      "IE_Analysis": {
        "Inputs": {
          "X_Magnitude_Code": "Integer (1-4)",
          "Y_Evidence_Code": "Integer (1-4)",
          "Scope_Matrix_Score": "Float",
          "Criticality_C1_Provenness": "Float",
          "Criticality_C2_Societal_Weight": "Float",
          "Criticality_Total": "Float",
          "SOTA_Check_Result": "Boolean/String"
        },
        "IE_Score": "Float"
      }
    }
  },
  "ZES_Raw_Metrics": {
    "Signal": {
      "Description": "정보의 실체 (0~10점)",
      "Items": {
        "T1": { "Score": 0, "Rationale": "데이터 구체성 및 수치 포함 여부" },
        "T2": { "Score": 0, "Rationale": "메커니즘 상세 및 기술적 원리 설명" },
        "T3": { "Score": 0, "Rationale": "출처의 독립성 및 객관성" },
        "T4": { "Score": 0, "Rationale": "출처의 우수성 및 권위" }
      }
    },
    "Noise": {
      "Description": "인위적 잡음 (0~10점, 높을수록 부정적)",
      "Items": {
        "P1": { "Score": 0, "Rationale": "수식어 오염도 및 과장된 표현" },
        "P2": { "Score": 0, "Rationale": "인용구 편향성 및 이해당사자 발언 비중" },
        "P3": { "Score": 0, "Rationale": "비교 왜곡 및 부적절한 대조군" },
        "P4": { "Score": 0, "Rationale": "광고성 목적 및 교묘한 홍보 멘트" }
      }
    },
    "Utility": {
      "Description": "실질적 효용 (0~10점)",
      "Items": {
        "V1": { "Score": 0, "Rationale": "시장 영향력 및 판도 변화 잠재력" },
        "V2": { "Score": 0, "Rationale": "즉시 실행 및 적용 가능성" },
        "V3": { "Score": 0, "Rationale": "정보 희소성 및 독창적 가치" },
        "V4": { "Score": 0, "Rationale": "기술의 일반적 적용 및 범용성" }
      }
    },
    "Fine_Adjustment": {
      "Score": 0.0,
      "Reason": "전체 품질 점수 보정 근거 (+/- 1.0 이내)"
    }
  }
}
```

---

## ZES (Zero Echo Score) 계산 공식

### 평균 계산 (V1.1.0)
```
S_avg = (T1 + T2 + T3 + T4) / 4.0
N_avg = (P1 + P2 + P3 + P4) / 4.0
U_avg = max(1.0, (V1 + V2 + V3 + V4) / 4.0)
```

### 최종 점수
```
ZES = 10 - (((S_avg + 10 - N_avg) / 2) × (U_avg / 10) + Fine_Adjustment)
```

**범위**: 0.0 ~ 10.0 (소수점 1자리)

---

## 항목 상세 설명

### Signal (정보의 실체)
| 코드 | 측정 항목 | 설명 |
|------|----------|------|
| T1 | 데이터 구체성 | 수치, 통계, 정량적 데이터 포함 여부 |
| T2 | 메커니즘 상세 | 기술적 원리, 작동 방식 설명 정도 |
| T3 | 출처 독립성 | 출처가 이해관계에서 독립적인지 |
| T4 | 출처 권위 | 출처의 전문성과 신뢰도 수준 |

### Noise (인위적 잡음) - 높을수록 부정적
| 코드 | 측정 항목 | 설명 |
|------|----------|------|
| P1 | 수식어 오염도 | "혁신적", "획기적" 등 과장 표현 |
| P2 | 인용구 편향성 | 이해당사자 발언 비중이 높은지 |
| P3 | 비교 왜곡 | 부적절한 대조군 사용 여부 |
| P4 | 광고성 목적 | 교묘한 홍보/마케팅 의도 |

### Utility (실질적 효용)
| 코드 | 측정 항목 | 설명 |
|------|----------|------|
| V1 | 시장 영향력 | 산업/시장 판도 변화 잠재력 |
| V2 | 즉시 적용성 | 바로 실행 가능한 정보인지 |
| V3 | 정보 희소성 | 다른 곳에서 얻기 어려운 정보인지 |
| V4 | 기술 범용성 | 다양한 분야에 적용 가능한지 |

---

## 하위 호환성

코드는 다음 두 가지 스키마 형식을 모두 지원합니다:

### 새 스키마 (V1.1.0 - 중첩 Items 구조)
```json
{
  "Signal": {
    "Items": {
      "T1": { "Score": 7, "Rationale": "..." },
      "T2": { "Score": 6, "Rationale": "..." }
    }
  }
}
```

### 레거시 스키마 (V1.0.0 - Flat 구조)
```json
{
  "Signal": {
    "T1": 7,
    "T2": 6,
    "T3": 5
  }
}
```

T4, P4, V4가 없는 레거시 데이터는 해당 값을 0으로 처리합니다.

---

## 관련 파일
- [score_engine.py](file:///c:/Users/saint/ZND/desk/src/core/score_engine.py) - 백엔드 점수 계산
- [desk-classification.js](file:///c:/Users/saint/ZND/desk/static/js/desk-classification.js) - 프론트엔드 UI 표시
- [terminology.md](file:///c:/Users/saint/ZND/desk/docs/terminology.md) - 프로젝트 용어 정의
