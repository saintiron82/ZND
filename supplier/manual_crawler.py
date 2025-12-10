import os
import json
import asyncio
import glob
from flask import Flask, render_template, request, jsonify
from crawler import load_targets, fetch_links
from src.db_client import DBClient
from src.crawler.utils import RobotsChecker
from src.crawler.core import AsyncCrawler
from datetime import datetime, timezone

app = Flask(__name__)
db = DBClient()
robots_checker = RobotsChecker()
DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')

def update_manifest(date_str):
    """
    Updates or creates index.json for the given date directory.
    Aggregates all .json files (excluding index.json) and saves them as a list.
    """
    try:
        dir_path = os.path.join(DATA_DIR, date_str)
        if not os.path.exists(dir_path):
            return 
            
        json_files = glob.glob(os.path.join(dir_path, '*.json'))
        articles = []
        
        for json_file in json_files:
            if os.path.basename(json_file) == 'index.json':
                continue
                
            try:
                with open(json_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    
                    # [CRITICAL] Inject ID if missing
                    if 'id' not in data:
                         filename = os.path.basename(json_file)
                         parts = filename.replace('.json', '').split('_')
                         if len(parts) > 1:
                             data['id'] = parts[-1]
                         else:
                             data['id'] = filename
                             
                    articles.append(data)
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
        
    except Exception as e:
        print(f"❌ [Manifest] Error updating manifest: {e}")

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/inspector')
def inspector():
    return render_template('inspector.html')

@app.route('/api/targets')
def get_targets():
    targets = load_targets()
    return jsonify(targets)

@app.route('/api/fetch')
def fetch():
    target_id = request.args.get('target_id')
    targets = load_targets()
    
    selected_targets = []
    if target_id == 'all':
        selected_targets = targets
    else:
        found = next((t for t in targets if t['id'] == target_id), None)
        if found:
            selected_targets = [found]
    
    if not selected_targets:
        return jsonify({'error': 'Target not found'}), 404
        
    all_links = []
    
    for target in selected_targets:
        links = fetch_links(target)
        
        # Apply limit per targets
        limit = target.get('limit', 5)
        if limit:
            links = links[:limit]
            
        # Store as tuple (url, source_id)
        for link in links:
             all_links.append((link, target['id']))
    
    # Return all links with status
    link_data = []
    seen_urls = set()
    
    for link_tuple in all_links:
        url = link_tuple[0]
        source_id = link_tuple[1]
        
        if url in seen_urls: continue
        seen_urls.add(url)
        
        status = db.get_history_status(url)
        link_data.append({
            'url': url,
            'source_id': source_id,
            'status': status if status else 'NEW'
        })
            
    return jsonify({'links': link_data, 'total': len(link_data)})

@app.route('/api/extract')
def extract():
    url = request.args.get('url')
    if not url:
        return jsonify({'error': 'URL is required'}), 400

    # [NEW] Check if file exists physically first (Robustness)
    existing_data = db.find_article_by_url(url)
    if existing_data:
        print(f"♻️ [Extract] Loaded existing data from generic search for: {url}")
        return jsonify(existing_data)

    # Check robots.txt (Checking afterwards is fine, but if we have data we skip fetch)
    if not robots_checker.can_fetch(url):
        return jsonify({'error': 'Disallowed by robots.txt'}), 403

    # Check history logic as fallback or for other statuses
    if db.check_history(url):
        status = db.get_history_status(url)
        # If it was skipped/worthless, maybe we still want to re-crawl or show status?
        # But if it was ACCEPTED, find_article_by_url should have caught it.
        # If file is missing but history says ACCEPTED, we might need to re-crawl.
        if status == 'ACCEPTED':
             pass # Already handled by find_article_by_url or file is missing
        elif status in ['SKIPPED', 'WORTHLESS', 'INVALID']:
             # Optionally warn user? For now, we proceed to crawl if user requested specifically?
             # Or just return empty/error?
             # Let's let it re-crawl if the user explicitly clicked it, unless strictly blocked.
             pass
        
    async def get_data():
        # Use Playwright for best compatibility in manual mode too
        crawler = AsyncCrawler(use_playwright=True) 
        try:
            await crawler.start()
            return await crawler.process_url(url)
        finally:
            await crawler.close()

    try:
        content = asyncio.run(get_data())
    except Exception as e:
        return jsonify({'error': f"Extraction failed: {str(e)}"}), 500

    if not content:
        return jsonify({'error': 'Failed to extract content'}), 500

    # [NEW] Check content length
    text_len = len(content.get('text', ''))
    if text_len < 200:
        db.save_history(url, 'WORTHLESS', reason='text_too_short_manual')
        print(f"⚠️ [Manual Extract] Text too short ({text_len}), marked as WORTHLESS: {url}")
        return jsonify({'error': f"Article content too short ({text_len} chars). Marked as WORTHLESS."}), 400
        
    return jsonify(content)

@app.route('/api/extract_batch', methods=['POST'])
def extract_batch():
    data = request.json
    urls = data.get('urls', [])
    
    if not urls:
        return jsonify([])

    async def get_data_batch(url_list):
        crawler = AsyncCrawler(use_playwright=True)
        try:
            await crawler.start()
            # process_urls is faster than process_url in loop
            return await crawler.process_urls(url_list)
        finally:
            await crawler.close()

    try:
        results = asyncio.run(get_data_batch(urls))
        
        # [NEW] Filter worthless
        valid_results = []
        for res in results:
            text_len = len(res.get('text', ''))
            if text_len < 200:
                 db.save_history(res['url'], 'WORTHLESS', reason='text_too_short_manual_batch')
                 print(f"⚠️ [Manual Batch] Text too short ({text_len}), marked as WORTHLESS: {res['url']}")
            else:
                 valid_results.append(res)

        return jsonify(valid_results)
    except Exception as e:
        return jsonify({'error': f"Batch extraction failed: {str(e)}"}), 500

@app.route('/api/save', methods=['POST'])
def save():
    data = request.json
    
    # Validate required fields
    required_fields = ['url', 'source_id', 'title_ko', 'summary', 'zero_noise_score', 'impact_score', 'original_title']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'Missing field: {field}'}), 400
            
    # Construct final document
    # Start with request data to include all extra fields (tags, evidence, etc.)
    final_doc = data.copy()
    
    # Ensure critical fields are set/overwritten correctly
    final_doc.update({
        "url": data['url'],
        "source_id": data['source_id'],
        "title_ko": data['title_ko'],
        "summary": data['summary'],
        "zero_noise_score": float(data['zero_noise_score']),
        "impact_score": float(data['impact_score']),
        "original_title": data['original_title'],
        "crawled_at": datetime.now(timezone.utc).isoformat()
    })
    
    # [NEW] Check Noise Score (NS >= 7 -> Worthless)
    if float(data['zero_noise_score']) >= 7.0:
        print(f"⚠️ [Manual Save] ZS is high ({data['zero_noise_score']}), marking as WORTHLESS.")
        db.save_history(data['url'], 'WORTHLESS', reason='high_noise_manual_save')
        return jsonify({'error': 'Article has High Noise (>= 7). Marked as WORTHLESS and not saved.'}), 400

    try:
        print(f"💾 [Manual Save] Saving article: {final_doc.get('title_ko')}")
        db.save_article(final_doc)
        
        # [NEW] Update Manifest
        # Extract date from crawled_at which we just set
        date_str = final_doc['crawled_at'].split('T')[0]
        update_manifest(date_str)
        
        return jsonify({'status': 'success'})
    except Exception as e:
        print(f"❌ [Manual Save] Error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/skip', methods=['POST'])
def skip():
    data = request.json
    url = data.get('url')
    reason = data.get('reason', 'manual_skip')
    
    if not url:
        return jsonify({'error': 'URL is required'}), 400
        
    try:
        db.save_history(url, 'SKIPPED', reason=reason)
        return jsonify({'status': 'success'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/check_quality', methods=['POST'])
def check_quality():
    data = request.json
    urls = data.get('urls', [])
    
    if not urls:
        return jsonify([])
        
    async def check_urls(url_list):
        import aiohttp
        results = []
        async with aiohttp.ClientSession() as session:
            for url in url_list:
                try:
                    # Fast check: just get headers or small body
                    # But we need body length for "invalid content" check
                    # Use a short timeout
                    async with session.get(url, timeout=5, ssl=False) as response:
                        if response.status != 200:
                            results.append({'url': url, 'status': 'invalid'})
                            continue
                        
                        # Read first 10KB to check if it's empty
                        content = await response.content.read(10240) 
                        text = content.decode('utf-8', errors='ignore')
                        
                        # Very basic heuristic: if body text is too short
                        # This is rough because we are reading raw HTML
                        if len(text) < 500: 
                             results.append({'url': url, 'status': 'invalid'})
                        else:
                             results.append({'url': url, 'status': 'valid'})
                except Exception:
                    results.append({'url': url, 'status': 'invalid'})
        return results

    try:
        return jsonify(results)
    except Exception as e:
        return jsonify({'error': str(e)}), 500



def _calculate_scores(data):
    """
    Helper function to calculate ZeroNoise Score and Impact Score based on evidence.
    Returns a dictionary with calculated values and breakdown.
    """
    # 1. Base Score
    V = 5.0
    
    # 2. Credits (Good -> Reduce Noise)
    evidence = data.get('evidence', {})
    credits = evidence.get('credits', [])
    credit_sum = sum(float(item.get('value', 0.0)) for item in credits)
    V -= credit_sum # 5.0 - Credits
    
    # 3. Penalties (Bad -> Increase Noise)
    penalties = evidence.get('penalties', [])
    penalty_sum = sum(float(item.get('value', 0.0)) for item in penalties)
    V += penalty_sum # (5.0 - Credits) + Penalties
    
    # 4. Modifiers (Effect > 0 means Good -> Reduces Noise)
    modifiers = evidence.get('modifiers', [])
    modifier_sum = sum(float(item.get('effect', 0.0)) for item in modifiers)
    # If modifier effect is positive (good), it reduces noise. 
    # If negative (bad), it increases noise? 
    # Logic in verify_score was: V -= effect. 
    # Let's keep consistency: ZS = ZS_prev - effect.
    V -= modifier_sum 
    
    ZS = V
    
    # 5. Clamping (0.0 to 10.0)
    ZS_final = max(0.0, min(10.0, ZS))
    
    # 6. Impact Score
    impact_evidence = data.get('impact_evidence', {})
    entity = impact_evidence.get('entity', {})
    entity_weight = float(entity.get('weight', 0.0))
    
    events = impact_evidence.get('events', [])
    event_weight_sum = sum(float(ev.get('weight', 0.0)) for ev in events)
        
    calculated_impact = round(entity_weight + event_weight_sum, 2)
    
    return {
        'zs_final': round(ZS_final, 2),
        'zs_raw': ZS,
        'impact_score': calculated_impact,
        'breakdown': {
            'base': 5.0,
            'credits': credits,
            'penalties': penalties,
            'modifiers': modifiers,
            'credits_sum': credit_sum,
            'penalties_sum': penalty_sum,
            'modifiers_sum': modifier_sum,
            'zs_raw': ZS,
            'zs_clamped': ZS_final,
            'impact_entity': entity,
            'impact_events': events,
            'impact_calc': calculated_impact
        }
    }

@app.route('/api/verify_score', methods=['POST'])
def verify_score():
    data = request.json
    try:
        calc_result = _calculate_scores(data)
        
        calculated_zs = calc_result['zs_final']
        calculated_impact = calc_result['impact_score']
        breakdown = calc_result['breakdown']
        
        # ZS Check
        recorded_zs = float(data.get('zero_noise_score', 0))
        diff = abs(recorded_zs - calculated_zs)
        is_match = (diff <= 0.1)
        
        # Impact Check
        recorded_impact = float(data.get('impact_score', 0))
        impact_diff = abs(recorded_impact - calculated_impact)
        impact_match = (impact_diff <= 0.1)
        
        # Add rec info to breakdown for UI
        breakdown['impact_rec'] = recorded_impact
        breakdown['impact_diff'] = impact_diff
        
        debug_info = {
            'calculated_zs': calculated_zs,
            'recorded_zs': recorded_zs,
            'diff': f"{diff:.2f}",
            'Impact Calc': calculated_impact,
            'Impact Rec': recorded_impact
        }
        
        return jsonify({
            'match': is_match,
            'impact_match': impact_match,
            'calculated_zs': calculated_zs,
            'diff': diff,
            'debug': debug_info,
            'breakdown': breakdown,
            'message': 'Score Match' if is_match else f'Mismatch! Calc: {calculated_zs} vs Rec: {recorded_zs}'
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/inject_correction', methods=['POST'])
def inject_correction():
    data = request.json
    url = data.get('url')
    
    if not url:
        return jsonify({'error': 'URL is required'}), 400
        
    try:
        # [NEW] Recalculate scores based on valid evidence
        scores = _calculate_scores(data)
        
        # Update data with calculated scores
        data['zero_noise_score'] = scores['zs_final']
        data['impact_score'] = scores['impact_score']

        # [NEW] Check Noise Score (NS >= 7 -> Worthless)
        if scores['zs_final'] >= 7.0:
             print(f"⚠️ [Inject] ZS is high ({scores['zs_final']}), marking as WORTHLESS.")
             db.save_history(url, 'WORTHLESS', reason='high_noise_manual_inject')
             return jsonify({
                 'status': 'error', 
                 'error': f"Article has High Noise ({scores['zs_final']}). Marked as WORTHLESS and NOT saved."
             }), 400

        # [NEW] Force update date to NOW (execution time) so it saves in today's folder
        now_utc = datetime.now(timezone.utc)
        data['crawled_at'] = now_utc.isoformat()
        
        success, message = db.inject_correction_with_backup(data, url)
        
        # [NEW] Update Manifest
        try:
            # Extract date from crawled_at or use current date if needed
            # crawled_at format: "2025-12-09T..."
            crawled_at = data.get('crawled_at')
            if crawled_at:
                date_str = crawled_at.split('T')[0]
                update_manifest(date_str)
        except Exception as e:
            print(f"Warning: Failed to update manifest after injection: {e}")
        
        if success:
            return jsonify({
                'status': 'success', 
                'message': f"{message} (ZS updated to {scores['zs_final']}, Impact to {scores['impact_score']})",
                'new_scores': scores
            })
        else:
            return jsonify({'error': message}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/worthless', methods=['POST'])
def mark_worthless():
    data = request.json
    url = data.get('url')
    
    if not url:
        return jsonify({'error': 'URL is required'}), 400
        
    try:
        db.save_history(url, 'WORTHLESS', reason='manual_worthless')
        return jsonify({'status': 'success'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/system/reload_history', methods=['POST'])
def reload_server_history():
    try:
        db.reload_history()
        return jsonify({'status': 'success', 'message': 'History reloaded from disk'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # Port 5500 as requested
    app.run(debug=True, port=5500)
