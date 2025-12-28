"""
ZED Scoring Engine v9.0 (V1.0 Only)
Ported from desk_arcive for Desk V2 Inspector.

Supports:
- V1.0.0 Schema (IS_Analysis, ZES_Raw_Metrics)
- Legacy fallback for backwards compatibility
"""

from typing import Union

# Schema Constants
SCHEMA_V1_0 = 'V1.0'
SCHEMA_LEGACY = 'Legacy'


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


def calculate_is_v1(is_analysis: dict) -> tuple[float, dict]:
    """
    Calculate Impact Score using V1.0 formula.
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
    """
    # Extract Signal (T1, T2, T3)
    signal = zes_raw_metrics.get('Signal', {})
    t1 = safe_float(signal.get('T1'))
    t2 = safe_float(signal.get('T2'))
    t3 = safe_float(signal.get('T3'))
    s = (t1 + t2 + t3) / 3.0
    # Note: If T3 is missing in user input, it counts as 0, lowering average.
    # User's example only had T1 or T2. Logic implies T3=0 if missing.
    
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
    u = max(1.0, (v1 + v2 + v3) / 3.0)
    
    # Extract Fine Adjustment
    fine_adj_obj = zes_raw_metrics.get('Fine_Adjustment', {})
    fine_adjustment = safe_float(fine_adj_obj.get('Score'))
    
    # ZS = 10 - (((S + 10 - N) / 2) * (U / 10) + Fine_Adjustment)
    inner = (s + 10 - n) / 2.0
    weighted = inner * (u / 10.0)
    zs_raw = 10.0 - (weighted + fine_adjustment)
    zero_echo_score = max(0.0, min(10.0, round(zs_raw, 1)))
    
    breakdown = {
        'Signal': {'T1': t1, 'T2': t2, 'T3': t3, 'S_Avg': round(s, 2)},
        'Noise': {'P1': p1, 'P2': p2, 'P3': p3, 'N_Avg': round(n, 2)},
        'Utility': {'V1': v1, 'V2': v2, 'V3': v3, 'U_Avg': round(u, 2)},
        'Fine_Adjustment': fine_adjustment,
        'ZS_Raw': round(zs_raw, 2),
        'ZS_Final': zero_echo_score
    }
    
    return zero_echo_score, breakdown
