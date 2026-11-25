# Teams PWA Desktop Wrapper

**한국어** | [English](README.md)

[![CI](https://github.com/furyheimdall/teams-pwa-desktop-wrapper/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/furyheimdall/teams-pwa-desktop-wrapper/actions/workflows/ci.yml)
![Linux](https://img.shields.io/badge/platform-Linux-FCC624?logo=linux&logoColor=black)
![Electron](https://img.shields.io/badge/Electron-43.x-47848F?logo=electron&logoColor=white)
![Bun](https://img.shields.io/badge/Bun-1.x-000000?logo=bun&logoColor=white)
![AMD64](https://img.shields.io/badge/architecture-amd64-555555)
![AppImage](https://img.shields.io/badge/package-AppImage-2A2A2A?logo=appimage)
![Debian](https://img.shields.io/badge/package-Debian-A81D33?logo=debian&logoColor=white)

Microsoft Teams 웹 앱(PWA)을 Linux 데스크톱에서 독립 애플리케이션처럼
사용할 수 있도록 감싼 비공식 Electron 래퍼입니다.

이 프로젝트의 목적은 Teams 웹 앱 자체를 다시 구현하는 것이 아니라,
웹 브라우저만으로는 부족한 **시스템 트레이**, **백그라운드 실행**,
**네이티브 알림**, **화면 공유 소스 선택** 같은 운영체제 통합 기능을
보완하는 것입니다.

> 이 프로젝트는 Microsoft의 공식 Teams 클라이언트가 아닙니다.
> Microsoft Teams 서비스와 상표의 권리는 각 권리자에게 있습니다.

## 주요 기능

- **Teams PWA 래핑**:
  `https://teams.microsoft.com/v2/`를 Electron `BrowserWindow`에 로드합니다.
- **시스템 트레이**:
  트레이 아이콘으로 창을 열거나 숨기고, 컨텍스트 메뉴에서 앱을 완전히
  종료할 수 있습니다.
- **Close-to-Tray**:
  창의 닫기 버튼을 눌러도 프로세스를 종료하지 않고 창만 숨겨 Teams를
  백그라운드에서 유지합니다.
- **단일 인스턴스**:
  앱이 중복 실행되지 않도록 막고, 두 번째 실행 요청이 들어오면 기존 창을
  복원해 포커스합니다.
- **창 상태 영속화**:
  창 크기·위치·최대화 상태를 사용자 설정 파일에 저장하고 다음 실행 때
  복원합니다.
- **네이티브 데스크톱 알림**:
  Teams 웹 알림을 preload 브리지와 IPC를 통해 Electron 메인 프로세스로
  전달하여 운영체제 알림으로 표시합니다. 알림을 클릭하면 Teams 창이
  열립니다.
- **화면 공유 선택기**:
  `desktopCapturer`로 화면과 애플리케이션 창을 수집하고, 썸네일 기반의
  별도 선택 창을 제공합니다.
- **미디어 권한 처리**:
  카메라·마이크, 알림, 전체 화면 등 Teams 통화에 필요한 Electron 세션
  권한 요청을 처리합니다.
- **맞춤법 검사와 편집 메뉴**:
  우클릭 메뉴에서 맞춤법 제안과 잘라내기·복사·붙여넣기·전체 선택을
  제공합니다.
- **외부 링크 분리**:
  Teams와 Microsoft 로그인 흐름(`login.microsoft.com` 패스키 인증 포함)은
  같은 Electron 세션에서 유지합니다. 그 밖의 HTTP(S) 링크는 시스템 기본
  브라우저로 엽니다.
- **Auto-Active**:
  선택적으로 30초마다 합성 입력 이벤트를 보내 Teams의 자리 비움 상태
  전환을 억제합니다. 설정값은 재실행 후에도 유지됩니다.

## 동작 구조

이 앱은 Electron의 프로세스 모델에 따라 다음 요소로 구성됩니다.

```text
Electron Main Process (main.js)
├─ BrowserWindow ─────────────── Microsoft Teams PWA
├─ Tray / Menu ──────────────── 창 표시, 숨김, 종료, Auto-Active
├─ Session / Permissions ───── 카메라, 마이크, 알림, 화면 공유
├─ desktopCapturer ─────────── 화면·창 공유 소스 수집
├─ Native Notification ─────── 운영체제 알림 표시
└─ ConfigStore ─────────────── 창 상태와 사용자 설정 저장
        │
        ├─ preload.js ───────── 격리된 알림 IPC 브리지
        └─ picker.html ──────── 로컬 화면 공유 소스 선택기
```

### 주요 기술 용어

- **Electron wrapper**:
  기존 웹 애플리케이션을 Electron 창에 로드하고 데스크톱 기능을 덧붙이는
  셸 애플리케이션입니다.
- **Main process**:
  창, 트레이, 세션, 운영체제 알림 등 네이티브 기능을 관리하는 Node.js
  프로세스입니다.
- **Renderer process**:
  Teams PWA 또는 로컬 화면 공유 선택기 UI를 렌더링하는 Chromium
  프로세스입니다.
- **Preload bridge**:
  `contextIsolation`을 유지하면서 허용된 기능만 렌더러에 노출하는 연결
  계층입니다.
- **IPC (Inter-Process Communication)**:
  렌더러와 메인 프로세스 사이에서 알림과 화면 공유 선택 결과를 전달하는
  통신 방식입니다.
- **Close-to-Tray**:
  창 닫기 요청을 앱 종료가 아닌 창 숨김으로 바꾸는 데스크톱 애플리케이션
  패턴입니다.
- **Session persistence**:
  창 상태나 로그인 세션처럼 다음 실행에서도 필요한 상태를 로컬에 유지하는
  방식입니다.

## 사용 흐름

### 트레이에서 앱 제어

- 트레이 아이콘을 한 번 클릭하면 Teams 창의 표시 상태가 전환됩니다.
- 트레이 메뉴의 **Open Teams**는 창을 열고 포커스합니다.
- **Minimize to Tray**는 앱을 종료하지 않고 창을 숨깁니다.
- **Quit Teams**를 선택해야 프로세스가 완전히 종료됩니다.

Ubuntu GNOME에서 AppIndicator 확장이 활성화되어 있으면 상단 패널에
Teams 아이콘이 표시됩니다. 창을 닫아도 앱은 종료되지 않으며,
**Open Teams**로 다시 열 수 있습니다.
창을 숨기면 독에 실행 중인 창 표시가 남지 않습니다. Wayland와 X11 모두
**Open Teams**로 열면 이전 창 크기와 최대화 상태를 복원합니다.

### Auto-Active 사용

**Auto-Active (Prevent Away)**는 기본적으로 꺼져 있습니다. 트레이 메뉴에서
켜거나 끄면 Teams 페이지에 주기적으로 보내는 합성 마우스·키보드 이벤트를
시작하거나 중지합니다. 설정은 앱을 다시 실행해도 유지됩니다.

이 기능은 Teams 웹 앱의 동작이나 조직 정책에 따라 효과가 달라질 수 있으며,
조직의 근무 상태 및 보안 정책을 확인한 뒤 사용해야 합니다.

### 화면 공유

Teams에서 화면 공유를 요청하면 앱이 화면과 창 목록을 가져와 별도 선택기를
표시합니다. **All**, **Screens**, **Windows** 탭으로 대상을 필터링하고
썸네일을 선택한 뒤 공유할 수 있습니다.

## 요구 사항

- Linux 데스크톱 환경
- Node.js 22.12 이상과 npm 또는 [Bun](https://bun.sh/)
- 개발 실행에 필요한 그래픽 세션
- `.deb` 패키징용 `fakeroot` 및 `dpkg-deb`
- Microsoft Teams에 접속할 수 있는 네트워크와 계정

Ubuntu/Debian 계열에서 패키징 도구는 다음과 같이 설치할 수 있습니다.

```bash
sudo apt install fakeroot dpkg-dev
```

## 의존성 설치

```bash
# Bun
bun install

# 또는 npm
npm install
```

## 개발 실행

```bash
# Bun
bun start

# 또는 npm
npm start
```

압축 해제 형태의 애플리케이션 디렉터리를 생성하려면 다음을 실행합니다.

```bash
bun run pack
# 또는
npm run pack
```

## AMD64 Linux 배포 패키지 빌드

기본 배포 빌드는 AMD64용 AppImage와 Debian 패키지를 생성합니다.

```bash
bun run dist
# 또는
npm run dist
```

`dist` 스크립트는 다음 순서로 동작합니다.

1. `electron-builder --linux AppImage --x64`로 AMD64 AppImage와 압축 해제
   애플리케이션 디렉터리를 생성합니다.
2. `build-deb.js amd64`를 실행해 AMD64 디렉터리를 선택합니다.
3. Debian 메타데이터, 데스크톱 엔트리, 아이콘, 실행 링크를 구성합니다.
4. `fakeroot dpkg-deb`로 `.deb` 패키지를 생성합니다.

기본 결과물은 `dist/`에 생성됩니다.

```text
dist/
├─ Teams Desktop-1.0.1.AppImage
└─ teams-electron_1.0.1_amd64.deb
```

AMD64와 arm64 패키지를 모두 빌드하려면 명시적으로 다음을 실행합니다.

```bash
bun run dist:all
# 또는
npm run dist:all
```

## 설치 및 실행

### Debian 패키지

```bash
sudo dpkg -i dist/teams-electron_1.0.1_amd64.deb

# 의존성 오류가 발생한 경우
sudo apt-get install -f
```

설치 후 애플리케이션 메뉴의 **Teams Desktop** 또는 다음 명령으로 실행할 수
있습니다.

```bash
teams-electron
```

### AppImage

```bash
chmod +x "dist/Teams Desktop-1.0.1.AppImage"
"./dist/Teams Desktop-1.0.1.AppImage"
```

## 설정과 데이터

창 위치, 창 크기, 최대화 여부, Auto-Active 활성화 여부는 Electron의 사용자
데이터 디렉터리에 있는 `user-preferences.json`에 저장됩니다.

Teams 로그인 정보와 웹 세션 데이터는 Electron의 기본 세션 저장소에서
관리됩니다. 이 프로젝트의 사용자 설정 파일에는 Teams 계정 비밀번호나
메시지 내용을 별도로 저장하지 않습니다.

## 프로젝트 구조

```text
.
├─ main.js          # Electron 메인 프로세스와 데스크톱 통합 기능
├─ preload.js       # Teams 렌더러에 노출되는 알림 IPC 브리지
├─ picker.html      # 화면·창 공유 소스 선택 UI
├─ build-deb.js     # amd64/arm64 Debian 패키지 생성 스크립트
├─ package.json     # 실행 스크립트, 의존성, electron-builder 설정
├─ icons/           # 애플리케이션 및 트레이 아이콘
└─ dist/            # 빌드 결과물
```

## 지속적 통합

GitHub Actions와 GitLab CI는 Bun 잠금 파일에 기록된 의존성을 설치하고,
두 README와 JavaScript 구문을 검사한 뒤 AMD64 Linux 패키지를 빌드합니다.
생성된 AppImage와 Debian 패키지는 파이프라인 아티팩트로 업로드됩니다.

GitHub Actions 설정은
[`.github/workflows/ci.yml`](.github/workflows/ci.yml)에서, GitLab CI 설정은
[`.gitlab-ci.yml`](.gitlab-ci.yml)에서 확인할 수 있습니다.

## 보안

취약점은 [`SECURITY.md`](SECURITY.md)의 절차에 따라 비공개로 신고해 주세요.
공개 이슈에는 악용 가능한 세부 정보를 포함하지 마세요.

## 알려진 제약

- Teams 웹 앱의 UI나 인증 흐름이 변경되면 User-Agent, 링크 처리 또는 알림
  브리지의 조정이 필요할 수 있습니다.
- 화면 공유와 시스템 오디오(loopback) 지원 여부는 Electron, 디스플레이 서버,
  데스크톱 환경에 따라 달라질 수 있습니다.
- 이 앱은 Linux 배포 설정에 초점을 맞추고 있으며 Windows와 macOS 패키지는
  현재 빌드 스크립트의 대상이 아닙니다.
- Auto-Active는 Teams의 재실 상태 판정을 우회한다고 보장하지 않습니다.

## 라이선스

이 프로젝트의 소스 코드는 [MIT License](LICENSE)에 따라 공개됩니다.

이 프로젝트는 Microsoft와 제휴하거나 Microsoft의 승인을 받은 공식 제품이
아닙니다. Microsoft Teams 및 관련 명칭과 표장은 Microsoft에 귀속됩니다.
