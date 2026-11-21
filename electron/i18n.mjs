// Menu and dialog text of the desktop shell in the app's language. The page
// tells the shell its language (preload: bangdbDesktop.setLanguage); keys
// are the English text, {name} placeholders are filled from vars.
let lang = 'en';
const listeners = new Set();

export function setLanguage(l) {
  const next = l === 'ko' ? 'ko' : 'en';
  if (next === lang) return;
  lang = next;
  listeners.forEach((f) => f(lang));
}
export const onLanguage = (f) => listeners.add(f);

export function tr(s, vars) {
  const base = lang === 'ko' ? KO[s] ?? s : s;
  return vars ? base.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : base;
}

export const KO = {
  'File': '파일',
  'Quit': '끝내기',
  'Server': '서버',
  'Allow phone access (port {port})': '휴대폰 접속 허용 (포트 {port})',
  'Show phone access address & token': '휴대폰 접속 주소·토큰 보기',
  'DB gateway: built in (SQLite folder: {folder})': 'DB 게이트웨이: 내장 (SQLite 폴더: {folder})',
  'DB gateway unavailable: {error}': 'DB 게이트웨이를 쓸 수 없음: {error}',
  'View': '보기',
  'Refresh': '새로고침',
  'Developer tools': '개발자 도구',
  'Actual size': '실제 크기',
  'Zoom in': '확대',
  'Zoom out': '축소',
  'Full screen': '전체 화면',
  'Help': '도움말',
  'Check for updates': '업데이트 확인',
  'Version history': '버전 기록',
  'Release notes on GitHub': 'GitHub 릴리즈 노트',
  'Report a bug or ask a question…': '버그 신고 · 질문하기…',
  'Browse issues': '이슈 보기',
  'Sponsor BangDB Manager ♥': 'BangDB Manager 후원하기 ♥',
  'GitHub repository': 'GitHub 저장소',
  'Version {v}': '버전 {v}',
  'Allow phone access failed': '휴대폰 접속 허용 실패',
  'Could not open port {port}: {error}': '{port} 포트를 열지 못했습니다: {error}',
  'Phone access is off': '휴대폰 접속이 꺼져 있습니다',
  'Turn on "Allow phone access" in the Server menu.': '서버 메뉴에서 "휴대폰 접속 허용"을 켜세요.',
  "http://<this PC's IP>:{port}": 'http://<이 PC의 IP>:{port}',
  'Once open, use "Add to Home Screen" to use it like an app. The firewall must allow port {port}.': '열린 뒤 "홈 화면에 추가"를 하면 앱처럼 쓸 수 있습니다. 방화벽에서 {port} 포트를 허용해야 합니다.',
  'To use gateway databases such as PostgreSQL from a phone, enter this value as the gateway token when editing the connection:\n{token}': '휴대폰에서 PostgreSQL 같은 게이트웨이 DB를 쓰려면 연결 편집의 게이트웨이 토큰에 이 값을 넣으세요:\n{token}',
  'Open in a phone browser on the same network': '같은 네트워크의 휴대폰 브라우저에서 여세요',
  'Copy address': '주소 복사',
  'Copy token': '토큰 복사',
  'Close': '닫기',
  'Startup failed': '시작하지 못했습니다',
  'Could not start the internal server: {error}': '내부 서버를 시작하지 못했습니다: {error}',
  'Automatic updates are off': '자동 업데이트가 꺼져 있습니다',
  'The BANGDB_MANAGER_NO_UPDATE environment variable is set.': 'BANGDB_MANAGER_NO_UPDATE 환경 변수가 설정되어 있습니다.',
  'Not available in development mode.': '개발 모드에서는 쓸 수 없습니다.',
  "You're up to date": '최신 버전입니다',
  'Current version: {v}': '현재 버전: {v}',
  'Downloading {v}': '{v} 내려받는 중',
  'When the download finishes, the app shows a Restart button; otherwise it installs when you close the app.': '다 받으면 앱에 다시 시작 버튼이 나타납니다. 누르지 않으면 앱을 닫을 때 설치됩니다.',
  'Update check failed': '업데이트 확인 실패',
  'New version {v} available (current: {current})': '새 버전 {v}이(가) 나왔습니다 (현재: {current})',
  'The {platform} build does not support automatic installation. Download the new installer from the download page.': '{platform} 빌드는 자동 설치를 지원하지 않습니다. 다운로드 페이지에서 새 설치 파일을 받으세요.',
  'Open download page': '다운로드 페이지 열기',
  'Skip this version': '이 버전 건너뛰기',
  'Later': '나중에',
  'Checking for updates…': '업데이트 확인 중…',
  'Downloading update {v} {percent}%': '업데이트 {v} 내려받는 중 {percent}%',
  'Update {v} ready to install (applied on restart)': '업데이트 {v} 설치 준비 완료 (다시 시작하면 적용)',
  'New version {v} available': '새 버전 {v} 있음',
  'Up to date ({v})': '최신 버전 ({v})',
  'Update error: {error}': '업데이트 오류: {error}',
  'Automatic updates off': '자동 업데이트 꺼짐'
};
