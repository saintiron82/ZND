---
description: 작업 완료 후 Git 커밋 및 푸시
---

## 사용법
마스터가 "커밋해줘", "정리해줘", 또는 "/git-commit"이라고 하면 이 워크플로우를 실행합니다.

## 단계

### 0. 브랜치 확인 (중요!)
```powershell
git branch --show-current
```

**브랜치 규칙:**
- 작업 브랜치는 반드시 `feature/YYYY_MM_DD` 형식 (예: `feature/2025_12_19`)
- 오늘 날짜와 다르면 새 브랜치 생성 또는 마스터에게 확인

**브랜치가 없거나 다른 경우:**
```powershell
# 오늘 날짜 브랜치로 체크아웃/생성
git checkout -b feature/2025_12_19
```

---

### 1. 현재 변경사항 확인
```powershell
git status
```

### 2. 모든 변경사항 스테이징
```powershell
git add -A
```

### 3. 변경된 파일 목록 확인
```powershell
git diff --cached --stat
```

### 4. 의미 있는 커밋 메시지로 커밋 (변경 내용 요약)
```powershell
git commit -m "feat: [변경 내용 요약]"
```

**커밋 메시지 규칙:**
- `feat:` 새 기능 추가
- `fix:` 버그 수정
- `refactor:` 리팩토링
- `style:` UI/스타일 변경
- `docs:` 문서 수정
- `chore:` 기타 작업

### 5. (선택) 원격 저장소에 푸시
```powershell
git push origin feature/2025_12_19
```

## 주의사항
- **브랜치 확인 필수!** main에 직접 커밋 금지
- 커밋 전 변경사항을 마스터에게 요약 보고
- 민감한 정보가 포함되지 않았는지 확인
