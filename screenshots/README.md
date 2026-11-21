# 스토어 · 앱 소개용 스크린샷

앱 등록(MinaryHub, Google Play, Microsoft Store 등)과 README 에 쓰는 이미지입니다. 모두 실제 서버(BangDB Go, PostgreSQL 16, SQLite, BangDB 2.0 REST 모의 서버)에 연결해 찍은 화면이고, 데이터는 `scripts/demo-data.mjs` 가 만든 가상의 쇼핑몰 데이터입니다.

| 폴더 / 파일 | 크기 | 용도 |
|---|---|---|
| `desktop-1920x1080/` (10장) | 1920×1080 (16:9) PNG | 데스크톱 스토어(Microsoft Store 등), MinaryHub 카드·소개 페이지 |
| `android-phone-1080x1920/` (6장) | 1080×1920 (9:16) PNG | Google Play 휴대폰 스크린샷 |
| `feature-graphic-1024x500.png` | 1024×500 PNG | Google Play 기능 그래픽 |

앱 아이콘은 `public/icon-512.png`(512×512)를 씁니다.

## 데스크톱 (1920×1080)

| # | 화면 | 테마 |
|---|---|---|
| 01 | 테이블 데이터 — 셀 바로 편집, 수정·삭제 대기와 저장 바 | 다크 |
| 02 | SQL 콘솔 — 스키마 패널, JOIN·GROUP BY 결과 | 라이트 |
| 03 | 테이블 목록 — 행 수, 큰 테이블은 ≈ 추정, 뷰 | 다크 |
| 04 | 빠른 열기 (Ctrl/⌘+K) | 다크 |
| 05 | 구조 편집 — 컬럼·제약 조건 | 라이트 |
| 06 | 서버 목록 — 4종류 서버, 연결 상태 | 다크 |
| 07 | BangDB 서버 개요 — 통계, 덤프/복원, 유지 보수 | 다크 |
| 08 | 정보 — 업데이트, 문의, 후원 | 라이트 |
| 09 | 버전 기록 — 릴리즈 노트, 이전 버전 설치 | 다크 |
| 10 | GitHub 이슈로 문의하기 | 라이트 |

## 휴대폰 (1080×1920)

01 서버 목록 · 02 테이블 데이터 · 03 SQL 콘솔 · 04 테이블 목록 · 05 빠른 열기 · 06 정보 (모두 다크)

## MinaryHub 등록

[MinaryHub](https://minaryhub.github.io) 는 **MinaryHub 조직의 공개 저장소**를 자동으로 모아 보여 줍니다.

- 저장소가 MinaryHub 조직에 있으면(이전 또는 조직에서 새로 만들기 — 포크는 제외됨) 이 폴더를 그대로 읽습니다: 카드에는 `desktop-1920x1080/` 묶음이 파일 이름 순으로 쓰이고(최대 10장), `feature-graphic`·`icon` 이름은 건너뜁니다. 공유 미리보기는 첫 PNG(01)를 씁니다. 이미지를 바꾸면 사이트를 다시 배포하지 않아도 10분 안에 반영됩니다.
- 설명·주요 기능·분류는 MinaryHub 저장소의 `config.json` 에 넣습니다. 붙여 넣을 내용은 [`docs/minaryhub.json`](../docs/minaryhub.json) 에 있습니다 (`overrides` = 조직 저장소일 때, `apps` = 저장소를 옮기지 않고 링크만 올릴 때 — 이 경우 다운로드 버튼과 통계는 나오지 않습니다).
- 릴리즈 파일 이름(`…-windows-x64-setup.exe`, `…-macos-arm64.dmg`, `…-linux-x86_64.AppImage`, `…-android-debug.apk`)은 MinaryHub 의 OS·아키텍처 분류 규칙에 이미 맞습니다.
- 저장소 About(⚙)의 설명과 토픽도 카드에 쓰입니다. 권장: 설명 "Cross-platform manager for BangDB, PostgreSQL, MySQL, SQL Server, SQLite, MongoDB and Redis", 토픽 `database` `database-management` `sql` `postgresql` `mysql` `sqlite` `mongodb` `redis` `electron` `pwa`.

## 다시 만들기

```bash
# 1) 데모 데이터
mkdir -p /tmp/demo && cd /tmp/demo && node <저장소>/scripts/demo-data.mjs
bangdb shop.db < bangdb.sql                                       # BangDB (Go)
bangdb -http :18081 -http-cors http://localhost:8080 -password demo shop.db
createdb -p 5433 shop && psql -p 5433 -d shop -f pg.sql           # PostgreSQL (사용자 postgres, 포트 5433)
mkdir -p sq && sqlite3 sq/analytics.db < sqlite.sql               # SQLite
# 2) 앱과 모의 REST 서버 (저장소에서)
node scripts/mock-bangdb.mjs &
npm run build && SQLITE_ROOT=/tmp/demo/sq node proxy/server.mjs &
# 3) 촬영 (npm i -D playwright 필요). 버전 기록은 GitHub 릴리즈를 읽고, 저장해 둔 목록을 쓰려면 RELEASES_JSON
node scripts/store-screenshots.mjs screenshots          # 전체
node scripts/store-screenshots.mjs screenshots 02       # 이름에 02 가 들어간 것만
```

같은 데이터로 찍으면 같은 이미지가 나옵니다(데이터와 화면 크기가 고정). 기능 그래픽은 01 스크린샷을 넣은 HTML 을 1024×500 으로 찍은 것입니다.
