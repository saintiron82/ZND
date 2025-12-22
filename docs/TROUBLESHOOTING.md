# 🔧 ZED 트러블슈팅 가이드

이 문서는 ZED 프로젝트에서 발생한 오류와 해결 방법을 기록합니다.

---

## 🔥 Desk UI 로드 실패: "Assignment to constant variable"

### 증상
- Desk UI에서 "로드 실패: Assignment to constant variable." 에러 발생
- 발행 현황 또는 기사 목록이 표시되지 않음

### 원인
- `desk/templates/desk.html`의 `renderArticles()` 함수에서 `const`로 선언된 변수를 재할당 시도
- 구체적으로 1723번 줄에서 `const visibleArticles`로 선언 후 1762, 1766번 줄에서 재할당

### 해결
`const`를 `let`으로 변경:
```diff
- const visibleArticles = allArticles.slice();
+ let visibleArticles = allArticles.slice();
```

### 파일 위치
- `desk/templates/desk.html` 약 1723번 줄

---

## 🔥 Desk UI: "발행된 회차가 없습니다" (Firestore 연결 실패)

### 증상
- 발행 현황 패널에 "발행된 회차가 없습니다" 표시
- 서버 로그에 `⚠️ D:\ZND\desk\zeroechodaily-serviceAccountKey.json not found. DB operations will be skipped.` 출력

### 원인
- Firebase 서비스 계정 키 파일이 `desk/` 폴더에 없음
- 키 파일은 `.gitignore`에 포함되어 Git에 추적되지 않음
- 새 PC로 프로젝트를 클론하면 키 파일이 없어서 Firestore 연결 실패

### 해결

1. **Firebase Console에서 서비스 계정 키 다운로드:**
   - [Firebase Console](https://console.firebase.google.com/) → 프로젝트 설정 → 서비스 계정
   - "새 비공개 키 생성" 클릭
   
2. **파일 저장:**
   - 다운로드된 JSON 파일을 `zeroechodaily-serviceAccountKey.json`으로 이름 변경
   - `D:\ZND\desk\` 폴더에 저장

3. **서버 재시작:**
   - `start_desk.bat` 재실행

### 키 파일 백업 방법 (권장)
- JSON 내용을 비밀번호 관리자에 "Secure Note"로 저장
- 또는 암호화된 ZIP으로 압축 후 안전한 클라우드 저장소에 보관
- 새 환경에서 해당 내용으로 `zeroechodaily-serviceAccountKey.json` 파일 생성

### ⚠️ 보안 주의사항
- 이 키 파일은 **Firestore에 대한 완전한 접근 권한**을 가짐
- **절대 Git에 커밋하지 말 것** (`.gitignore`에 포함됨)
- 클라우드 저장 시 암호화 필수

### 관련 파일
- `desk/.env` - 키 파일 경로 설정: `FIREBASE_SERVICE_ACCOUNT_KEY=zeroechodaily-serviceAccountKey.json`
- `desk/src/db_client.py` - Firestore 초기화 로직

---

## 📋 새 환경 셋업 체크리스트

새 PC에서 ZED 프로젝트를 설정할 때 확인할 사항:

1. [ ] Git 클론 완료
2. [ ] Python 가상환경 설정 (`desk/venv` 또는 `desk/.venv`)
3. [ ] 의존성 설치 (`pip install -r requirements.txt`)
4. [ ] **Firebase 서비스 계정 키 파일 복사** ← 자동화 안 됨!
   - 파일명: `zeroechodaily-serviceAccountKey.json`
   - 위치: `D:\ZND\desk\`
5. [ ] `.env` 파일 확인 (이미 Git에 포함됨)
6. [ ] `start_desk.bat` 실행으로 서버 테스트

---

*최종 업데이트: 2025-12-22*
