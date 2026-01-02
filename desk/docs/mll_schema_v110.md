# MLL Schema v1.2.1 - ZND News Factory

## 개요
이 문서는 MLL(Machine Learning Layer) 분석 결과의 JSON 스키마 구조를 정의합니다.

**버전**: v1.2.1  
**업데이트 날짜**: 2026-01-02  
**변경 사항**: ZES 공식 개선 - 항목 레벨 노이즈 필터링 (≤1 → 0)

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

## ZES (Zero Echo Score) 계산 공식 (v1.2.1)

### 1단계: 항목 레벨 노이즈 필터링
```
# 1점 이하 노이즈는 무시 (≤1 → 0)
P1' = 0 if P1 ≤ 1 else P1
P2' = 0 if P2 ≤ 1 else P2
P3' = 0 if P3 ≤ 1 else P3
P4' = 0 if P4 ≤ 1 else P4
```

### 2단계: 집계 (Aggregation)
```
# 공식: MAX + AVG × 0.25 (최댓값 10.0)
S = min(10, max(T1~T4) + avg(T1~T4) × 0.25)
N = min(10, max(P1'~P4') + avg(P1'~P4') × 0.25)  # 필터링된 값 사용
U = min(10, max(V1~V4) + avg(V1~V4) × 0.25)
```

### 3단계: Purity 계산
```
Purity = S × (1 - N/10)
```

### 4단계: Quality Score
```
Quality = (Purity × 0.7) + (U × 0.3) + Fine_Adjustment
```

### 5단계: 최종 ZES
```
ZES = 10 - Quality
```

### Hard Cutoff
```
S < 4.0 → ZES = 10 (최악의 점수)
```

**범위**: 0.0 ~ 10.0 (소수점 2자리, **낮을수록 좋음**)

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
