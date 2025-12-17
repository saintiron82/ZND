"""
ZED Scoring Engine v8.0 (ZED V1.0.0 Schema Compatible)

Supports:
- V1.0.0 Schema (IS_Analysis, ZES_Raw_Metrics)
- V0.9 Schema (Impact_Analysis_IS, Evidence_Analysis_ZES) [Legacy]
- Hybrid V0.9 Schema (Manual Batch Simple Format)
"""

from typing import Optional, Union, Dict, List

# Schema Constants
SCHEMA_V1_0 = 'V1.0'
SCHEMA_V0_9 = 'V0.9'
SCHEMA_HYBRID = 'V0.9-Hybrid'
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


def detect_schema_version(data: dict) -> str:
    """
    Detect schema version from data structure.
    
    Priority:
    1. Specification_Version field (explicit version)
    2. V1.0 keys: IS_Analysis, ZES_Raw_Metrics
    3. Hyrbid V0.9 keys: impact_entity, impact_events inside raw_analysis
    4. V0.9 keys: Impact_Analysis_IS, Evidence_Analysis_ZES
    5. Legacy fallback
    
    Returns:
        SCHEMA_V1_0, SCHEMA_HYBRID, SCHEMA_V0_9, or SCHEMA_LEGACY
    """
    if not data or not isinstance(data, dict):
        return SCHEMA_LEGACY
    
    # Check raw_analysis wrapper first (unwrap if needed for detection context)
    # But detection should run on the 'data' passed to it, which is the unwrapped content usually.
    # Note: process_raw_analysis unwraps it before calling this.
    
    # Priority 1: Check Specification_Version field (V1.0.0+)
    meta = data.get('Meta', {})
    spec_version = meta.get('Specification_Version', '')
    if spec_version and 'v 1.0' in spec_version.lower():
        return SCHEMA_V1_0
    
    # Priority 2: Check for V1.0 signature keys
    if 'IS_Analysis' in data or 'ZES_Raw_Metrics' in data:
        return SCHEMA_V1_0

    # Priority 3: Check for Hybrid V0.9 signature (Simple format)
    # These keys exist directly in the raw_analysis struct
    if 'impact_entity' in data or 'impact_events' in data:
        return SCHEMA_HYBRID
    
    # Priority 4: Check for V0.9 signature keys
    if 'Impact_Analysis_IS' in data or 'Evidence_Analysis_ZES' in data:
        return SCHEMA_V0_9
    
    return SCHEMA_LEGACY


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
        'schema': SCHEMA_V1_0,
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
        'schema': SCHEMA_V1_0,
        'Signal': {'T1': t1, 'T2': t2, 'T3': t3, 'S_Avg': round(s, 2), 'Rationale': signal.get('Rationale', '')},
        'Noise': {'P1': p1, 'P2': p2, 'P3': p3, 'N_Avg': round(n, 2), 'Rationale': noise.get('Rationale', '')},
        'Utility': {'V1': v1, 'V2': v2, 'V3': v3, 'U_Avg': round(u, 2), 'Rationale': utility.get('Rationale', '')},
        'Fine_Adjustment': fine_adjustment,
        'Fine_Reason': fine_adj_obj.get('Reason', ''),
        'ZS_Raw': round(zs_raw, 2),
        'ZS_Final': zero_echo_score
    }
    
    return zero_echo_score, breakdown


def calculate_hybrid_v09(data: dict) -> dict:
    """
    Calculate scores for Hybrid V0.9 Schema (Simple structure).
    
    IS = Entity + Events + Modifiers (Sum)
    ZES = 5.0 + Penalties - Credits (Base 5)
    """
    print(f"🔍 [ScoreEngine] Processing Hybrid V0.9 Calculation")
    
    # Extract from simple structure
    impact_entity = data.get('impact_entity', {})
    impact_events = data.get('impact_events', [])
    modifiers = data.get('modifiers', [])
    
    # IS Calculation
    score_sum = 0.0
    score_sum += safe_float(impact_entity.get('value'))
    
    if isinstance(impact_events, list):
        for evt in impact_events:
            score_sum += safe_float(evt.get('value'))
            
    if isinstance(modifiers, list):
        for mod in modifiers:
            score_sum += safe_float(mod.get('value'))
            
    impact_score = max(0.0, min(10.0, round(score_sum, 1)))
    
    # ZES Calculation
    penalties = data.get('penalties', [])
    credits = data.get('credits', [])
    
    zes_base = 5.0
    p_sum = 0.0
    c_sum = 0.0
    
    if isinstance(penalties, list):
        for p in penalties:
            p_sum += safe_float(p.get('value'))
            
    if isinstance(credits, list):
        for c in credits:
            c_sum += safe_float(c.get('value'))
    
    # ZES = 5 + Penalties(Noise) - Credits(Signal)
    zero_echo_score = zes_base + p_sum - c_sum
    zero_echo_score = max(0.0, min(10.0, round(zero_echo_score, 1)))
    
    print(f"✅ [ScoreEngine] Hybrid V0.9 Calculated: IS={impact_score}, ZES={zero_echo_score}")
    
    return {
        'impact_score': impact_score,
        'zero_echo_score': zero_echo_score,
        'impact_evidence': {'entity': impact_entity, 'events': impact_events},
        'evidence': {'penalties': penalties, 'credits': credits},
        'schema_version': SCHEMA_HYBRID
    }


def process_raw_analysis(raw: dict, force_schema_version: str = None) -> dict:
    """
    Process raw_analysis data to generate final scores.
    Supports V1.0, V0.9, Hybrid V0.9, and Legacy schemas.
    
    Args:
        raw: Analysis data dict
        force_schema_version: Optional. Force a specific schema version 
                            (SCHEMA_V1_0, SCHEMA_HYBRID, etc.)
    """
    if not raw or not isinstance(raw, dict):
        return {}
    
    # Unwrap 'raw_analysis' wrapper if present
    data = raw.get('raw_analysis', raw)
    
    # Handle V1.0.0 'articles' array wrapper
    if 'articles' in data and isinstance(data['articles'], list) and len(data['articles']) > 0:
        data = data['articles'][0]
        print(f"📦 [ScoreEngine] Extracted article from 'articles' array: {data.get('Article_ID', 'unknown')}")
    
    # Detect schema version
    if force_schema_version:
        schema_version = force_schema_version
        print(f"👉 [ScoreEngine] Forced schema version: {schema_version}")
    else:
        schema_version = detect_schema_version(data)
        print(f"🔍 [ScoreEngine] Detected schema: {schema_version}")
    
    # Dispatch based on schema
    if schema_version == SCHEMA_V1_0:
        result = {'schema_version': SCHEMA_V1_0}
        
        # Meta Fields
        meta = data.get('Meta', {})
        if meta.get('Headline'): result['title_ko'] = meta['Headline']
        if meta.get('Summary'): result['summary'] = meta['Summary']
        if data.get('Article_ID'): result['article_id'] = data['Article_ID']
        
        # IS
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
            
        # ZES
        zes_raw_metrics = data.get('ZES_Raw_Metrics', {})
        if zes_raw_metrics:
            zero_echo_score, zes_breakdown = calculate_zes_v1(zes_raw_metrics)
            result['zero_echo_score'] = zero_echo_score
            result['evidence'] = {
                'breakdown': zes_breakdown,
                'raw_metrics': zes_raw_metrics
            }
        else:
            result['zero_echo_score'] = 5.0
            result['evidence'] = {}
            
        print(f"✅ [ScoreEngine] V1.0 Calculated: IS={result['impact_score']}, ZES={result['zero_echo_score']}")
        return result

    elif schema_version == SCHEMA_HYBRID:
        return calculate_hybrid_v09(data)
        
    elif schema_version == SCHEMA_V0_9:
        # V0.9 Logic
        is_data = data.get('Impact_Analysis_IS', {})
        scores = is_data.get('Scores', {})
        
        iw_score = safe_float(scores.get('IW_Score'))
        gap_score = safe_float(scores.get('Gap_Score'))
        context_bonus = safe_float(scores.get('Context_Bonus'))
        
        ie_breakdown = scores.get('IE_Breakdown_Total', {})
        scope_total = safe_float(ie_breakdown.get('Scope_Total'))
        criticality_total = safe_float(ie_breakdown.get('Criticality_Total'))
        
        adjustment = safe_float(scores.get('Adjustment_Score'))
        
        impact_score_calc = iw_score + gap_score + context_bonus + scope_total + criticality_total + adjustment
        impact_score = max(0.0, min(10.0, round(impact_score_calc, 1)))
        
        # ZES (V0.9)
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
        
        zero_echo_score = 5.0 - zes_sum
        zero_echo_score = max(0.0, min(10.0, round(zero_echo_score, 1)))
        
        print(f"✅ [ScoreEngine] V0.9 Calculated: IS={impact_score}, ZES={zero_echo_score}")
        
        return {
            'impact_score': impact_score,
            'zero_echo_score': zero_echo_score,
            'impact_evidence': {
                'scores': scores,
                'analysis_log': is_data.get('Analysis_Log', {}),
                'reasoning': is_data.get('Reasoning', {})
            },
            'evidence': {
                'score_vector': vector,
                'commentary': zes_data.get('Analysis_Commentary', {})
            },
            'schema_version': SCHEMA_V0_9
        }
        
    else: # SCHEMA_LEGACY
        print("⚠️ [ScoreEngine] Using Legacy schema fallback")
        return {
            'impact_score': safe_float(data.get('impact_score')),
            'zero_echo_score': safe_float(data.get('zero_echo_score', 5.0)),
            'evidence': data.get('evidence', {}),
            'impact_evidence': data.get('impact_evidence', {}),
            'schema_version': SCHEMA_LEGACY
        }
