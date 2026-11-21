# 스토어 · 앱 소개용 스크린샷

앱 등록(MinaryHub, Google Play, Microsoft Store 등)과 README 에 쓰는 이미지입니다. 영어 화면은 `en/`, 한국어 화면은 `ko/` 에 같은 구성으로 있습니다. 모두 실제 서버(BangDB Go, PostgreSQL 16, SQLite, BangDB 2.0 REST 모의 서버)에 연결해 찍은 화면이고, 데이터는 `scripts/demo-data.mjs` 가 만든 가상의 쇼핑몰 데이터입니다.

| 폴더 / 파일 | 크기 | 용도 |
|---|---|---|
| `en/desktop-1920x1080/`, `ko/desktop-1920x1080/` (각 10장) | 1920×1080 (16:9) PNG | 데스크톱 스토어(Microsoft Store 등), MinaryHub 카드·소개 페이지 |
| `en/android-phone-1080x1920/`, `ko/android-phone-1080x1920/` (각 6장) | 1080×1920 (9:16) PNG | Google Play 휴대폰 스크린샷 |
| `feature-graphic-1024x500.png` | 1024×500 PNG | Google Play 기능 그래픽 |

앱 아이콘은 `public/icon-512.png`(512×512, 1024px 원본은 `build/icon.png`)입니다. 아이콘은 `npm run icons`, 기능 그래픽은 `npm run feature-graphic` 으로 다시 만듭니다.

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
| 08 | 정보 — 앱 소개, 주요 기능, 지원 데이터베이스, 업데이트 상태 | 라이트 |
| 09 | 버전 기록 — 릴리즈 노트, 이전 버전 설치 | 다크 |
| 10 | GitHub 이슈로 문의하기 | 라이트 |

## 휴대폰 (1080×1920)

01 서버 목록 · 02 테이블 데이터 · 03 SQL 콘솔 · 04 테이블 목록 · 05 빠른 열기 · 06 정보 (모두 다크)

## MinaryHub 등록

저장소가 MinaryHub 조직(`MinaryHub/BangDB.Manager`)에 있으므로 [MinaryHub](https://minaryhub.github.io) 가 자동으로 목록에 올립니다 (3시간마다, 또는 릴리즈 직후 — 아래).

- 이 폴더를 그대로 읽습니다: 영어 페이지는 `en/`, 한국어 페이지는 `ko/` 를 쓰고, 카드에는 그 안의 `desktop-1920x1080/` 묶음이 파일 이름 순으로 쓰이고(최대 10장), `feature-graphic`·`icon` 이름은 건너뜁니다. 공유 미리보기는 첫 PNG(01)를 씁니다. 기본 브랜치(main)의 이미지를 바꾸면 사이트를 다시 배포하지 않아도 10분 안에 반영됩니다.
- 표시 이름·설명·주요 기능·분류는 MinaryHub 저장소 `config.json` 의 `overrides` 에 넣습니다. 붙여 넣을 내용: [`docs/minaryhub.json`](../docs/minaryhub.json).
- 릴리즈 직후 바로 반영하려면 조직(또는 이 저장소) Secrets 에 `SITE_DISPATCH_TOKEN`(MinaryHub.github.io 저장소에 Contents: Read and write 권한만 준 fine-grained PAT)을 넣으세요. 릴리즈 워크플로의 마지막 단계가 사이트 갱신을 요청합니다(토큰이 없으면 건너뜀).
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
node scripts/store-screenshots.mjs                     # 영어 → screenshots/en
UI_LANG=ko node scripts/store-screenshots.mjs          # 한국어 → screenshots/ko
node scripts/store-screenshots.mjs "" 02                # 이름에 02 가 들어간 것만
```

같은 데이터로 찍으면 같은 이미지가 나옵니다(데이터와 화면 크기가 고정). 기능 그래픽은 01 스크린샷을 넣은 HTML 을 1024×500 으로 찍은 것입니다.
