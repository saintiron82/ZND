# -*- coding: utf-8 -*-
import requests

print("테스트 1: 발행이력없는 기사 조회")
r = requests.get('http://localhost:5001/api/board/orphans')
data = r.json()
print(f"  성공: {data.get('success')}")
print(f"  개수: {data.get('count')}")
print(f"  유효 회차: {data.get('valid_editions')}")

if data.get('count', 0) > 0:
    print("\n테스트 2: 복구 실행")
    r2 = requests.post(
        'http://localhost:5001/api/board/recover-orphans',
        json={'recover_all': True}
    )
    data2 = r2.json()
    print(f"  성공: {data2.get('success')}")
    print(f"  복구된: {data2.get('recovered_count')}")
    print(f"  실패: {data2.get('failed_count')}")
    if data2.get('error'):
        print(f"  에러: {data2.get('error')}")
else:
    print("\n복구할 기사가 없습니다!")
