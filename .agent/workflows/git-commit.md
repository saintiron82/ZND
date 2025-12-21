---
description: 작업 완료 후 Git 커밋 및 푸시
---

// turbo-all

## 사용법
마스터가 "커밋해줘", "정리해줘", 또는 "/git-commit"이라고 하면 이 워크플로우를 실행합니다.

## 단계

### 0. 브랜치 확인 및 생성
```powershell
git branch --show-current
```

**자동 브랜치 처리:**
- 현재 날짜(YYYY_MM_DD)와 다르면 자동으로 새 브랜치 생성
- 예: 오늘이 2025-12-21이면 `feature/2025_12_21` 브랜치로 전환

```powershell
# 오늘 날짜 브랜치로 체크아웃/생성 (날짜 형식: feature/YYYY_MM_DD)
git checkout -b feature/2025_12_21
```

> **주의**: 브랜치가 이미 존재하면 `git checkout feature/2025_12_21` 사용

---

### 1. 변경사항 스테이징
```powershell
git add -A
```

### 2. 변경된 파일 목록 확인
```powershell
git diff --cached --stat
```

### 3. 커밋 (변경 내용 기반 자동 메시지 작성)
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

### 4. 원격 저장소에 푸시
```powershell
git push origin feature/2025_12_21
```

> 새 브랜치면 `git push -u origin feature/2025_12_21` 사용

---

## 완전 자동화 규칙

1. **브랜치 날짜 체크**: 현재 날짜와 브랜치 날짜 비교 → 다르면 새 브랜치 생성
2. **모든 단계 자동 실행**: `// turbo-all` 적용으로 모든 명령어 자동 실행
3. **민감 정보 체크**: `.env`, `serviceAccountKey.json` 등이 포함되지 않았는지 확인 필수
4. **푸시까지 완료**: 커밋 후 자동으로 원격 저장소에 푸시

## 주의사항
- main 브랜치에 직접 커밋 금지
- 민감한 정보(.env, 키 파일 등) 커밋 금지 - .gitignore 확인

## 사용자 통보 
- 이슈상황이 없으면 푸시까지 한번에 자동 진행한다.