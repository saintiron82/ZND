"""
ZED Scoring Engine v9.0 (V1.0 Only)

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


def detect_schema_version(data: dict) -> str:
    """
    Detect schema version from 'version' field.
    
    Returns:
        SCHEMA_V1_0 if version contains '1.0'
        SCHEMA_LEGACY otherwise
    """
    if not data or not isinstance(data, dict):
        return SCHEMA_LEGACY
    
    # Check version fields (multiple locations)
    meta = data.get('Meta', {})
    version = (
        data.get('version', '') or  # 캐시에 저장된 버전 필드 (우선)
        meta.get('Specification_Version', '') or 
        data.get('Specification_Version', '') or
        data.get('schema_version', '')
    )
    
    if version and '1.0' in str(version):
        print(f"✅ [ScoreEngine] Detected V1.0: {version}")
        return SCHEMA_V1_0
    
    print(f"⚠️ [ScoreEngine] Version not found: '{version}' → Legacy")
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


def process_raw_analysis(raw: dict, force_schema_version: str = None) -> dict:
    """
    Process raw_analysis data to generate final scores.
    Supports V1.0 and Legacy only.
    
    Args:
        raw: Analysis data dict
        force_schema_version: Optional. Force a specific schema version
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
    
    # V1.0 Schema
    if schema_version == SCHEMA_V1_0:
        result = {'version': 'V1.0'}
        
        # Meta Fields
        meta = data.get('Meta', {})
        if meta.get('Headline'): 
            result['title_ko'] = meta['Headline']
        elif data.get('Headline'):
            result['title_ko'] = data['Headline']
        elif data.get('title_ko'):
            result['title_ko'] = data['title_ko']
            
        if meta.get('Summary'): 
            result['summary'] = meta['Summary']
        elif data.get('summary'):
            result['summary'] = data['summary']
            
        if data.get('Article_ID'): 
            result['article_id'] = data['Article_ID']
            
        # [NEW] Extract Category if present
        if data.get('Category'):
            result['category'] = data['Category']
        elif data.get('category'):
            result['category'] = data['category']
        elif meta.get('Category'):
            result['category'] = meta['Category']
        
        # IS Calculation
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
            
        # ZES Calculation
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
    
    # Legacy Schema (fallback)
    else:
        print("⚠️ [ScoreEngine] Using Legacy fallback")
        result = {
            'version': 'Legacy',
            'impact_score': safe_float(data.get('impact_score')),
            'zero_echo_score': safe_float(data.get('zero_echo_score', 5.0)),
            'evidence': data.get('evidence', {}),
            'impact_evidence': data.get('impact_evidence', {})
        }
        
        # Meta Fields (title_ko, summary)
        meta = data.get('Meta', {})
        if meta.get('Headline'):
            result['title_ko'] = meta['Headline']
        elif data.get('Headline'):
            result['title_ko'] = data['Headline']
        elif data.get('title_ko'):
            result['title_ko'] = data['title_ko']
            
        if meta.get('Summary') or meta.get('summary'):
            result['summary'] = meta.get('Summary') or meta.get('summary')
        elif data.get('summary'):
            result['summary'] = data['summary']
            
        # [NEW] Extract Category if present
        if data.get('Category'):
            result['category'] = data['Category']
        elif data.get('category'):
            result['category'] = data['category']
        elif meta.get('Category'):
            result['category'] = meta['Category']
        
        return result
