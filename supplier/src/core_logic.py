"""
Core Logic Module for ZED Crawler System

This module contains shared logic between auto-crawler and manual-crawler.
All crawler components should import from this module to ensure consistency.
"""

import os
import json
import glob
import hashlib
from datetime import datetime, timezone

# Base directories (relative to supplier folder)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, 'data')
CACHE_DIR = os.path.join(BASE_DIR, 'cache')
CONFIG_DIR = os.path.join(BASE_DIR, 'config')

# Configuration file path
AUTOMATION_CONFIG_PATH = os.path.join(CONFIG_DIR, 'automation_config.json')

# Cached config (loaded once)
_automation_config = None


def load_automation_config(force_reload: bool = False) -> dict:
    """
    Load automation configuration from JSON file.
    Caches the config after first load for performance.
    
    Args:
        force_reload: If True, reload from disk even if cached
    
    Returns:
        Configuration dict
    """
    global _automation_config
    
    if _automation_config is not None and not force_reload:
        return _automation_config
    
    try:
        if os.path.exists(AUTOMATION_CONFIG_PATH):
            with open(AUTOMATION_CONFIG_PATH, 'r', encoding='utf-8') as f:
                _automation_config = json.load(f)
                print(f"✅ [Config] Loaded automation config from {AUTOMATION_CONFIG_PATH}")
        else:
            print(f"⚠️ [Config] No automation config found, using defaults")
            _automation_config = get_default_config()
    except Exception as e:
        print(f"❌ [Config] Error loading config: {e}, using defaults")
        _automation_config = get_default_config()
    
    return _automation_config


def get_default_config() -> dict:
    """Return default configuration values."""
    return {
        "mll": {
            "api_url": "http://localhost:8000/",
            "timeout_seconds": 30,
            "retry_count": 3,
            "enabled": True
        },
        "crawler": {
            "max_concurrency": 5,
            "use_playwright": True,
            "headless": True,
            "article_age_limit_days": 3,
            "min_text_length": 200,
            "max_text_length_for_analysis": 3000
        },
        "scoring": {
            "high_noise_threshold": 7.0,
            "auto_reject_high_noise": True
        },
        "history": {
            "max_entries": 5000
        }
    }


def get_config(section: str, key: str, default=None):
    """
    Get a specific config value.
    
    Args:
        section: Config section (e.g., 'mll', 'crawler', 'scoring')
        key: Config key within section
        default: Default value if not found
    
    Returns:
        Config value or default
    """
    config = load_automation_config()
    return config.get(section, {}).get(key, default)


# ==============================================================================
# URL Hash & Article ID Generation
# ==============================================================================

def get_url_hash(url: str, length: int = 12) -> str:
    """
    Generate a hash from URL for cache/data filename.
    
    Args:
        url: The URL to hash
        length: Length of hash to return (default 12)
    
    Returns:
        MD5 hash string truncated to specified length
    """
    return hashlib.md5(url.encode()).hexdigest()[:length]


def get_article_id(url: str) -> str:
    """
    Generate article_id from URL.
    Uses 6-character hash to match manual crawler convention.
    
    Args:
        url: The article URL
    
    Returns:
        6-character article ID
    """
    return get_url_hash(url, length=6)


# ==============================================================================
# Cache Management
# ==============================================================================

def get_cache_path(url: str, date_str: str = None) -> str:
    """
    Get cache file path for URL.
    
    Args:
        url: The URL to get cache path for
        date_str: Date string in YYYY-MM-DD format. Defaults to today.
    
    Returns:
        Full path to cache file
    """
    if date_str is None:
        date_str = datetime.now().strftime('%Y-%m-%d')
    url_hash = get_url_hash(url)
    cache_dir = os.path.join(CACHE_DIR, date_str)
    return os.path.join(cache_dir, f'{url_hash}.json')


def load_from_cache(url: str) -> dict | None:
    """
    Load cached content for URL.
    Searches ALL date folders, not just today.
    
    Args:
        url: The URL to find in cache
    
    Returns:
        Cached data dict or None if not found
    """
    url_hash = get_url_hash(url)
    filename = f'{url_hash}.json'
    
    # Search all date folders for this URL's cache
    if os.path.exists(CACHE_DIR):
        for date_folder in os.listdir(CACHE_DIR):
            date_path = os.path.join(CACHE_DIR, date_folder)
            if not os.path.isdir(date_path):
                continue
            cache_path = os.path.join(date_path, filename)
            if os.path.exists(cache_path):
                try:
                    with open(cache_path, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                        print(f"📦 [Cache] Loaded from cache ({date_folder}): {url[:50]}...")
                        return data
                except Exception as e:
                    print(f"⚠️ [Cache] Error reading cache: {e}")
    return None


def save_to_cache(url: str, content: dict, date_str: str = None) -> str:
    """
    Save content to cache for URL.
    Auto-generates article_id and cached_at if not present.
    
    Args:
        url: The URL to cache
        content: Content dict to save
        date_str: Optional date string (defaults to today)
    
    Returns:
        Path to saved cache file
    """
    cache_path = get_cache_path(url, date_str)
    cache_dir = os.path.dirname(cache_path)
    
    # Auto-generate article_id if not present (using 6-char convention)
    if 'article_id' not in content:
        content['article_id'] = get_article_id(url)
    
    # Auto-add cached_at timestamp if not present
    if 'cached_at' not in content:
        content['cached_at'] = datetime.now(timezone.utc).isoformat()
    
    try:
        os.makedirs(cache_dir, exist_ok=True)
        with open(cache_path, 'w', encoding='utf-8') as f:
            json.dump(content, f, ensure_ascii=False, indent=2)
        print(f"💾 [Cache] Saved to cache: {url[:50]}...")
        return cache_path
    except Exception as e:
        print(f"⚠️ [Cache] Error saving cache: {e}")
        return None


# ==============================================================================
# Field Normalization
# ==============================================================================

def normalize_field_names(data: dict) -> dict:
    """
    Normalize field names to handle case variations and nested structures.
    Supports:
    1. Nested 'Impact' object -> top-level 'impact_score', 'impact_evidence'
    2. Nested 'ZeroEcho' object -> top-level 'zero_echo_score', 'evidence'
    3. Case variations (Zero_Echo_Score -> zero_echo_score)
    4. Legacy field migration (zero_noise_score -> zero_echo_score)
    
    Args:
        data: Input data dict
    
    Returns:
        Normalized flat data dict
    """
    if not isinstance(data, dict):
        return data
    
    normalized = dict(data)
    
    # --- 0. Unwrap 'response_schema' if present (Support for structured output) ---
    if 'response_schema' in normalized and isinstance(normalized['response_schema'], dict):
        print(f"[Normalize] Unwrapped 'response_schema' layer")
        # Merge schema content into top level
        # We prioritize schema content, but keep existing top-level keys if not in schema
        schema_content = normalized.pop('response_schema')
        for k, v in schema_content.items():
            normalized[k] = v
            
    # --- 1. Flatten 'Impact' Object ---
    if 'Impact' in normalized and isinstance(normalized['Impact'], dict):
        impact_obj = normalized['Impact']
        # Extract impact_score
        if 'impact_score' not in normalized and 'impact_score' in impact_obj:
            normalized['impact_score'] = impact_obj['impact_score']
        
        # Extract evidence/review if needed
        if 'impact_evidence' in impact_obj:
            # If compatible with top-level format, move it
            if 'impact_evidence' not in normalized:
                normalized['impact_evidence'] = impact_obj['impact_evidence']
        
        # Extract reviews
        if 'impact_review_ko' in impact_obj:
            normalized['impact_review_ko'] = impact_obj['impact_review_ko']
        if 'impact_review_en' in impact_obj:
            normalized['impact_review_en'] = impact_obj['impact_review_en']
            
    # --- 2. Flatten 'ZeroEcho' Object ---
    if 'ZeroEcho' in normalized and isinstance(normalized['ZeroEcho'], dict):
        ze_obj = normalized['ZeroEcho']
        
        # Extract ZeroEchoScore (handle case variations inside object)
        ze_score = ze_obj.get('ZeroEchoScore') or ze_obj.get('zero_echo_score') or ze_obj.get('Zero_Echo_Score')
        if ze_score is not None:
            normalized['zero_echo_score'] = ze_score
            
        # Extract Evidence (penalties, credits, modifiers)
        # We need to construct the 'evidence' object expected by the system
        evidence_structure = {
            "penalties": ze_obj.get('penalties', []),
            "credits": ze_obj.get('credits', []),
            "modifiers": ze_obj.get('modifiers', [])
        }
        
        # Only set if not already present (or if present is empty)
        if 'evidence' not in normalized or not normalized['evidence']:
            normalized['evidence'] = evidence_structure
            
        # Extract reviews
        if 'zeroechoscore_review_ko' in ze_obj:
            normalized['zeroechoscore_review_ko'] = ze_obj['zeroechoscore_review_ko']
        if 'zeroechoscore_review_en' in ze_obj:
            normalized['zeroechoscore_review_en'] = ze_obj['zeroechoscore_review_en']

    # --- 3. Top-level Normalization & Cleanup ---
    keys_to_check = list(normalized.keys())
    for key in keys_to_check:
        key_lower = key.lower()
        
        # Handle zero_echo_score variations
        if key_lower in ['zero_echo_score', 'zeroechoscore', 'zero_echo'] and key != 'zero_echo_score':
            if 'zero_echo_score' not in normalized:
                normalized['zero_echo_score'] = normalized.pop(key)
                print(f"[Normalize] Renamed '{key}' to 'zero_echo_score'")
            else:
                # Duplicate, just remove the non-standard one
                normalized.pop(key)
                
        # Handle legacy zero_noise_score
        elif key_lower == 'zero_noise_score':
            if 'zero_echo_score' not in normalized:
                normalized['zero_echo_score'] = normalized.pop(key)
                print(f"[Normalize] Migrated '{key}' to 'zero_echo_score'")
            else:
                normalized.pop(key)

        # Handle Impact Score variations
        elif key_lower == 'impact_score' and key != 'impact_score':
             if 'impact_score' not in normalized:
                normalized['impact_score'] = normalized.pop(key)

    # Ensure scores are float/int
    if 'impact_score' in normalized:
        try:
            normalized['impact_score'] = float(normalized['impact_score'])
        except:
            pass
            
    if 'zero_echo_score' in normalized:
        try:
            normalized['zero_echo_score'] = float(normalized['zero_echo_score'])
        except:
            pass

    return recalculate_scores(normalized)


def recalculate_scores(data: dict) -> dict:
    """
    Recalculate scores based on evidence to ensure integrity.
    
    Logic:
    - Zero Echo Score:
        - Base: 5.0
        - Credits: Add values
        - Penalties: Subtract values
        - Limit: 0.0 ~ 10.0
        
    Args:
        data: Normalized data dict
        
    Returns:
        Data dict with validated stores
    """
    # 1. Zero Echo Score Validation
    if 'evidence' in data and isinstance(data['evidence'], dict):
        evidence = data['evidence']
        
        # Calculate calculated_score
        # Base Score is 5.0 (Standard starting point)
        calculated_score = 5.0
        
        # Add Credits
        credits_list = evidence.get('credits', [])
        if isinstance(credits_list, list):
            for item in credits_list:
                val = float(item.get('value', 0))
                calculated_score += val
                
        # Subtract Penalties
        penalties_list = evidence.get('penalties', [])
        if isinstance(penalties_list, list):
            for item in penalties_list:
                val = float(item.get('value', 0))
                calculated_score -= val
                
        # Clamp to 0.0 - 10.0
        calculated_score = max(0.0, min(10.0, calculated_score))
        calculated_score = round(calculated_score, 1)
        
        # Compare with existing score
        original_score = float(data.get('zero_echo_score', 0))
        
        if abs(original_score - calculated_score) > 0.1:
            print(f"⚠️ [Score Correction] ZeroEcho: {original_score} -> {calculated_score} (Based on Evidence)")
            data['zero_echo_score'] = calculated_score
            data['score_corrected'] = True
            
        # Ensure it's set if missing
        if 'zero_echo_score' not in data:
            data['zero_echo_score'] = calculated_score

    return data


# ==============================================================================
# Manifest (index.json) Management
# ==============================================================================

def update_manifest(date_str: str) -> bool:
    """
    Updates or creates index.json for the given date directory.
    Aggregates all .json files (excluding index.json, daily_summary.json) 
    and saves them as a list sorted by impact_score.
    
    Args:
        date_str: Date string in YYYY-MM-DD format
    
    Returns:
        True if successful, False otherwise
    """
    try:
        dir_path = os.path.join(DATA_DIR, date_str)
        if not os.path.exists(dir_path):
            return False
            
        json_files = glob.glob(os.path.join(dir_path, '*.json'))
        articles = []
        
        for json_file in json_files:
            basename = os.path.basename(json_file)
            if basename in ['index.json', 'daily_summary.json']:
                continue
                
            try:
                with open(json_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    
                    # Extract article_id from data or filename
                    article_id = data.get('article_id')
                    if not article_id:
                        parts = basename.replace('.json', '').split('_')
                        article_id = parts[-1] if len(parts) > 1 else basename.replace('.json', '')
                    
                    # Get impact_score for sorting
                    impact_score = data.get('impact_score', 0)
                    
                    # Lightweight index entry: only article_id and filename
                    articles.append({
                        "article_id": article_id,
                        "filename": basename,
                        "impact_score": impact_score  # Keep for sorting, can be used for quick filtering
                    })
            except Exception as e:
                print(f"Error reading {json_file}: {e}")

        # Sort by Impact Score Descending
        articles.sort(key=lambda x: x.get('impact_score', 0), reverse=True)

        manifest = {
            "date": date_str,
            "updated_at": datetime.now().isoformat(),
            "count": len(articles),
            "articles": articles
        }

        manifest_path = os.path.join(dir_path, 'index.json')
        with open(manifest_path, 'w', encoding='utf-8') as f:
            json.dump(manifest, f, ensure_ascii=False, indent=2)
            
        print(f"✅ [Manifest] Updated index.json for {date_str}")
        return True
        
    except Exception as e:
        print(f"❌ [Manifest] Error updating manifest: {e}")
        return False


# ==============================================================================
# URL Normalization (for deduplication)
# ==============================================================================

def normalize_url_for_dedupe(url: str) -> str:
    """
    Normalize URL for deduplication check.
    Ignores scheme (http/https) and trailing slash.
    
    Args:
        url: URL to normalize
    
    Returns:
        Normalized URL string
    """
    if not url:
        return ""
    
    try:
        norm = url.strip()
        
        # Remove scheme
        if norm.startswith('https://'):
            norm = norm[8:]
        elif norm.startswith('http://'):
            norm = norm[7:]
            
        # Remove trailing slash
        if norm.endswith('/'):
            norm = norm[:-1]
            
        return norm
    except:
        return url


# ==============================================================================
# History Status Constants
# ==============================================================================

class HistoryStatus:
    """Valid history status values."""
    ACCEPTED = 'ACCEPTED'
    REJECTED = 'REJECTED'
    SKIPPED = 'SKIPPED'
    WORTHLESS = 'WORTHLESS'
    MLL_FAILED = 'MLL_FAILED'  # NEW: LLM response failed


# ==============================================================================
# Data File Naming
# ==============================================================================

def get_data_filename(source_id: str, url: str) -> str:
    """
    Generate data filename using source_id and URL hash.
    Format: {source_id}_{url_hash_8}.json
    
    Args:
        source_id: Source identifier (e.g., 'aitimes', 'venturebeat')
        url: Article URL
    
    Returns:
        Filename string
    """
    url_hash = get_url_hash(url, length=8)
    return f"{source_id}_{url_hash}.json"
