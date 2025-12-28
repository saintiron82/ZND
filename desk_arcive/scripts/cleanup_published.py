"""
발행된 기사 정리 스크립트
- ZES >= 4.0 (Noise) 기사 삭제
- 발행 기준: ZES < 4.0만 유효

사용법:
    python cleanup_published.py           # 시뮬레이션 (삭제 안함)
    python cleanup_published.py --force   # 실제 삭제
    python cleanup_published.py --date 2025-12-10  # 특정 날짜만
"""
import os
import json
import glob
import argparse
import sys

# Windows console encoding fix
sys.stdout.reconfigure(encoding='utf-8')

# 발행 기준: ZES 4.0 미만만 유효 (4.0 이상은 Noise)
NOISE_THRESHOLD = 4.0


def cleanup_published(data_dir, dry_run=True, target_date=None):
    """
    발행된 기사 중 Noise(ZES >= 4.0) 삭제
    """
    print("=" * 60)
    print("  📰 ZND 발행 기사 정리 도구")
    print("=" * 60)
    print(f"📁 대상 폴더: {data_dir}")
    print(f"📏 Noise 기준: ZES >= {NOISE_THRESHOLD}")
    if target_date:
        print(f"📅 대상 날짜: {target_date}")
    print(f"🔧 모드: {'시뮬레이션 (삭제 안함)' if dry_run else '⚠️ 실제 삭제'}")
    print("=" * 60)
    print()
    
    # 스캔 대상 결정
    if target_date:
        search_path = os.path.join(data_dir, target_date, "*.json")
    else:
        search_path = os.path.join(data_dir, "**", "*.json")
    
    files = glob.glob(search_path, recursive=True)
    
    targets = []
    kept = []
    skipped = []
    
    for file_path in files:
        if not os.path.isfile(file_path):
            continue
        
        filename = os.path.basename(file_path)
        
        # 시스템 파일 제외
        if filename in ['index.json', 'daily_summary.json', 'crawling_history.json']:
            skipped.append((file_path, 'system_file'))
            continue
            
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            zs = float(data.get('zero_echo_score', 10))  # 기본값 10 (삭제 대상)
            title = data.get('title_ko', '(제목 없음)')[:40]
            
            if zs >= NOISE_THRESHOLD:
                targets.append({
                    'path': file_path,
                    'zs': zs,
                    'title': title,
                    'date': os.path.basename(os.path.dirname(file_path))
                })
            else:
                kept.append({
                    'path': file_path,
                    'zs': zs,
                    'title': title
                })
                
        except Exception as e:
            skipped.append((file_path, str(e)))
    
    # 결과 출력
    print(f"📊 스캔 결과:")
    print(f"   ✅ 유지: {len(kept)}개 (ZES < {NOISE_THRESHOLD})")
    print(f"   🗑️ 삭제 대상: {len(targets)}개 (ZES >= {NOISE_THRESHOLD})")
    print(f"   ⏭️ 스킵: {len(skipped)}개")
    print()
    
    if not targets:
        print("✅ 삭제할 Noise 기사가 없습니다!")
        return
    
    # 삭제 대상 목록 출력
    print("🗑️ 삭제 대상 목록:")
    print("-" * 60)
    
    # 날짜별로 그룹핑
    by_date = {}
    for t in targets:
        date = t['date']
        if date not in by_date:
            by_date[date] = []
        by_date[date].append(t)
    
    deleted_count = 0
    
    for date in sorted(by_date.keys(), reverse=True):
        print(f"\n📅 {date} ({len(by_date[date])}개):")
        for item in by_date[date]:
            action = "🗑️ DELETE" if not dry_run else "⚠️ FOUND"
            print(f"   [{action}] ZES:{item['zs']:.1f} | {item['title']}")
            
            if not dry_run:
                try:
                    os.remove(item['path'])
                    print(f"            → ✅ 삭제 완료")
                    deleted_count += 1
                except Exception as e:
                    print(f"            → ❌ 오류: {e}")
    
    print()
    print("=" * 60)
    
    if dry_run:
        print("⚠️ 시뮬레이션 모드입니다. 실제 삭제되지 않았습니다.")
        print()
        print("실제 삭제하려면:")
        print(f"   python {os.path.basename(__file__)} --force")
        if target_date:
            print(f"   python {os.path.basename(__file__)} --force --date {target_date}")
    else:
        print(f"✅ 삭제 완료: {deleted_count}개 파일")
        print()
        print("💡 index.json 업데이트가 필요할 수 있습니다.")
    
    print("=" * 60)


def list_dates(data_dir):
    """사용 가능한 날짜 목록 출력"""
    print("📅 발행된 날짜 목록:")
    print("-" * 40)
    
    dates = []
    for item in os.listdir(data_dir):
        item_path = os.path.join(data_dir, item)
        if os.path.isdir(item_path) and len(item) == 10 and item[4] == '-':
            # Count articles
            json_files = glob.glob(os.path.join(item_path, "*.json"))
            count = len([f for f in json_files if os.path.basename(f) not in ['index.json', 'daily_summary.json']])
            dates.append((item, count))
    
    dates.sort(reverse=True)
    
    for date, count in dates:
        print(f"   {date}: {count}개 기사")
    
    print("-" * 40)
    print(f"총 {len(dates)}개 날짜")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="발행된 기사 정리 (Noise 삭제)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
예시:
    python cleanup_published.py              # 시뮬레이션
    python cleanup_published.py --force      # 실제 삭제
    python cleanup_published.py --date 2025-12-10  # 특정 날짜
    python cleanup_published.py --list       # 날짜 목록
        """
    )
    parser.add_argument('--force', action='store_true', help='실제 삭제 실행')
    parser.add_argument('--date', type=str, help='특정 날짜만 처리 (YYYY-MM-DD)')
    parser.add_argument('--list', action='store_true', help='발행 날짜 목록 표시')
    args = parser.parse_args()
    
    # 경로 설정
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    data_dir = os.path.join(base_dir, 'data')
    
    if not os.path.exists(data_dir):
        print(f"❌ 데이터 폴더를 찾을 수 없습니다: {data_dir}")
        sys.exit(1)
    
    if args.list:
        list_dates(data_dir)
    else:
        cleanup_published(data_dir, dry_run=not args.force, target_date=args.date)
