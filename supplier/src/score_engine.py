"""
ZED Scoring Engine v7.0 (Prompt V0.9 Compatible)

Processes the new JSON structure returned by ZED Intelligence Analyst V0.9.

New Structure:
- Impact_Analysis_IS
  - Analysis_Log
  - Scores: { IW_Score, Gap_Score, Context_Bonus, IE_Breakdown_Total: { Scope_Total, Criticality_Total }, Adjustment_Score }
- Evidence_Analysis_ZES
  - ZES_Score_Vector: { Positive_Scores, Negative_Scores }

Calculations:
- Impact Score (IS) = Sum of all IS components (Clamp 0-10)
- ZED Evidence Score (ZES) = Sum of (Raw * Weight) for all vectors (Clamp 0-10)
"""

from typing import Optional, Union, Dict, List

def safe_float(value: Union[str, int, float, None], default: float = 0.0) -> float:
    """Safe float conversion."""
    if value is None:
        return default
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            cleaned = value.strip()
            if not cleaned: return default
            return float(cleaned)
        except ValueError:
            return default
    return default

def process_raw_analysis(raw: dict) -> dict:
    """
    Process raw_analysis data (V0.9 Schema) to generate final scores.
    
    Args:
        raw: Dictionary containing 'Impact_Analysis_IS' and 'Evidence_Analysis_ZES'
             (or the full article object)
        
    Returns:
        Flattened dict with:
        - impact_score
        - zero_echo_score
        - impact_evidence (for UI/Storage)
        - evidence (for UI/Storage)
    """
    if not raw or not isinstance(raw, dict):
        return {}
    
    # Handle both wrapped (raw_analysis) and direct usage
    data = raw.get('raw_analysis', raw)

    # --- Legacy (V6.2) Fallback Check ---
    # If keys 'impact_entity' or 'penalties' exist but 'Impact_Analysis_IS' does not
    if 'Impact_Analysis_IS' not in data and ('impact_entity' in data or 'penalties' in data):
        print("⚠️ [ScoreEngine] Detected Legacy (V6.2) Data format. Returning 0.0 or migrating if critical.")
        # Optional: Implement legacy calculation if strictly required. 
        # For now, we return 0.0 to avoid crashing, as prompt V0.9 is the new standard.
        # If user needs legacy support, we can add it back.
        return {
            'impact_score': data.get('impact_score', 0.0),
            'zero_echo_score': data.get('zero_echo_score', 5.0), # Legacy base was 5.0
            'evidence': {}, 
            'impact_evidence': {}
        }
    
    # --- 1. Impact Score Calculation ---
    is_data = data.get('Impact_Analysis_IS', {})
    scores = is_data.get('Scores', {})
    
    iw_score = safe_float(scores.get('IW_Score'))
    gap_score = safe_float(scores.get('Gap_Score'))
    context_bonus = safe_float(scores.get('Context_Bonus'))
    
    ie_breakdown = scores.get('IE_Breakdown_Total', {})
    scope_total = safe_float(ie_breakdown.get('Scope_Total'))
    criticality_total = safe_float(ie_breakdown.get('Criticality_Total'))
    
    adjustment = safe_float(scores.get('Adjustment_Score'))
    
    # IS Summation
    impact_score_calc = iw_score + gap_score + context_bonus + scope_total + criticality_total + adjustment
    impact_score = max(0.0, min(10.0, round(impact_score_calc, 1)))
    
    # --- 2. ZES Calculation (Base 5.0) ---
    # Formula: ZES = 5 - (Positive + Negative)
    # Since Negative weights are already negative, we sum all and subtract from base
    zes_data = data.get('Evidence_Analysis_ZES', {})
    vector = zes_data.get('ZES_Score_Vector', {})
    
    positive_scores = vector.get('Positive_Scores', [])
    negative_scores = vector.get('Negative_Scores', [])
    
    zes_sum = 0.0
    
    # Sum all weighted scores
    if isinstance(positive_scores, list):
        for item in positive_scores:
            raw_val = safe_float(item.get('Raw_Score'))
            weight = safe_float(item.get('Weight'))
            zes_sum += (raw_val * weight)
            
    if isinstance(negative_scores, list):
        for item in negative_scores:
            raw_val = safe_float(item.get('Raw_Score'))
            weight = safe_float(item.get('Weight'))
            zes_sum += (raw_val * weight)
    
    # ZES = 5 - (sum)
    zero_echo_score = 5.0 - zes_sum
    zero_echo_score = max(0.0, min(10.0, round(zero_echo_score, 1)))
    
    print(f"✅ [ScoreEngine] Calculated IS={impact_score} (Raw Sum={impact_score_calc:.2f}), ZES={zero_echo_score} (5.0 - {zes_sum:.2f})")
    
    # --- 3. Construct Evidence Objects for UI/Storage ---
    # We map new structure to 'evidence' and 'impact_evidence' generic buckets
    # or keep the full new structure if the UI supports it.
    # For now, we return the FULL new structure as 'evidence_v2' and also minimal backwards compats
    
    impact_evidence = {
        'scores': scores,
        'analysis_log': is_data.get('Analysis_Log', {}),
        'reasoning': is_data.get('Reasoning', {})
    }
    
    evidence = {
        'score_vector': vector,
        'commentary': zes_data.get('Analysis_Commentary', {})
    }
    
    return {
        'impact_score': impact_score,
        'zero_echo_score': zero_echo_score,
        'impact_evidence': impact_evidence,
        'evidence': evidence
        # 원본 raw structures는 raw_analysis에 이미 저장되어 있으므로 중복 반환하지 않음
    }
