# -*- coding: utf-8 -*-
"""
문제 기사 로컬 캐시 삭제 스크립트
"""
import os
import glob

problem_ids = [
    '09c261d90795', '1021b427ce79', '10252b522ac3', '153e514c7275',
    '16051f06a99e', '1eda9ccfff82', '3f9559d43ec3', '42e9a0ba1d2d',
    '471c7deb509e', '4c73ee6b686a', '60d8baeb21a7', '8897a1ce6926',
    'ae242a7e6bd0', 'd1ebf7e3ae27', 'd2e013cb06a2', 'd839a65261df',
    'e5239ff89078'
]

base_dir = os.path.dirname(os.path.abspath(__file__))
cache_root = os.path.join(base_dir, 'cache', 'release')

print("Deleting problem article cache files...")
deleted = 0

for aid in problem_ids:
    pattern = os.path.join(cache_root, '**', f'{aid}.json')
    files = glob.glob(pattern, recursive=True)

    for f in files:
        try:
            os.remove(f)
            print(f"  Deleted: {f}")
            deleted += 1
        except Exception as e:
            print(f"  Error deleting {f}: {e}")

print(f"\nTotal deleted: {deleted}")
