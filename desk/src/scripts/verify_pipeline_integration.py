import sys
import os

# Setup paths
current_dir = os.path.dirname(os.path.abspath(__file__))
desk_dir = os.path.dirname(os.path.dirname(current_dir))
if desk_dir not in sys.path:
    sys.path.insert(0, desk_dir)

print(f"Checking imports from {desk_dir}...")

try:
    from src.scheduler_pipeline import SchedulerPipeline, PipelinePhase
    print("✅ Successfully imported SchedulerPipeline")
except ImportError as e:
    print(f"❌ Failed to import SchedulerPipeline: {e}")
    sys.exit(1)

try:
    from src.api.collector import collector_bp
    print("✅ Successfully imported collector_bp")
except ImportError as e:
    print(f"❌ Failed to import collector_bp: {e}")
    sys.exit(1)

# Verify SchedulerPipeline instantiation and dry run
try:
    print("Testing SchedulerPipeline dry run...")
    pipeline = SchedulerPipeline()
    # Mocking manager and db to avoid actual connection errors if env missing
    # But SchedulerPipeline init creates them.
    # Assuming environment is set up enough or it handles it.
    
    # We'll run a minimal phase
    result = pipeline.run(
        phases=[PipelinePhase.COLLECT], 
        dry_run=True, 
        schedule_name="Verification Run"
    )
    print(f"✅ Pipeline run result: {result.to_dict()}")
except Exception as e:
    print(f"❌ Pipeline run failed: {e}")
    sys.exit(1)

print("Verification Passed! 🎉")
