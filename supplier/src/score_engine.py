"""
ZED Scoring Engine v8.0 (ZED V1.0.0 Schema Compatible)

Supports:
- V1.0.0 Schema (IS_Analysis, ZES_Raw_Metrics)
- V0.9 Schema (Impact_Analysis_IS, Evidence_Analysis_ZES) [Legacy]

V1.0.0 Calculations:
- Impact Score (IS):
  - IW = Tier_Score + Gap_Score
  - IE = Scope_Total + Criticality_Total
  - IS = IW + IE (Clamp 0-10)

- ZeroEcho Score (ZES):
  - S = (T1 + T2 + T3) / 3
  - N = (P1 + P2 + P3) / 3
  - U = (V1 + V2 + V3) / 3
  - ZS = 10 - (((S + 10 - N) / 2) * (U / 10) + Fine_Adjustment) (Clamp 0-10)
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


def detect_schema_version(data: dict) -> str:
    """
    Detect schema version from data structure.
    
    Returns:
        'V1.0' for IS_Analysis / ZES_Raw_Metrics schema
        'V0.9' for Impact_Analysis_IS / Evidence_Analysis_ZES schema
        'Legacy' for older schemas
    """
    if not data or not isinstance(data, dict):
        return 'Legacy'
    
    # Check for V1.0 signature keys
    if 'IS_Analysis' in data or 'ZES_Raw_Metrics' in data:
        return 'V1.0'
    
    # Check for V0.9 signature keys
    if 'Impact_Analysis_IS' in data or 'Evidence_Analysis_ZES' in data:
        return 'V0.9'
    
    # Check for raw_analysis wrapper
    raw = data.get('raw_analysis', {})
    if 'IS_Analysis' in raw or 'ZES_Raw_Metrics' in raw:
        return 'V1.0'
    if 'Impact_Analysis_IS' in raw or 'Evidence_Analysis_ZES' in raw:
        return 'V0.9'
    
    return 'Legacy'


def calculate_is_v1(is_analysis: dict) -> tuple[float, dict]:
    """
    Calculate Impact Score using V1.0 formula.
    
    Formula:
        IW = Tier_Score + Gap_Score
        IE = Scope_Total + Criticality_Total
        IS = IW + IE
    
    Args:
        is_analysis: IS_Analysis object from V1.0 schema
        
    Returns:
        Tuple of (impact_score, breakdown_dict)
    """
    calculations = is_analysis.get('Calculations', {})
    iw_analysis = calculations.get('IW_Analysis', {})
    ie_analysis = calculations.get('IE_Analysis', {})
    
    # IW = Tier_Score + Gap_Score
    tier_score = safe_float(iw_analysis.get('Tier_Score'))
    gap_score = safe_float(iw_analysis.get('Gap_Score'))
    iw_total = tier_score + gap_score
    
    # IE = Scope_Total + Criticality_Total
    ie_inputs = ie_analysis.get('Inputs', {})
    scope_total = safe_float(ie_inputs.get('Scope_Matrix_Score'))
    criticality_total = safe_float(ie_inputs.get('Criticality_Total'))
    ie_total = scope_total + criticality_total
    
    # IS = IW + IE
    is_raw = iw_total + ie_total
    impact_score = max(0.0, min(10.0, round(is_raw, 1)))
    
    breakdown = {
        'schema': 'V1.0',
        'IW_Analysis': {
            'Tier_Score': tier_score,
            'Gap_Score': gap_score,
            'IW_Total': iw_total
        },
        'IE_Analysis': {
            'Scope_Total': scope_total,
            'Criticality_Total': criticality_total,
            'IE_Total': ie_total
        },
        'IS_Raw': is_raw,
        'IS_Final': impact_score,
        'Score_Commentary': is_analysis.get('Score_Commentary', '')
    }
    
    return impact_score, breakdown


def calculate_zes_v1(zes_raw_metrics: dict) -> tuple[float, dict]:
    """
    Calculate ZeroEcho Score using V1.0 formula.
    
    Formula:
        S = (T1 + T2 + T3) / 3
        N = (P1 + P2 + P3) / 3
        U = (V1 + V2 + V3) / 3
        ZS = 10 - (((S + 10 - N) / 2) * (U / 10) + Fine_Adjustment)
    
    Args:
        zes_raw_metrics: ZES_Raw_Metrics object from V1.0 schema
        
    Returns:
        Tuple of (zero_echo_score, breakdown_dict)
    """
    # Extract Signal (T1, T2, T3)
    signal = zes_raw_metrics.get('Signal', {})
    t1 = safe_float(signal.get('T1'))
    t2 = safe_float(signal.get('T2'))
    t3 = safe_float(signal.get('T3'))
    s = (t1 + t2 + t3) / 3.0
    
    # Extract Noise (P1, P2, P3)
    noise = zes_raw_metrics.get('Noise', {})
    p1 = safe_float(noise.get('P1'))
    p2 = safe_float(noise.get('P2'))
    p3 = safe_float(noise.get('P3'))
    n = (p1 + p2 + p3) / 3.0
    
    # Extract Utility (V1, V2, V3)
    utility = zes_raw_metrics.get('Utility', {})
    v1 = safe_float(utility.get('V1'))
    v2 = safe_float(utility.get('V2'))
    v3 = safe_float(utility.get('V3'))
    u = (v1 + v2 + v3) / 3.0
    
    # Extract Fine Adjustment
    fine_adj_obj = zes_raw_metrics.get('Fine_Adjustment', {})
    fine_adjustment = safe_float(fine_adj_obj.get('Score'))
    
    # ZS = 10 - (((S + 10 - N) / 2) * (U / 10) + Fine_Adjustment)
    inner = (s + 10 - n) / 2.0
    weighted = inner * (u / 10.0)
    zs_raw = 10.0 - (weighted + fine_adjustment)
    zero_echo_score = max(0.0, min(10.0, round(zs_raw, 1)))
    
    breakdown = {
        'schema': 'V1.0',
        'Signal': {'T1': t1, 'T2': t2, 'T3': t3, 'S_Avg': round(s, 2), 'Rationale': signal.get('Rationale', '')},
        'Noise': {'P1': p1, 'P2': p2, 'P3': p3, 'N_Avg': round(n, 2), 'Rationale': noise.get('Rationale', '')},
        'Utility': {'V1': v1, 'V2': v2, 'V3': v3, 'U_Avg': round(u, 2), 'Rationale': utility.get('Rationale', '')},
        'Fine_Adjustment': fine_adjustment,
        'Fine_Reason': fine_adj_obj.get('Reason', ''),
        'ZS_Raw': round(zs_raw, 2),
        'ZS_Final': zero_echo_score
    }
    
    return zero_echo_score, breakdown


def process_raw_analysis(raw: dict) -> dict:
    """
    Process raw_analysis data to generate final scores.
    Supports V1.0, V0.9, and Legacy schemas.
    
    Args:
        raw: Dictionary containing analysis data
             
    Returns:
        Flattened dict with:
        - impact_score
        - zero_echo_score
        - impact_evidence (for UI/Storage)
        - evidence (for UI/Storage)
        - schema_version
    """
    if not raw or not isinstance(raw, dict):
        return {}
    
    # Handle both wrapped (raw_analysis) and direct usage
    data = raw.get('raw_analysis', raw)
    
    # Detect schema version
    schema_version = detect_schema_version(data)
    print(f"🔍 [ScoreEngine] Detected schema: {schema_version}")
    
    # ========== V1.0 Schema Processing ==========
    if schema_version == 'V1.0':
        result = {'schema_version': 'V1.0'}
        
        # Calculate IS
        is_analysis = data.get('IS_Analysis', {})
        if is_analysis:
            impact_score, is_breakdown = calculate_is_v1(is_analysis)
            result['impact_score'] = impact_score
            result['impact_evidence'] = {
                'calculations': is_breakdown,
                'raw_inputs': is_analysis.get('Calculations', {}).get('IW_Analysis', {}).get('Inputs', {}),
                'raw_ie_inputs': is_analysis.get('Calculations', {}).get('IE_Analysis', {}).get('Inputs', {})
            }
        else:
            result['impact_score'] = 0.0
            result['impact_evidence'] = {}
        
        # Calculate ZES
        zes_raw_metrics = data.get('ZES_Raw_Metrics', {})
        if zes_raw_metrics:
            zero_echo_score, zes_breakdown = calculate_zes_v1(zes_raw_metrics)
            result['zero_echo_score'] = zero_echo_score
            result['evidence'] = {
                'breakdown': zes_breakdown,
                'raw_metrics': zes_raw_metrics
            }
        else:
            result['zero_echo_score'] = 5.0  # Default
            result['evidence'] = {}
        
        print(f"✅ [ScoreEngine] V1.0 Calculated: IS={result['impact_score']}, ZES={result['zero_echo_score']}")
        return result
    
    # ========== V0.9 Schema Processing (Legacy) ==========
    elif schema_version == 'V0.9':
        # --- Legacy (V6.2) Fallback Check ---
        if 'Impact_Analysis_IS' not in data and ('impact_entity' in data or 'penalties' in data):
            print("⚠️ [ScoreEngine] Detected Legacy (V6.2) Data format.")
            return {
                'impact_score': data.get('impact_score', 0.0),
                'zero_echo_score': data.get('zero_echo_score', 5.0),
                'evidence': {}, 
                'impact_evidence': {},
                'schema_version': 'Legacy'
            }
        
        # --- V0.9 Impact Score Calculation ---
        is_data = data.get('Impact_Analysis_IS', {})
        scores = is_data.get('Scores', {})
        
        iw_score = safe_float(scores.get('IW_Score'))
        gap_score = safe_float(scores.get('Gap_Score'))
        context_bonus = safe_float(scores.get('Context_Bonus'))
        
        ie_breakdown = scores.get('IE_Breakdown_Total', {})
        scope_total = safe_float(ie_breakdown.get('Scope_Total'))
        criticality_total = safe_float(ie_breakdown.get('Criticality_Total'))
        
        adjustment = safe_float(scores.get('Adjustment_Score'))
        
        # IS Summation (V0.9 full formula)
        impact_score_calc = iw_score + gap_score + context_bonus + scope_total + criticality_total + adjustment
        impact_score = max(0.0, min(10.0, round(impact_score_calc, 1)))
        
        # --- V0.9 ZES Calculation (Base 5.0) ---
        zes_data = data.get('Evidence_Analysis_ZES', {})
        vector = zes_data.get('ZES_Score_Vector', {})
        
        positive_scores = vector.get('Positive_Scores', [])
        negative_scores = vector.get('Negative_Scores', [])
        
        zes_sum = 0.0
        
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
        
        print(f"✅ [ScoreEngine] V0.9 Calculated: IS={impact_score}, ZES={zero_echo_score}")
        
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
            'evidence': evidence,
            'schema_version': 'V0.9'
        }
    
    # ========== Legacy Schema Fallback ==========
    else:
        print("⚠️ [ScoreEngine] Using Legacy schema fallback")
        return {
            'impact_score': safe_float(data.get('impact_score')),
            'zero_echo_score': safe_float(data.get('zero_echo_score', 5.0)),
            'evidence': data.get('evidence', {}),
            'impact_evidence': data.get('impact_evidence', {}),
            'schema_version': 'Legacy'
        }

