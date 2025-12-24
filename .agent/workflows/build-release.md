---
description: 배포용 릴리즈 브랜치 준비 (빌드 포함)
---

// turbo-all

## 사용법
마스터가 "빌드 준비", "배포 준비", "릴리즈 준비"라고 하면 이 워크플로우를 실행합니다.

## 전제 조건
- 현재 개발 브랜치(feature/YYYY_MM_DD)에서 작업 중
- 배포할 코드가 준비된 상태

## 단계

### 1. 현재 브랜치 확인
```powershell
git branch --show-current
```

### 2. 개발 브랜치 먼저 커밋/푸시
현재 변경사항을 개발 브랜치에 먼저 커밋합니다.

```powershell
git add -A
```

```powershell
git diff --cached --stat
```

변경사항이 있으면:
```powershell
git commit -m "feat: 배포 전 최종 작업"
```

```powershell
git push origin HEAD
```

### 3. main 브랜치로 이동 및 최신화
```powershell
git checkout main
```

```powershell
git pull origin main
```

### 4. 릴리즈 브랜치 생성
오늘 날짜 기준으로 `release/YYYY-MM-DD` 브랜치 생성

```powershell
# 오늘 날짜 확인
Get-Date -Format "yyyy-MM-dd"
```

```powershell
# 브랜치 생성 (예: release/2025-12-24)
git checkout -b release/2025-12-24
```

> 이미 존재하면: `git checkout release/2025-12-24`

### 5. Next.js 빌드
```powershell
cd web
npm install
npm run build
cd ..
```

### 6. 빌드 결과 커밋 및 푸시
```powershell
git add -A
git commit -m "release: 2025-12-24 배포 준비 완료"
git push -u origin release/2025-12-24
```

### 7. 개발 브랜치로 복귀
```powershell
git checkout feature/2025_12_24
```

## 완료 후 안내
마스터에게 다음 정보 전달:
- 생성된 릴리즈 브랜치명
- VM에서 `.\redeploy.bat` 실행 시 입력할 브랜치명

## 주의사항
- 빌드 실패 시 에러 확인 후 수정 필요
- `.next` 폴더는 `.gitignore`에 있으므로 빌드 결과는 포함되지 않음
- VM에서는 `redeploy.bat`으로 빌드 없이 서버만 재시작 가능
