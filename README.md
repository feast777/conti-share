# 찬양팀 콘티 공유

콘티(악보 모음)를 팀원끼리 공유하는 웹앱. 상단에 악보, 하단에 유튜브 레퍼런스,
곡·페이지 넘기기, 악보 위 손글씨 메모를 지원한다.

## 화면 구성

| 경로 | 하는 일 |
| --- | --- |
| `/login` | 이름 + 팀 공용 비밀번호로 입장 |
| `/` | 콘티 목록, 새 콘티 만들기 |
| `/conti/[id]` | **보기 화면** — 악보 · 레퍼런스 · 손글씨 메모 (팀원 전원) |
| `/conti/[id]/edit` | **편집 화면** — 곡 · 악보 · 레퍼런스 등록 (인도자) |

편집 화면은 보기 화면 오른쪽 위 **편집** 버튼으로 들어간다.

### 편집 화면에서 할 수 있는 것

- 콘티 이름 · 날짜 · 전체 안내사항
- **곡 추가** (제목 입력 후 Enter), 순서 바꾸기 ▲▼, 삭제
- 곡별 **Key · BPM · 송폼 메모**
- **악보 업로드** — `+ PDF · 이미지` (PDF 여러 장, jpg/png 여러 개 한 번에)
- **레퍼런스 추가** — 유튜브 링크 + 이름(`원곡`, `우리 편곡` 등). 곡당 여러 개
- **복사** — 지난 콘티를 곡·악보·레퍼런스까지 통째로 복제

모든 입력은 타이핑을 멈추면 자동 저장된다 (저장 버튼 없음).

### 보기 화면 조작

- **곡 넘기기** — 화면 좌우 끝 탭, 좌우 스와이프, 방향키, PageUp/PageDown, 스페이스
  (블루투스 페이지터너 페달 그대로 동작). 한 곡의 마지막 장 다음은 다음 곡 첫 장.
- **곡 바로가기** — 상단 곡 목록 탭
- **✎ 메모** — 펜 / 형광펜 / 지우개, 색상·굵기 선택, 되돌리기(Ctrl+Z), 페이지 전체 지우기
- **👥** — 다른 팀원이 쓴 메모 겹쳐 보기 (내 메모만 내가 수정 가능)
- **화면/폭** — 한 장 전체 맞춤 ↔ 가로 폭 맞춤(세로 스크롤)

메모는 악보 크기 대비 비율로 저장되므로 폰·태블릿·PC 어디서 봐도 같은 자리에 얹힌다.

## 처음 세팅

### 1. Supabase 프로젝트 만들기

[supabase.com](https://supabase.com) 에서 무료 프로젝트를 만든 뒤:

1. **SQL Editor** 에 `supabase/schema.sql` 내용을 붙여넣고 실행
2. **Storage** 에서 `sheets` 이름으로 버킷 생성 — **Public 체크 해제** (비공개)
3. **Project Settings → API** 에서 `Project URL` 과 `service_role` 키 복사

### 2. 환경변수

`.env.local.example` 을 `.env.local` 로 복사하고 채운다.

```bash
cp .env.local.example .env.local
```

`SESSION_SECRET` 은 아래로 생성:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. 실행

```bash
npm install
npm run dev
```

### 4. 배포 (Vercel)

GitHub 에 올린 뒤 Vercel 에서 import 하고, 위 환경변수 4개를 그대로 등록하면 된다.
팀원들은 배포된 주소 + 팀 비밀번호만 알면 폰으로 바로 접속한다.

## 이번 주 콘티 한 번에 넣기

`scripts/seed-conti.mjs` 에 이번 주 콘티(곡·송폼·키·유튜브 링크·악보 파일)가 들어 있다.
Supabase 를 연결한 뒤 실행하면 그대로 등록된다.

```bash
node --env-file=.env.local scripts/seed-conti.mjs
```

악보 이미지는 기본적으로 `%USERPROFILE%\Downloads` 에서 찾는다. 다른 폴더면
`SHEET_DIR` 환경변수로 지정한다.

## 구조

```
src/app/actions.ts        서버 액션 (로그인 · 콘티/곡/악보/레퍼런스/메모 저장)
src/lib/auth.ts           팀 비밀번호 + 서명 쿠키 세션
src/lib/db.ts             Supabase 서버 클라이언트 (service role)
src/lib/queries.ts        콘티 조회 + 악보 임시 열람 URL 발급
src/components/
  ContiViewer.tsx         보기 화면 전체 (곡/페이지 이동, 필기 도구, 자동 저장)
  SheetStage.tsx          악보 1장 렌더 (PDF/이미지 + 크기 맞춤)
  AnnotationCanvas.tsx    손글씨 캔버스 (펜·형광펜·지우개)
  ContiEditor.tsx         편집 화면 전체
  ReferencePanel.tsx      유튜브 레퍼런스
```

악보 파일은 Supabase Storage 의 비공개 버킷에 두고, 열람할 때마다 서버가
2시간짜리 서명 URL 을 발급한다. `service_role` 키는 서버에서만 쓰이고
브라우저로 나가지 않는다.

## 점검용 스크립트

```bash
# 테이블 · 버킷 연결 확인
node --env-file=.env.local scripts/check-supabase.mjs

# 특정 사람이 그린 손글씨 전부 삭제 (테스트 정리용)
node --env-file=.env.local scripts/clear-test-annotations.mjs 이름
```
