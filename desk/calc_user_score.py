
from src.score_engine import calculate_zes_v1

data = {
    "Signal": {
        "Rationale": "LLM의 'Drift' 현상과 통제 불가능성에 대한 구체적 기술적 이유 제시.",
        "T2": 7
    },
    "Utility": {
        "Rationale": "기업용 AI 도입 시 고려해야 할 현실적인 한계와 대안을 제시.",
        "V2": 8
    },
    # Missing fields effectively become 0.0 in the current logic
    "Noise": {}, 
    "Fine_Adjustment": {} 
}

score, breakdown = calculate_zes_v1(data)
print(f"Score: {score}")
print(f"Breakdown: {breakdown}")
