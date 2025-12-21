"""
새 MLL 스키마 테스트 - value가 문자열인 경우 테스트

테스트 공식:
- ZES = 5 - penalties + credits + modifiers
- IS = entity + Σ(events)
"""

import sys
import os

# 프로젝트 루트를 path에 추가
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.score_engine import process_raw_analysis, safe_float


def test_safe_float():
    """safe_float 헬퍼 테스트"""
    print("\n=== safe_float 테스트 ===")
    
    # 문자열 변환
    assert safe_float("3.5") == 3.5, "문자열 '3.5' 변환 실패"
    assert safe_float("1.0") == 1.0, "문자열 '1.0' 변환 실패"
    assert safe_float("0.5") == 0.5, "문자열 '0.5' 변환 실패"
    
    # 숫자 그대로 유지
    assert safe_float(3.5) == 3.5, "float 3.5 유지 실패"
    assert safe_float(1) == 1.0, "int 1 변환 실패"
    
    # None 및 빈 문자열
    assert safe_float(None) == 0.0, "None 처리 실패"
    assert safe_float("") == 0.0, "빈 문자열 처리 실패"
    assert safe_float("  ") == 0.0, "공백 문자열 처리 실패"
    
    # 잘못된 문자열
    assert safe_float("invalid") == 0.0, "잘못된 문자열 처리 실패"
    
    print("✅ safe_float 테스트 통과!")


def test_new_schema_string_values():
    """새 스키마 (value가 문자열) 테스트"""
    print("\n=== 새 스키마 테스트 (value가 문자열) ===")
    
    raw = {
        'raw_analysis': {
            'impact_entity': {
                'id': 'ENTITY_MAJOR_PLAYER',
                'value': '3.5',  # 문자열!
                'reasoning': 'Major player in AI industry'
            },
            'impact_events': [
                {
                    'id': 'EVENT_PRODUCT_LAUNCH',
                    'value': '1.5',  # 문자열!
                    'reasoning': 'New product announcement'
                }
            ],
            'penalties': [
                {
                    'id': 'PEN_SPECULATION',
                    'value': '1.0',  # 문자열!
                    'reasoning': 'Contains speculation'
                }
            ],
            'credits': [
                {
                    'id': 'CRED_PRIMARY_SOURCE',
                    'value': '0.5',  # 문자열!
                    'reasoning': 'Uses primary sources'
                }
            ],
            'modifiers': [
                {
                    'id': 'MOD_BREAKING',
                    'value': '0.3',  # 문자열!
                    'reasoning': 'Breaking news'
                }
            ]
        }
    }
    
    result = process_raw_analysis(raw)
    
    # IS = entity(3.5) + events(1.5) = 5.0
    expected_impact = 5.0
    print(f"Impact Score: {result['impact_score']} (예상: {expected_impact})")
    assert result['impact_score'] == expected_impact, f"Impact Score 불일치: {result['impact_score']} != {expected_impact}"
    
    # ZES = 5 - penalties(1.0) + credits(0.5) + modifiers(0.3) = 4.8
    expected_zes = 4.8
    print(f"Zero Echo Score: {result['zero_echo_score']} (예상: {expected_zes})")
    assert result['zero_echo_score'] == expected_zes, f"ZES 불일치: {result['zero_echo_score']} != {expected_zes}"
    
    print("✅ 새 스키마 테스트 통과!")


def test_zero_value_filtering():
    """0값 필터링 테스트"""
    print("\n=== 0값 필터링 테스트 ===")
    
    raw = {
        'raw_analysis': {
            'impact_entity': {
                'id': 'ENTITY_1',
                'value': '2.0',
                'reasoning': 'test'
            },
            'impact_events': [
                {'id': 'EVENT_1', 'value': '0', 'reasoning': 'should be filtered'},  # 0값 - 필터링됨
                {'id': 'EVENT_2', 'value': '1.0', 'reasoning': 'valid'}
            ],
            'penalties': [
                {'id': 'PEN_1', 'value': '0.0', 'reasoning': 'should be filtered'},  # 0값 - 필터링됨
            ],
            'credits': [],
            'modifiers': []
        }
    }
    
    result = process_raw_analysis(raw)
    
    # IS = entity(2.0) + events(1.0) = 3.0 (0값 EVENT 필터링됨)
    expected_impact = 3.0
    print(f"Impact Score: {result['impact_score']} (예상: {expected_impact})")
    assert result['impact_score'] == expected_impact
    
    # ZES = 5 (penalties가 0이라 필터링됨)
    expected_zes = 5.0
    print(f"Zero Echo Score: {result['zero_echo_score']} (예상: {expected_zes})")
    assert result['zero_echo_score'] == expected_zes
    
    print("✅ 0값 필터링 테스트 통과!")


if __name__ == '__main__':
    test_safe_float()
    test_new_schema_string_values()
    test_zero_value_filtering()
    
    # EX_JSON이 있으면 실행
    if EX_JSON:
        test_ex_json()
    
    print("\n🎉 모든 테스트 통과!")


# ============================================================
# 실제 기사 테스트용 - 여기에 JSON 붙여넣기
# ============================================================

EX_JSON = None  # 여기에 MLL 응답 JSON dict를 붙여넣기

# 예시:
# EX_JSON = {
#     "raw_analysis": {
#         "impact_entity": {"id": "ENTITY_ID", "value": "3.0", "reasoning": "..."},
#         "impact_events": [...],
#         "penalties": [...],
#         "credits": [...],
#         "modifiers": [...]
#     }
# }


def test_ex_json():
    """EX_JSON 변수로 실제 기사 테스트"""
    if not EX_JSON:
        print("\n⚠️ EX_JSON이 비어있습니다. JSON을 붙여넣으세요.")
        return
    
    print("\n=== EX_JSON 실제 기사 테스트 ===")
    
    # raw_analysis 찾기
    if 'raw_analysis' in EX_JSON:
        data = EX_JSON
    else:
        data = {'raw_analysis': EX_JSON}
    
    result = process_raw_analysis(data)
    
    print(f"\n📋 결과:")
    print(f"   Impact Score: {result.get('impact_score', 'N/A')}")
    print(f"   Zero Echo Score: {result.get('zero_echo_score', 'N/A')}")
    
    return result
