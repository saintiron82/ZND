"""
ZED Score Engine 테스트
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.score_engine import (
    process_raw_analysis,
    calculate_impact_score,
    calculate_zero_echo_score,
    build_evidence
)


def test_calculate_impact_score():
    """Impact Score 계산 테스트"""
    # Case 1: Entity + Events
    entity = {"id": "TIER_3_GLOBAL_ADOPTERS", "value": 2.0, "reasoning": "테스트"}
    events = [
        {"id": "ROUTINE_UPDATE", "value": 0.5, "reasoning": "테스트"},
        {"id": "MAJOR_PARTNERSHIP", "value": 1.5, "reasoning": "테스트"}
    ]
    
    score = calculate_impact_score(entity, events)
    assert score == 4.0, f"Expected 4.0, got {score}"
    print("✅ test_calculate_impact_score (entity + events): PASSED")
    
    # Case 2: Entity only
    score = calculate_impact_score(entity, [])
    assert score == 2.0, f"Expected 2.0, got {score}"
    print("✅ test_calculate_impact_score (entity only): PASSED")
    
    # Case 3: No entity
    score = calculate_impact_score(None, events)
    assert score == 2.0, f"Expected 2.0, got {score}"
    print("✅ test_calculate_impact_score (events only): PASSED")


def test_calculate_zero_echo_score():
    """Zero Echo Score 계산 테스트"""
    # Case 1: Base score only
    score = calculate_zero_echo_score([], [], [])
    assert score == 5.0, f"Expected 5.0, got {score}"
    print("✅ test_calculate_zero_echo_score (base only): PASSED")
    
    # Case 2: Credits add points
    credits = [{"id": "CREDIT_1", "value": 1.0}, {"id": "CREDIT_2", "value": 0.5}]
    score = calculate_zero_echo_score([], credits, [])
    assert score == 6.5, f"Expected 6.5, got {score}"
    print("✅ test_calculate_zero_echo_score (credits): PASSED")
    
    # Case 3: Penalties subtract points  
    penalties = [{"id": "PENALTY_1", "value": 2.0}]
    score = calculate_zero_echo_score(penalties, [], [])
    assert score == 3.0, f"Expected 3.0, got {score}"
    print("✅ test_calculate_zero_echo_score (penalties): PASSED")
    
    # Case 4: Combined with modifiers
    penalties = [{"id": "P1", "value": 2.0}]
    credits = [{"id": "C1", "value": 1.5}]
    modifiers = [{"id": "M1", "value": 0.5}]
    
    # 5.0 + 1.5 - 2.0 + 0.5 = 5.0
    score = calculate_zero_echo_score(penalties, credits, modifiers)
    assert score == 5.0, f"Expected 5.0, got {score}"
    print("✅ test_calculate_zero_echo_score (combined): PASSED")
    
    # Case 5: Clamped to 0-10
    penalties = [{"id": "P1", "value": 10.0}]
    score = calculate_zero_echo_score(penalties, [], [])
    assert score == 0.0, f"Expected 0.0, got {score}"
    print("✅ test_calculate_zero_echo_score (clamp min): PASSED")


def test_process_raw_analysis():
    """전체 처리 테스트"""
    raw = {
        "raw_analysis": {
            "impact_entity": {"id": "TIER_3", "value": 2.0, "reasoning": "Test"},
            "impact_events": [{"id": "EVENT_1", "value": 0.5, "reasoning": "Test"}],
            "penalties": [{"id": "NON_TECHNICAL", "value": 1.5, "reasoning": "Test"}],
            "credits": [{"id": "ANALYST_INSIGHT", "value": 1.0, "reasoning": "Test"}],
            "modifiers": []
        }
    }
    
    result = process_raw_analysis(raw)
    
    # Impact: 2.0 + 0.5 = 2.5
    assert result['impact_score'] == 2.5, f"Expected impact 2.5, got {result['impact_score']}"
    
    # ZeroEcho: 5.0 + 1.0 - 1.5 = 4.5
    assert result['zero_echo_score'] == 4.5, f"Expected ze 4.5, got {result['zero_echo_score']}"
    
    # Evidence structure
    assert 'evidence' in result
    assert 'penalties' in result['evidence']
    assert 'credits' in result['evidence']
    
    print("✅ test_process_raw_analysis: PASSED")


def test_zero_value_filtering():
    """0값 필터링 테스트"""
    raw = {
        "raw_analysis": {
            "impact_entity": {"id": "TIER_3", "value": 2.0, "reasoning": "Test"},
            "impact_events": [
                {"id": "EVENT_VALID", "value": 1.0, "reasoning": "Valid"},
                {"id": "EVENT_ZERO", "value": 0, "reasoning": "Should be filtered"}
            ],
            "penalties": [{"id": "ZERO_PENALTY", "value": 0, "reasoning": "Filtered"}],
            "credits": [{"id": "VALID_CREDIT", "value": 1.0, "reasoning": "Valid"}],
            "modifiers": []
        }
    }
    
    result = process_raw_analysis(raw)
    
    # 0값 이벤트 필터링 확인
    # Impact: 2.0 + 1.0 (0값 제외) = 3.0
    assert result['impact_score'] == 3.0, f"Expected 3.0, got {result['impact_score']}"
    
    # ZeroEcho: 5.0 + 1.0 (credits) - 0 (penalties 필터됨) = 6.0
    assert result['zero_echo_score'] == 6.0, f"Expected 6.0, got {result['zero_echo_score']}"
    
    # Evidence에 0값이 없는지 확인
    assert len(result['evidence']['penalties']) == 0
    
    print("✅ test_zero_value_filtering: PASSED")


if __name__ == "__main__":
    print("\n🧪 ZED Score Engine 테스트 시작...\n")
    
    test_calculate_impact_score()
    test_calculate_zero_echo_score()
    test_process_raw_analysis()
    test_zero_value_filtering()
    
    print("\n✅ 모든 테스트 통과! 🎉\n")
