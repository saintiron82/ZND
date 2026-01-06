# -*- coding: utf-8 -*-
"""
Publication Snapshot Repair Script

발행 문서의 articles 스냅샷에서 유실된 source_id와 url을 
원본 아티클 데이터에서 복원합니다.

Usage:
    cd d:\ZND\desk
    python scripts/repair_publication_snapshots.py [edition_code]
    
    edition_code를 지정하지 않으면 모든 발행 회차를 검사합니다.
"""
import os
import sys

# Add desk folder to path (script is in desk/scripts/)
script_dir = os.path.dirname(os.path.abspath(__file__))
desk_dir = os.path.dirname(script_dir)
sys.path.insert(0, desk_dir)

print(f"📂 Working directory: {os.getcwd()}")
print(f"📂 Script directory: {script_dir}")
print(f"📂 Desk directory: {desk_dir}")

from src.core.firestore_client import FirestoreClient


def repair_publication_snapshots(edition_code: str = None, dry_run: bool = True, force: bool = False):
    """
    발행 스냅샷의 유실된 필드 복원
    
    Args:
        edition_code: 특정 회차만 복구 (None이면 전체)
        dry_run: True면 변경 없이 확인만
    """
    db = FirestoreClient()
    
    # 발행 회차 목록 조회
    if edition_code:
        editions = [edition_code]
    else:
        meta = db.get_publications_meta()
        if not meta:
            print("❌ No publications meta found")
            return
        editions = [issue.get('edition_code') or issue.get('code') 
                   for issue in meta.get('issues', [])]
    
    print(f"📋 Checking {len(editions)} editions...")
    
    total_fixed = 0
    total_missing = 0
    
    for code in editions:
        if not code:
            continue
            
        print(f"\n📦 Edition: {code}")
        pub_doc = db.get_publication(code)
        
        if not pub_doc:
            print(f"   ⚠️ Publication document not found")
            continue
        
        articles = pub_doc.get('articles', [])
        article_ids = pub_doc.get('article_ids', [])
        
        print(f"   📰 {len(articles)} article snapshots")
        
        modified = False
        
        for i, snapshot in enumerate(articles):
            article_id = snapshot.get('id')
            if not article_id:
                continue
            
            # 유실된 필드 확인
            missing_fields = []
            if not snapshot.get('source_id'):
                missing_fields.append('source_id')
            if not snapshot.get('url'):
                missing_fields.append('url')
            if not snapshot.get('title'):
                missing_fields.append('title')
            
            if not missing_fields:
                continue
            
            total_missing += 1
            print(f"   ⚠️ [{article_id}] Missing: {', '.join(missing_fields)}")
            
            # 원본 아티클에서 복원
            original_article = db.get_article(article_id)
            
            # [FIX] 현재 환경에 없으면 다른 환경(dev/release)도 확인
            if not original_article:
                current_env = os.getenv('ZND_ENV', 'release')
                alt_env = 'dev' if current_env == 'release' else 'release'
                
                print(f"      ⚠️ Not found in {current_env}, checking {alt_env}...")
                
                # 환경 변수 잠시 변경
                os.environ['ZND_ENV'] = alt_env
                try:
                    original_article = db.get_article(article_id)
                    if original_article:
                        print(f"      ✅ Found in {alt_env}!")
                finally:
                    # 환경 변수 복구
                    os.environ['ZND_ENV'] = current_env
            
            if not original_article:
                print(f"      ❌ Original article not found anywhere!")
                continue
            
            original = original_article.get('_original', {})
            header = original_article.get('_header', {})
            analysis = original_article.get('_analysis', {}) or {}
            
            # 필드 복원
            restored = []
            
            # 1. Source ID & URL (Header fallback)
            source_id = original.get('source_id') or header.get('source_id')
            if 'source_id' in missing_fields and source_id:
                snapshot['source_id'] = source_id
                restored.append('source_id')
                
            url = original.get('url') or header.get('url')
            if 'url' in missing_fields and url:
                snapshot['url'] = url
                restored.append('url')
                
            # 2. Title
            title = original.get('title')
            # 만약 original에 title이 없으면 raw_inputs 확인 (구조에 따라 다름)
            if not title and 'raw_inputs' in original_article:
                title = original_article['raw_inputs'].get('title')
                
            if 'title' in missing_fields and title:
                snapshot['title'] = title
                restored.append('title')
            
            # 추가로 복원 가능한 필드들
            if not snapshot.get('title_ko') and analysis.get('title_ko'):
                snapshot['title_ko'] = analysis['title_ko']
                restored.append('title_ko')
            
            # published_at (Header fallback)
            published_at = original.get('published_at') or header.get('published_at') or header.get('created_at')
            if not snapshot.get('published_at') and published_at:
                snapshot['published_at'] = published_at
                restored.append('published_at')
            
            if restored:
                print(f"      ✅ Restored: {', '.join(restored)}")
                modified = True
                total_fixed += 1
            else:
                print(f"      ⚠️ Could not restore from original")
        
        # 저장
        if modified or force:
            # 타임스탬프 갱신
            from datetime import datetime, timezone, timedelta
            kst = timezone(timedelta(hours=9))
            now = datetime.now(kst).isoformat()
            
            if not dry_run:
                pub_doc['articles'] = articles
                pub_doc['updated_at'] = now
                db.save_publication(code, pub_doc)
                if modified:
                    print(f"   💾 Saved publication document (updated_at refreshed)")
                else:
                    print(f"   💾 Forced update: refreshed updated_at timestamp")
                
                # [FIX] _meta 문서 업데이트 (Web Cache Refresh Trigger)
                print(f"   🔄 Syncing _meta document...")
                meta = db.get_publications_meta()
                if meta and 'issues' in meta:
                    issue_found = False
                    for issue in meta['issues']:
                        if issue.get('edition_code') == code:
                            issue['updated_at'] = now
                            issue_found = True
                            break
                    
                    if issue_found:
                        meta['latest_updated_at'] = now
                        db.update_publications_meta(meta)
                        print(f"   ✅ Updated _meta (latest_updated_at: {now})")
                    else:
                        print(f"   ⚠️ Issue {code} not found in _meta issues list")
                else:
                     print(f"   ⚠️ _meta document not found")

            else:
                if modified:
                    print(f"   ⚙️ [DRY RUN] Would save publication document and update timestamp to {now}")
                    print(f"   ⚙️ [DRY RUN] Would update _meta.latest_updated_at to {now}")
                else:
                    print(f"   ⚙️ [DRY RUN] Would FORCE update timestamp to {now}")
                    print(f"   ⚙️ [DRY RUN] Would FORCE update _meta.latest_updated_at to {now}")
    
    print(f"\n{'='*50}")
    print(f"📊 Summary:")
    print(f"   Missing fields detected: {total_missing}")
    print(f"   Fixed: {total_fixed}")
    
    if dry_run:
        print(f"\n💡 Run with --apply to actually save changes:")
        print(f"   python scripts/repair_publication_snapshots.py --apply")


if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='Repair publication snapshots')
    parser.add_argument('edition_code', nargs='?', help='Specific edition code to repair')
    parser.add_argument('--apply', action='store_true', help='Actually apply changes (default is dry run)')
    parser.add_argument('--force', action='store_true', help='Force save/update timestamp even if no changes detected')
    parser.add_argument('--env', default='release', choices=['dev', 'release'], help='Firestore environment (default: release)')
    
    args = parser.parse_args()
    
    # Set environment
    os.environ['ZND_ENV'] = args.env
    print(f"🌍 Environment: {args.env}")
    
    dry_run = not args.apply
    
    if dry_run:
        print("🔍 DRY RUN MODE - No changes will be made")
    else:
        print("⚠️ APPLY MODE - Changes will be saved to Firestore")
    
    repair_publication_snapshots(args.edition_code, dry_run=dry_run, force=args.force)

