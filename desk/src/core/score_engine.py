"""
ZED Scoring Engine v10.0 (ZES v1.2.1)

Supports:
- V1.0.0 Schema (IS_Analysis, ZES_Raw_Metrics)
- ZES v1.2.1 Formula: 70% Purity + 30% Utility (항목 레벨 노이즈 필터링)
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
    
    # [FIX] IW_Analysis is always inside Calculations
    iw_analysis = calculations.get('IW_Analysis', {})
    
    # [FIX] IE_Analysis can be at root (is_analysis) OR inside Calculations depending on LLM output
    ie_analysis = is_analysis.get('IE_Analysis') or calculations.get('IE_Analysis', {})
    
    # IW = Tier_Score + Gap_Score
    tier_val = iw_analysis.get('Tier_Score')
    if tier_val is None:
        tier_val = calculations.get('Tier_Score')
    tier_score = safe_float(tier_val)
    
    gap_val = iw_analysis.get('Gap_Score')
    if gap_val is None:
        gap_val = calculations.get('Gap_Score')
    gap_score = safe_float(gap_val)

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
    Calculate ZeroEcho Score using V1.2.1 formula.
    
    Philosophy: 70% Reliability (Purity) + 30% Utility
    - 항목 레벨 필터링: P1~P4 중 ≤1점은 0으로 처리 (1점 이하 노이즈 무시)
    - Purity = S × (1 - N/10)
    - ZES = 10 - ((Purity × 0.7) + (U × 0.3) + Fine_Adjustment)
    - Hard Cutoff: S < 4.0 → ZES = 10 (worst)
    """
    # --- Extract Signal (T1, T2, T3, T4) ---
    signal = zes_raw_metrics.get('Signal', {})
    signal_items = signal.get('Items', signal)
    t1 = safe_float(signal_items.get('T1', {}).get('Score') if isinstance(signal_items.get('T1'), dict) else signal_items.get('T1'))
    t2 = safe_float(signal_items.get('T2', {}).get('Score') if isinstance(signal_items.get('T2'), dict) else signal_items.get('T2'))
    t3 = safe_float(signal_items.get('T3', {}).get('Score') if isinstance(signal_items.get('T3'), dict) else signal_items.get('T3'))
    t4 = safe_float(signal_items.get('T4', {}).get('Score') if isinstance(signal_items.get('T4'), dict) else signal_items.get('T4'))
    
    # Aggregation: MAX + AVG * 0.25
    signal_scores = [t1, t2, t3, t4]
    s = max(signal_scores) + (sum(signal_scores) / 4.0) * 0.25
    s = min(10.0, s)  # Cap at 10
    
    # --- Extract Noise (P1, P2, P3, P4) ---
    noise = zes_raw_metrics.get('Noise', {})
    noise_items = noise.get('Items', noise)
    p1_raw = safe_float(noise_items.get('P1', {}).get('Score') if isinstance(noise_items.get('P1'), dict) else noise_items.get('P1'))
    p2_raw = safe_float(noise_items.get('P2', {}).get('Score') if isinstance(noise_items.get('P2'), dict) else noise_items.get('P2'))
    p3_raw = safe_float(noise_items.get('P3', {}).get('Score') if isinstance(noise_items.get('P3'), dict) else noise_items.get('P3'))
    p4_raw = safe_float(noise_items.get('P4', {}).get('Score') if isinstance(noise_items.get('P4'), dict) else noise_items.get('P4'))
    
    # [v1.2.1] 항목 레벨 필터링: ≤1 → 0 (1점 이하 노이즈는 무시)
    p1 = 0.0 if p1_raw <= 1.0 else p1_raw
    p2 = 0.0 if p2_raw <= 1.0 else p2_raw
    p3 = 0.0 if p3_raw <= 1.0 else p3_raw
    p4 = 0.0 if p4_raw <= 1.0 else p4_raw
    
    # Aggregation: MAX + AVG * 0.25
    noise_scores = [p1, p2, p3, p4]
    n = max(noise_scores) + (sum(noise_scores) / 4.0) * 0.25
    n = min(10.0, n)  # Cap at 10
    
    # --- Extract Utility (V1, V2, V3, V4) ---
    utility = zes_raw_metrics.get('Utility', {})
    utility_items = utility.get('Items', utility)
    v1 = safe_float(utility_items.get('V1', {}).get('Score') if isinstance(utility_items.get('V1'), dict) else utility_items.get('V1'))
    v2 = safe_float(utility_items.get('V2', {}).get('Score') if isinstance(utility_items.get('V2'), dict) else utility_items.get('V2'))
    v3 = safe_float(utility_items.get('V3', {}).get('Score') if isinstance(utility_items.get('V3'), dict) else utility_items.get('V3'))
    v4 = safe_float(utility_items.get('V4', {}).get('Score') if isinstance(utility_items.get('V4'), dict) else utility_items.get('V4'))
    
    # Aggregation: MAX + AVG * 0.25
    utility_scores = [v1, v2, v3, v4]
    u = max(utility_scores) + (sum(utility_scores) / 4.0) * 0.25
    u = min(10.0, u)  # Cap at 10
    
    # --- Extract Fine Adjustment ---
    fine_adj_obj = zes_raw_metrics.get('Fine_Adjustment', {})
    fine_adjustment = safe_float(fine_adj_obj.get('Score'))
    
    # --- ZES v1.2.1 Formula ---
    # 1. Hard Cutoff: S < 4.0 → ZES = 10 (worst score)
    if s < 4.0:
        zero_echo_score = 10.0  # 최악의 점수 (낮을수록 좋음이므로 10이 최악)
        purity = 0.0
        quality_score = 0.0
        print(f"⚠️ [ZES v1.2.1] Hard Cutoff: S={s:.2f} < 4.0 → ZES=10 (worst)")
    else:
        # 2. Purity = S × (1 - N/10)  [v1.2.1: 항목 레벨에서 이미 ≤1 필터링됨]
        noise_penalty = n / 10.0
        purity = s * (1.0 - noise_penalty)
        
        # 3. Quality Score = (Purity × 0.7) + (U × 0.3) + Fine_Adjustment
        quality_score = (purity * 0.7) + (u * 0.3) + fine_adjustment
        
        # 4. ZES = 10 - Quality Score (낮을수록 좋음!)
        zes_raw = 10.0 - quality_score
        
        # 5. Clipping & Rounding
        zero_echo_score = max(0.0, min(10.0, round(zes_raw, 2)))
    
    breakdown = {
        'Signal': {'T1': t1, 'T2': t2, 'T3': t3, 'T4': t4, 'S_Agg': round(s, 2)},
        'Noise': {
            'P1_Raw': p1_raw, 'P2_Raw': p2_raw, 'P3_Raw': p3_raw, 'P4_Raw': p4_raw,
            'P1': p1, 'P2': p2, 'P3': p3, 'P4': p4, 
            'N_Agg': round(n, 2)
        },
        'Utility': {'V1': v1, 'V2': v2, 'V3': v3, 'V4': v4, 'U_Agg': round(u, 2)},
        'Purity': round(purity, 2),
        'Fine_Adjustment': fine_adjustment,
        'Quality_Score': round(quality_score, 2) if s >= 4.0 else 0.0,
        'ZES_Final': zero_echo_score,
        'Formula': 'v1.2.1'
    }
    
    print(f"✅ [ZES v1.2.1] S={s:.2f}, N={n:.2f}, U={u:.2f} → Purity={purity:.2f} → Quality={quality_score:.2f} → ZES={zero_echo_score} (lower=better)")
    
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
        
        # [NEW] Extract Tags if present
        if meta.get('Tags'):
            result['tags'] = meta['Tags']
        elif data.get('Tags'):
            result['tags'] = data['Tags']
        elif data.get('tags'):
            result['tags'] = data['tags']

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
