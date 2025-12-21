"""실제 MLL 응답 테스트"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.score_engine import process_raw_analysis

# 실제 MLL 응답
data = {
  "raw_analysis": {
    "impact_entity": {
      "id": "TIER_Z_GENERAL",
      "value": "1.0",
      "reasoning": "스타클라우드는 스타트업에 해당"
    },
    "impact_events": [
      {"id": "HARDWARE_BREAKTHROUGH", "value": "3.0", "reasoning": "H100 GPU 가동 성공"}
    ],
    "penalties": [
      {"id": "VAGUE_FUTURE_PROMISE", "value": "2.0", "reasoning": "5GW 계획"},
      {"id": "UNVERIFIABLE_CLAIMS", "value": "1.5", "reasoning": "비용 주장"},
      {"id": "MARKETING_FLUFF", "value": "1.0", "reasoning": "홍보 수사"}
    ],
    "credits": [],
    "modifiers": [
      {"id": "IRRELEVANT_ENTITY_NOISE", "value": "-3.0", "reasoning": "TIER_Z 필터"}
    ]
  }
}

result = process_raw_analysis(data)

print()
print("=== 최종 결과 ===")
print(f"Impact Score: {result['impact_score']}")
print(f"Zero Echo Score: {result['zero_echo_score']}")
