# GCP e2-micro 무료 티어 배포 가이드 :rocket:

이 가이드는 **Next.js 웹 서버**와 **Python Flask 백엔드(Desk)**를 함께 Google Cloud Platform(GCP)의 **e2-micro** 인스턴스에 배포하는 통합 절차입니다.
크롤링 시 메모리 부족을 방지하기 위한 **Swap 메모리 설정**과 **PM2를 이용한 멀티 프로세스 관리**가 핵심입니다.

## 1. 전제 조건
*   Google Cloud Platform 계정 및 프로젝트 생성 완료
*   결제 수단 등록 (자동 결제 방지 설정 권장)

## 2. VM 인스턴스 생성 (콘솔 작업)
GCP 콘솔(Compute Engine)에서 다음 사양으로 인스턴스를 생성합니다.

*   **리전(Region)**: `us-central1`, `us-west1`, `us-east1` 중 택 1. (**필수**)
*   **머신 유형**: `e2-micro` (vCPU 2개, 메모리 1GB)
*   **부팅 디스크**:
    *   OS: `Ubuntu 24.04 LTS` (최신 권장)
    *   디스크 크기: **30GB** ("표준 영구 디스크" 30GB까지 무료)
*   **방화벽**:
    *   [x] HTTP / HTTPS 트래픽 허용

---

## 3. 리눅스 기본 환경 설정 (터미널)
SSH 접속 후 아래 명령어를 순서대로 실행하세요.

### (1) 🛡️ Swap 메모리 설정 (필수!)
*1GB 램에서 Python 크롤러와 Node.js를 동시에 돌리려면 필수입니다.*

```bash
# 2GB Swap 생성
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### (2) 📦 필수 유틸리티 및 언어 설치
**Node.js (Web)** 와 **Python (Backend)** 런타임을 모두 설치합니다.

```bash
sudo apt update && sudo apt upgrade -y
# git, nano, python 패키지 설치
sudo apt install git nano python3-pip python3-venv -y

# Node.js 22.x 설치
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# PM2 설치
sudo npm install -g pm2
```

---

## 4. 프로젝트 설정

### (1) 코드 가져오기
(*SSH 키 설정 과정은 생략, 필요 시 이전 대화 참조*)
```bash
cd ~
git clone git@github.com:saintiron82/ZND.git
cd ZND
```

### (2) 🐍 Python Backend (Crawler/Desk) 설정
```bash
cd desk

# 가상환경 생성 및 활성화
python3 -m venv venv
source venv/bin/activate

# 의존성 설치
pip install -r requirements.txt

# .env 파일 생성
nano .env
# (내용 붙여넣기 후 Ctrl+X -> Y -> Enter)

deactivate  # 가상환경 종료
cd ..
```

### (3) 🌐 Next.js Web 설정
```bash
cd web

# 의존성 설치
npm install

# .env.local 생성
nano .env.local
# (Firebase 키 입력)
# *Web은 Firestore 직접 조회를 하므로 BACKEND_URL 설정이 필요 없습니다.*

# 빌드
npm run build
cd ..
```

---

## 5. 통합 서비스 실행 (PM2)

### (1) 실행 명령어
### (1) 실행 명령어
**Web은 8080포트, Desk Backend는 5500포트**로 설정합니다. (MLL 엔진은 별도 8000포트)

```bash
# 1. Python Flask Backend (Desk) 실행 (포트 5500)
pm2 start desk/manual_crawler.py --name "znd-backend" --interpreter python3

# 2. Next.js Web 실행 (포트 8080)
pm2 start npm --name "znd-web" -- start --prefix ./web -- -p 8080
```
*설명: `--prefix ./web`은 web 폴더에서 실행하라는 뜻이고, 뒤의 `-- -p 8080`은 Next.js에게 포트 인자를 넘기는 것입니다.*

### (2) 상태 확인 및 저장
```bash
# 상태 확인 (둘 다 online이어야 함)
pm2 status

# 재부팅 시 자동 실행 등록
pm2 startup
pm2 save
```

---

## 6. 방화벽 및 보안 설정 (중요!)

**서비스의 독립성**을 보장하기 위해 보안 규칙을 다르게 적용합니다.

### (1) Web 서비스 (일반 유저용)
*   **성격**: 대국민 서비스. 누구나 접속 가능해야 함.
*   **포트**: `8080`
*   **설정**: GCP 방화벽에서 `0.0.0.0/0` (전체 허용)으로 개방.

### (2) Desk/Crawler 서비스 (어드민용)
*   **성격**: 관리자 전용. 외부인은 접속하면 안 됨.
*   **포트**: `5500` (Desk), `8000` (MLL 엔진)
*   **설정**:
    *   **옵션 A (권장)**: 방화벽을 **열지 않음**. (웹 서버와 백엔드는 `localhost`로 내부 통신하므로, 웹 서비스 가동에는 문제없음)
    *   **옵션 B (외부 접속 필요 시)**: 본인의 집/사무실 IP만 허용하도록 `소스 IPv4 범위`를 특정 IP로 제한해서 개방.

**[설정 방법]**
1.  GCP 콘솔 -> **VPC 네트워크** -> **방화벽**
2.  `allow-web-public` 규칙 생성: `tcp:8080` 허용 (타겟: 모든 인스턴스, 소스: 0.0.0.0/0)
3.  *(필요 시)* `allow-admin-private` 규칙 생성: `tcp:5500` 허용 (소스: `내_IP주소`)

