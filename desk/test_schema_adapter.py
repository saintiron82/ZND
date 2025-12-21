
import sys
print("DEBUG: Script started", flush=True)
import os
import json

# Add src to path
sys.path.append(os.path.join(os.path.dirname(__file__)))

from src.core_logic import normalize_field_names

def test_nested_json():
    nested_json = {
        "title_ko": "모티프, 자체 LLM ‘모티프 12.7B’ 글로벌 LLM 평가 11위 기록",
        "article_id": "motiff_12.7B_rank_11",
        "Impact": {
            "impact_score": 5.0,
            "impact_evidence": {
                "entity": { "id": "TIER_Z_GENERAL", "weight": 1.0 },
                "events": [ { "id": "MAJOR_TECH_OPENING", "weight": 3.0 } ]
            },
            "impact_review_ko": "Tier Z 일반 기업의 오픈소스 모델 발표..."
        },
        "ZeroEcho": {
            "ZeroEchoScore": 4.0,
            "penalties": [ { "id": "IRRELEVANT_ENTITY_NOISE", "value": 3.0 } ],
            "credits": [ { "id": "REPRODUCIBLE_ASSETS", "value": 2.0 } ],
            "zeroechoscore_review_ko": "독자 기술 및 성능 비교 등..."
        }
    }

    print("Running normalization on nested JSON...")
    normalized = normalize_field_names(nested_json)

    # Assertions
    print(f"Impact Score: {normalized.get('impact_score')} (Expected 5.0)")
    assert normalized.get('impact_score') == 5.0, "Impact Score mismatch"
    
    print(f"Zero Echo Score: {normalized.get('zero_echo_score')} (Expected 4.0)")
    assert normalized.get('zero_echo_score') == 4.0, "Zero Echo Score mismatch"
    
    print(f"Evidence exists: {'evidence' in normalized}")
    assert 'evidence' in normalized, "Evidence field missing"
    
    print(f"Credits count: {len(normalized['evidence']['credits'])} (Expected 1)")
    assert len(normalized['evidence']['credits']) == 1, "Credits count mismatch"
    
    print(f"Checking for duplication cleanup...")
    assert 'Impact' not in normalized, "Impact object not removed"
    assert 'ZeroEcho' not in normalized, "ZeroEcho object not removed"
    print("Cleanup successful.")

    print("✅ Test Passed!")

    print("\nStarting wrapper test...")
    wrapper_json = {
        "response_schema": {
            "title_ko": "Wrapper Test Title",
            "Impact": { "impact_score": 3.0 }
        }
    }
    norm_wrapper = normalize_field_names(wrapper_json)
    print(f"Wrapper Title: {norm_wrapper.get('title_ko')}")
    assert norm_wrapper.get('title_ko') == "Wrapper Test Title", "Wrapper unwrapping failed"
    print(f"Wrapper Impact: {norm_wrapper.get('impact_score')}")
    assert norm_wrapper.get('impact_score') == 3.0, "Wrapper impact flattening failed"
    
    print("✅ All Tests Passed!")

    print("\nStarting Score Recalculation test...")
    # Test Case: Provided score is 10.0 (wrong), expected is 5.0 + 2.0 - 3.0 = 4.0
    score_json = {
        "ZeroEcho": {
            "ZeroEchoScore": 10.0, # Intentional wrong score
            "credits": [ { "id": "GOOD", "value": 2.0 } ],
            "penalties": [ { "id": "BAD", "value": 3.0 } ]
        }
    }
    norm_score = normalize_field_names(score_json)
    print(f"Original Score in JSON: 10.0")
    print(f"Calculated Score: {norm_score.get('zero_echo_score')} (Expected 4.0)")
    assert norm_score.get('zero_echo_score') == 4.0, "Score recalculation failed"
    print("✅ Score Recalculation Passed!")

if __name__ == "__main__":
    test_nested_json()
