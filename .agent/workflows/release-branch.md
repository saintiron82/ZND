---
description: 발행용 데이터 브랜치로 이동
---

## 사용법
마스터가 "발행용 브랜치", "발행 브랜치로", "release 브랜치"라고 하면 이 워크플로우를 실행합니다.

## 단계

### 1. 현재 브랜치 확인
```powershell
git branch --show-current
```

### 2. 변경사항 확인 (있으면 스태시)
```powershell
git status
```

변경사항이 있으면:
```powershell
git stash push -m "임시 저장: $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
```

### 3. release/data 브랜치로 이동
```powershell
# 브랜치가 이미 있으면 체크아웃
git checkout release/data

# 처음이면 orphan 브랜치 생성
# git checkout --orphan release/data
```

### 4. 발행용 데이터 확인
```powershell
Get-ChildItem supplier/data -Directory | Select-Object Name
```

### 5. 발행 커밋 (데이터 추가 시)
```powershell
git add supplier/data/
git commit -m "data: $(Get-Date -Format 'yyyy-MM-dd') edition"
git push origin release/data
```

### 6. 작업 브랜치로 복귀
```powershell
# 오늘 날짜 기준
git checkout feature/2025_12_19

# 스태시 복원 (있으면)
git stash pop
```

## 브랜치 구조
- `main` - 코드만 (발행용)
- `feature/YYYY_MM_DD` - 개발 작업
- `release/data` - 발행용 데이터 (supplier/data)
