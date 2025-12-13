"""
ZED Scoring Engine v6.2

MLL의 raw_analysis 데이터에서 점수를 계산하는 엔진.

Extraction Logic:
- Type A (ID Matcher): Entity, Events, Modifiers - 일치 시 value 그대로 반환
- Type B (Intensity Meter): Penalties, Credits - 0.1~Max 강도 측정

Rules:
- Positive Only: 모든 value는 양수
- No Zero Return: value가 0인 항목은 무시
- ID Integrity: UPPER_SNAKE_CASE 유지

Score Formulas:
- ZES (Zero Echo Score) = 5 - penalties + credits + modifiers
- IS (Impact Score) = entity + Σ(events)
"""

from typing import Optional, Union


def safe_float(value: Union[str, int, float, None], default: float = 0.0) -> float:
    """
    문자열 또는 숫자를 안전하게 float로 변환.
    
    Args:
        value: 변환할 값 (str, int, float, None)
        default: 변환 실패 시 반환할 기본값
        
    Returns:
        변환된 float 값
    """
    if value is None:
        return default
    
    if isinstance(value, (int, float)):
        return float(value)
    
    if isinstance(value, str):
        try:
            # 공백 제거 후 변환
            cleaned = value.strip()
            if not cleaned:
                return default
            return float(cleaned)
        except ValueError:
            print(f"⚠️ [ScoreEngine] Cannot convert '{value}' to float, using default={default}")
            return default
    
    return default


def process_raw_analysis(raw: dict) -> dict:
    """
    raw_analysis 데이터를 처리하여 점수와 evidence를 생성.
    
    Args:
        raw: raw_analysis 딕셔너리
        
    Returns:
        {
            'impact_score': float,
            'zero_echo_score': float,
            'impact_evidence': dict,
            'evidence': dict
        }
    """
    if not raw or not isinstance(raw, dict):
        return {}
    
    # raw_analysis 추출 (중첩된 경우 처리)
    analysis = raw.get('raw_analysis', raw)
    
    # 각 요소 추출
    impact_entity = analysis.get('impact_entity')
    impact_events = analysis.get('impact_events', [])
    penalties = analysis.get('penalties', [])
    credits = analysis.get('credits', [])
    modifiers = analysis.get('modifiers', [])
    
    # 0값 필터링 (No Zero Return 규칙) - safe_float 사용
    penalties = [p for p in penalties if safe_float(p.get('value')) > 0]
    credits = [c for c in credits if safe_float(c.get('value')) > 0]
    modifiers = [m for m in modifiers if safe_float(m.get('value')) != 0]
    impact_events = [e for e in impact_events if safe_float(e.get('value')) > 0]
    
    # 점수 계산
    impact_score = calculate_impact_score(impact_entity, impact_events)
    zero_echo_score = calculate_zero_echo_score(penalties, credits, modifiers)
    
    # Evidence 구조 생성 (기존 형식 호환)
    evidence = build_evidence(penalties, credits, modifiers)
    impact_evidence = build_impact_evidence(impact_entity, impact_events)
    
    return {
        'impact_score': impact_score,
        'zero_echo_score': zero_echo_score,
        'impact_evidence': impact_evidence,
        'evidence': evidence
    }


def calculate_impact_score(entity: Optional[dict], events: list) -> float:
    """
    Impact Score 계산.
    
    Formula: entity.value + sum(events.value)
    
    Args:
        entity: impact_entity 딕셔너리 (id, value, reasoning)
        events: impact_events 리스트
        
    Returns:
        계산된 impact_score (0.0 ~ 10.0)
    """
    entity_val = 0.0
    entity_id = None
    events_info = []
    
    # Entity 점수 (safe_float로 문자열 처리)
    if entity and isinstance(entity, dict):
        entity_val = safe_float(entity.get('value'))
        entity_id = entity.get('id', 'UNKNOWN')
    
    # Events 점수 합산
    events_sum = 0.0
    if events and isinstance(events, list):
        for event in events:
            if isinstance(event, dict):
                val = safe_float(event.get('value'))
                events_sum += val
                events_info.append(f"{event.get('id', '?')}({val})")
    
    score = entity_val + events_sum
    
    # Clamp (0.0 ~ 10.0 범위 제한)
    score = max(0.0, min(10.0, score))
    score = round(score, 1)
    
    # 상세 로그
    e_str = f"{entity_id}({entity_val})" if entity_id else "0"
    ev_str = ", ".join(events_info) if events_info else "없음"
    print(f"📊 [IS] E={e_str} + Events=[{ev_str}] = {score}")
    return score


def calculate_zero_echo_score(
    penalties: list, 
    credits: list, 
    modifiers: list,
    base_score: float = 5.0
) -> float:
    """
    Zero Echo Score 계산.
    
    Formula: 5 + penalties - credits + modifiers
    (P = 노이즈 증가, C = 품질 증가로 노이즈 감소)
    
    Args:
        penalties: 페널티 리스트 (노이즈 증가 요소)
        credits: 크레딧 리스트 (품질 증가 요소)
        modifiers: 수정자 리스트 (조건부 가감)
        base_score: 기본 점수 (default: 5.0)
        
    Returns:
        계산된 zero_echo_score (0.0 ~ 10.0)
    """
    p_sum = 0.0
    c_sum = 0.0
    m_sum = 0.0
    p_info = []
    c_info = []
    m_info = []
    
    # Penalties 합산 (노이즈 증가)
    if penalties and isinstance(penalties, list):
        for item in penalties:
            if isinstance(item, dict):
                val = safe_float(item.get('value'))
                p_sum += val
                p_info.append(f"{item.get('id', '?')}({val})")
    
    # Credits 합산 (품질 증가 = 노이즈 감소)
    if credits and isinstance(credits, list):
        for item in credits:
            if isinstance(item, dict):
                val = safe_float(item.get('value'))
                c_sum += val
                c_info.append(f"{item.get('id', '?')}({val})")
    
    # Modifiers 합산
    if modifiers and isinstance(modifiers, list):
        for item in modifiers:
            if isinstance(item, dict):
                val = safe_float(item.get('value'))
                m_sum += val
                m_info.append(f"{item.get('id', '?')}({val})")
    
    # ZES = 5 + P - C + M (P는 노이즈 증가, C는 노이즈 감소)
    score = base_score + p_sum - c_sum + m_sum
    
    # Clamp (0.0 ~ 10.0 범위 제한)
    score = max(0.0, min(10.0, score))
    score = round(score, 1)
    
    # 상세 로그
    p_str = ", ".join(p_info) if p_info else "없음"
    c_str = ", ".join(c_info) if c_info else "없음"
    m_str = ", ".join(m_info) if m_info else "없음"
    print(f"📊 [ZES] 5 + P[{p_str}] - C[{c_str}] + M[{m_str}] = {score}")
    return score


def build_evidence(penalties: list, credits: list, modifiers: list) -> dict:
    """
    기존 evidence 형식 호환 데이터 생성.
    
    Args:
        penalties: 페널티 리스트
        credits: 크레딧 리스트
        modifiers: 수정자 리스트
        
    Returns:
        evidence 딕셔너리 (기존 형식)
    """
    return {
        'penalties': [
            {'id': p.get('id', 'UNKNOWN'), 'value': p.get('value', 0)}
            for p in penalties if isinstance(p, dict)
        ],
        'credits': [
            {'id': c.get('id', 'UNKNOWN'), 'value': c.get('value', 0)}
            for c in credits if isinstance(c, dict)
        ],
        'modifiers': [
            {'id': m.get('id', 'UNKNOWN'), 'value': m.get('value', 0)}
            for m in modifiers if isinstance(m, dict)
        ]
    }


def build_impact_evidence(entity: Optional[dict], events: list) -> dict:
    """
    Impact evidence 구조 생성.
    
    Args:
        entity: impact_entity 딕셔너리
        events: impact_events 리스트
        
    Returns:
        impact_evidence 딕셔너리
    """
    result = {}
    
    if entity and isinstance(entity, dict):
        result['entity'] = {
            'id': entity.get('id', 'UNKNOWN'),
            'weight': entity.get('value', 0),
            'reasoning': entity.get('reasoning', '')
        }
    
    if events and isinstance(events, list):
        result['events'] = [
            {
                'id': e.get('id', 'UNKNOWN'),
                'weight': e.get('value', 0),
                'reasoning': e.get('reasoning', '')
            }
            for e in events if isinstance(e, dict)
        ]
    
    return result
