# 개인 MCP 서버 — 설계 및 구현 인계서 (SSOT)

> **상태:** 설계 5단계 완료 / 6-1·6-2-1 완료 · 6-2-2 코드·테스트 작성 완료(실행 검증 대기) · 6-2-3 `read access` 코드·테스트 작성 완료(실행 검증 대기), `write access` 미구현  
> **기준:** 2026-10-22  
> **목적:** 다음 ChatGPT 세션과 Codex Local이 확정된 설계를 공유하고, 한 단계씩 TDD로 구현하기 위한 기준 문서  
> **참고:** 6-2-2의 경로 문자열 검증과 6-2-3의 미완성 접근 정책을 구분한다. 문자열 경계 검증은 실제 파일시스템 접근 보안 검증을 대체하지 않는다.

## 1. 목표와 역할

**목표:** 기존 **ChatGPT 일반 Chat + Codex Local** 워크플로를 유지하면서, ChatGPT가 Ubuntu 로컬 프로젝트를 안전하게 탐색하고 허용된 파일을 생성·수정할 수 있도록 개인 MCP 서버를 구축한다. ChatGPT Work Local로 전면 전환하지 않는다.

| 구성 | 책임 |
|---|---|
| ChatGPT | 요구사항 논의, 설계, 문서 작성·수정, 아키텍처 검토 |
| 개인 MCP 서버 | 로컬 파일 접근 중개, 접근 정책 강제, 충돌 검출, 안전한 저장 |
| Codex Local | 소스 코드 구현, TDD, 리팩터링, 필요한 설계 검토 |
| `AGENTS.md` | Codex 프로젝트별 개발 규칙 |
| 프로젝트 문서/SSOT | ChatGPT와 Codex가 공유하는 설계·진행 기준 |

**역할 경계:** ChatGPT는 프로젝트 소스 코드를 읽을 수 있으나 **쓰기 허용 디렉터리 또는 명시적 예외 파일 밖의 코드를 변경할 수 없다.** 별도의 범용 명령 실행, 임의 삭제·이동 기능도 제공하지 않는다.

## 2. 현재 검증된 환경 (신규 서버 구현 결과가 아님)

- Ubuntu x86-64, 사용자 `eudooyoung`, Node.js **v24.14.1**.
- OpenAI Platform: 개인 Organization `Personal`, 프로젝트·터널 `eudooyoung-mcp`.
- OpenAI Secure MCP Tunnel 및 ChatGPT 개인 워크스페이스 연결 완료.
- 기존 `tunnel-client` **v0.0.16** 실행 파일: `/home/eudooyoung/tools/tunnel-client/tunnel-client`.
- 터널 프로필: `/home/eudooyoung/.config/tunnel-client/eudooyoung-mcp.yaml`.
- 테스트 디렉터리: `/home/eudooyoung/mcp-test` (보존).
- 기존 프로필은 `mcp-command`로 `npx -y @modelcontextprotocol/server-filesystem /home/eudooyoung/mcp-test` 실행.
- 기존 서버로 읽기·수정·수정 후 재읽기·프로젝트 외부 접근 차단을 실제 확인.
- ChatGPT 커스텀 플러그인 `eudooyoung-mcp`: **Allow read actions**, 쓰기에는 사용자 승인을 요구하도록 구성.
- 터널 인증용 환경변수 `CONTROL_PLANE_API_KEY` 사용. **키를 문서·로그·소스에 기록하지 말 것.** 최초 발급 키의 만료 기간은 7일(시험 운영용).

**주의:** 위 검증은 공식 Filesystem MCP에 대한 검증이지 개발 중인 `gpt-helper-mcp`의 보안 검증이 아니다.

## 3. MVP 범위

- 우선 **프로젝트 1개**만 연결. 추후 설정 Allowlist 확장 가능.
- 민감 파일을 제외한 프로젝트 일반 파일을 탐색·검색·읽기 가능.
- **쓰기 허용 디렉터리**에서는 확장자와 무관하게 파일 생성·수정 허용. 첫 구현과 테스트는 **텍스트 파일** 중심. 바이너리 지원을 정책 차원에서 영구 배제하지 않음.
- 지정 디렉터리 밖에서는 **명시적 예외 파일**에만 생성·수정 허용. 예: `AGENTS.md`, `README.md`.
- 생성·수정은 같은 권한 범위로 판단하되, 동작은 별도 도구로 구분. 기존 파일을 `create_file`로 덮어쓰지 않음.
- 사용자 승인, 충돌 검출, 안전한 저장이 핵심.
- **MVP 제외:** 파일 삭제·이동, 임의 셸 명령 실행, 소스 코드 전체 쓰기 권한, Git 조작 도구, 자동 병합, 다중 프로젝트 관리 UI, 전용 승인 UI, OS 샌드박스, 바이너리 전용 편집 기능.
- **후속 고려:** Bubblewrap 격리, 보다 강한 외부 프로세스 동시성 보호, 바이너리 처리 확장, 다중 프로젝트.

## 4. MCP Tools — 총 7개

| 도구 | 읽기/쓰기 분류 | 역할 |
|---|---|---|
| `list_files` | 읽기 | 프로젝트 안의 파일·디렉터리 목록 탐색 |
| `search_text` | 읽기 | 허용된 파일 내 텍스트 검색 |
| `read_file` | 읽기 | 파일 전체/일부 읽기, 원본 SHA-256 제공 |
| `create_file` | 쓰기 | 허용 경로에 새 파일 생성; 같은 이름 존재 시 거부 |
| `edit_file` | 쓰기 | 원본 해시를 받아 기존 파일 직접 수정 |
| `preview_edit` | 읽기 성격의 미리보기* | 수정안 생성·보관, Diff 및 `previewId` 반환; 디스크 불변 |
| `apply_edit` | 쓰기 | 보관된 `previewId`의 수정안을 다시 전달받지 않고 그대로 적용 |

\* `preview_edit`은 디스크를 수정하지 않지만 서버 메모리에는 일시적 상태를 보관한다. MCP 도구 annotation은 실제 부작용 범위에 맞게 지정하고 클라이언트 승인 설정과 함께 검증할 것.

**기본 수정:** `read_file` → `edit_file` → 파일 권한·해시 검사 → ChatGPT 도구 승인 → 디스크 수정.  
**선택적 미리보기:** `read_file` → `preview_edit` → 채팅에서 Diff 검토 → 사용자 요청 시 `apply_edit(previewId)` → 검증 후 저장.

**주의:** Preview 선택 여부와 관계없이 접근 제어·충돌 검출·저장 안전성은 동일하게 강제한다. 대용량 Diff의 채팅 출력은 제한하고, 생성·수정 이후 VS Code/Git에서 검토할 수 있어야 한다.

## 5. 접근 제어 정책

### 5.1 설정 기반 프로젝트 범위

- MCP 실행 프로필과 **별도로** 개인 MCP 서버의 로컬 YAML 설정을 사용.
- `project.root`만 절대경로로 등록한다. 설정의 `writableDirectories`·`writableFiles`와 MCP 도구 요청 경로는 **프로젝트 기준 상대경로만 허용**한다. `..`을 포함해도 정규화한 결과가 프로젝트 내부면 허용하며, 외부로 벗어나면 거부한다. 문자열 검사는 `resolveTargetPath()`에 반영됐으며 MCP Tools 연결은 아직이다.
- MCP Tool을 이용한 프로젝트 등록·권한 확대 **불허**.
- 설정 수정 후 프로세스 재시작으로 반영.
- 프로젝트의 콘텐츠 또는 모델이 보내는 경로는 신뢰하지 않는다.

**설정 예시 — 구현된 YAML 필드:**

```yaml
project:
  root: /home/eudooyoung/repos/example-project

access:
  writableDirectories:
    - docs/
  writableFiles:
    - AGENTS.md
    - README.md
  denyPatterns:
    - "**/secrets/**"
    - "**/private/**"
```

**현재 구현된 설정 검증(6-2-1 및 보완):** `src/config/load.ts`는 `readFile()` → `yaml.parse()` → `configSchema.parse()` 순으로 설정을 읽고 검증한다. `Config` 타입은 `z.infer`로 추론한다.

- `project.root`: 필수 절대경로 문자열.
- `access`: 필수 객체. `writableDirectories`, `writableFiles`, `denyPatterns` 세 문자열 배열은 생략 시 각각 `[]`를 기본값으로 사용한다(`access: {}` 허용).
- `writableDirectories`, `writableFiles`: 공통 `relativePathSchema`로 절대경로와 빈 문자열을 거부한다. `configSchema.superRefine()`에서 `resolveTargetPath()`를 재사용해 경계 이탈을 거부하며, 내부 `..` 경로는 허용한다. 읽은 설정 문자열은 정규화하지 않고 원형을 유지한다. `writableDirectories: [.]`은 전체 쓰기 허용을 *명시적으로 요청*하는 설정이며 기본값이 아니다.
- `denyPatterns`는 사용자 Glob 문자열 목록으로 설정한다. `assertAccess()`는 `resolveTargetPath()`로 정규화한 뒤 프로젝트 상대경로로 변환하여 Default 및 Custom Denylist에 동일한 `node:path.matchesGlob()` 매칭을 적용한다. `read` 정상·차단 경로의 코드와 테스트는 작성했지만 실제 실행 결과는 아직 확인하지 않았다.
- `write` 접근 판단, 심볼릭 링크 차단, 실제 파일시스템 접근 제어 및 MCP Tools 연동은 미완성이다. `assertAccess()`의 현재 `write` 동작을 허용 정책 구현 완료로 간주하지 않는다.

설정 파일 위치: `~/.config/personal-mcp/config.yaml` (프로젝트 루트 밖). 프로젝트별 `.env`를 서버 키 저장소로 사용하지 않는다.

### 5.2 정책 우선순위

**민감 파일 차단 > 프로젝트 경계 및 심볼릭 링크 차단 > 읽기/쓰기 허용 판단.**

| 대상 | 읽기 | 생성 | 수정 |
|---|:---:|:---:|:---:|
| 쓰기 허용 디렉터리 내 일반 파일 | O | O | O |
| 그 외 프로젝트 내 일반 파일 | O | X | X |
| 등록된 예외 파일 (`AGENTS.md`, `README.md` 등) | O | O | O |
| 차단 규칙과 일치하는 민감 경로 | X | X | X |
| 프로젝트 바깥 | X | X | X |
| 심볼릭 링크 경유 경로 | X | X | X |

- 기본 Denylist를 내장하고 사용자 설정에서는 **차단 규칙 추가만** 허용한다. 6-2-3의 임시 내장 패턴은 `**/.env`이며(루트·하위 경로의 `.env` 대상), **최종 기본 차단 목록 선정은 후속 결정**이다. 이번 논의에서는 `.env.*`, `.git/**`를 기본 목록에 추가할 필요가 없다는 의견을 확인했다.
- 기본·사용자 규칙은 모두 정규화된 **프로젝트 상대경로**에 Glob을 적용한다. 사용자 `denyPatterns`는 입력한 패턴 그대로 사용하며 임의로 확장하지 않는다. 예컨대 `**/secrets/**`는 `src/secrets/file.txt`에는 매칭되지만 `src/secrets` 자체에는 매칭되지 않는다. 디렉터리 이름까지 숨기려면 디렉터리 자체에 매칭되는 규칙도 필요하므로 6-3 목록·검색 Tool에서 해당 정책을 검증한다.
- `assertAccess()`는 정규화된 요청 경로의 정책상 허용 여부만 판단하며, 파일·디렉터리 유형과 존재 여부는 개별 Tool이 검증한다. `list_files`는 요청 디렉터리를 검사하고, 반환할 항목 각각에 차단 정책을 적용하여 차단된 이름도 숨긴다. Denylist에 해당하지 않는 `.vscode` 등 숨김 경로는 이름이 `.`으로 시작한다는 이유만으로 숨기지 않는다.
- 목록·검색·읽기 모두 차단 정책 적용. **검색은 민감 파일을 먼저 제외하고 검색해야** 파일 내용이 검색 도구나 결과에 섞이지 않는다.
- `.gitignore`는 성능상 탐색 범위 조정에 참고할 수 있지만 보안 정책을 대신하지 않는다.
- 기본적으로 모든 심볼릭 링크 경유 접근을 거부(6-2-4 예정). 상대경로의 `..` 정규화 결과가 프로젝트 밖이면 차단하고, 절대경로 입력 및 인코딩·경로 정규화 우회도 검증한다.
- 파일명 기반 차단만으로 소스에 하드코딩된 비밀정보를 완전히 막을 수 없음.

### 5.3 구현 시 별도 검증할 공격면

`realpath`나 `lstat` 기반 경로 검사만으로 **검사 후 대상 교체(TOCTOU)**가 해결되지는 않는다. **하드링크, 설정 파일과 파일시스템 접근 권한, 특수 파일(FIFO/장치), 파일 크기·검색 결과 상한**도 테스트/감사에서 판단한다. 단순 확장자 검사로 파일 형식이나 안전성을 가정하지 않는다.

## 6. 안전한 변경 정책

### 6.1 사용자 승인

- 기본 승인은 ChatGPT의 **쓰기 도구 승인** 사용. Ubuntu에서 두 번째 승인 창은 만들지 않음.
- 서버는 승인 UI가 아니라 **파일 접근 권한과 내용·충돌 검증**을 강제한다.
- ChatGPT 승인은 서버가 독립적으로 승인 사실을 증명하는 장치가 **아님**. 실제 쓰기 승인 설정과 위험도 표시를 통합 테스트할 것.
- 사용자 요청 시에만 `preview_edit`; 일반 작업은 바로 승인 후 수정 가능.

### 6.2 SHA-256 낙관적 충돌 검출

- `read_file`에서 내용과 SHA-256 해시 반환.
- `edit_file` 요청에는 해당 **원본 해시 필수**.
- 승인·저장 과정에서 파일 현재 해시와 비교; 불일치하면 **수정 거부 및 재읽기 요청**.
- 자동 병합 없음. 같은 파일의 MCP 쓰기 작업은 서버 내부 **파일별 비동기 큐(Map)**로 직렬화.
- 큐는 외부 Codex·VS Code 프로세스를 잠그지 못함.

### 6.3 저장 방식

- 기존 파일은 **동일 디렉터리 임시 파일 작성 → 정상 기록 확인 → 권한·메타데이터 고려 → 교체 직전 충돌 재검사 → `rename()`** 방식 목표.
- 임시 파일 이름은 무작위로 지정하고, 실패 시 안전하게 정리.
- `rename`의 원자성은 같은 파일시스템의 일반적인 교체 동작에 대한 것. 외부 프로그램이 마지막 검사와 교체 사이에 수정하는 경쟁 조건까지 해결하지 않는다.
- 파일 생성 시 **기존 경로가 있으면 실패**. 실수로 덮어쓰기 되지 않도록 배타적 생성(`wx` 등)과 부분 파일 방지의 구체적인 조합을 구현 단계에서 검증.
- 전원 장애에 대한 더 강한 내구성(`fsync` 등), 파일 권한·소유권·하드링크 영향은 구현 시 테스트·위험 판단 필요.

### 6.4 Preview

- `preview_edit`의 수정안·원본 해시를 **서버 메모리**에 임시 저장.
- `previewId` 발급, 만료 시간·항목 개수·용량 제한, 재시작 시 폐기.
- `apply_edit(previewId)`는 **저장된 변경안**을 사용하고 새 변경 내용을 입력받지 않음.
- 적용 직전 권한·원본 해시·충돌 재검증. 불일치 시 거부.
- 긴 Diff는 길이 제한 및 생략 표시. VS Code/Git Diff 검토는 별도 유지.

### 6.5 VS Code 미저장 편집

- 서버는 디스크 내용을 기준으로 작동하므로 VS Code의 **미저장 버퍼**는 알 수 없음.
- MCP가 먼저 디스크를 바꾼 후 VS Code가 저장하면 편집기의 저장 충돌 감지 기능에 의존할 수 있지만, 사용자 강제 덮어쓰기는 가능함.
- 실제 동작을 수동 통합 테스트하고 이를 완전한 동시 수정 보장으로 표현하지 말 것.

## 7. 기술 스택과 모듈 구조

- **Node.js 24**, **TypeScript + ESM**.
- **MCP TypeScript SDK v2:** `@modelcontextprotocol/server` (v1의 `@modelcontextprotocol/sdk` 예제와 구분).
- **Zod v4**, **Vitest**, **Oxlint**, **Oxfmt**, TypeScript/`@types/node`.
- `fs`, `path`, `crypto` 등은 Node.js 내장 모듈 우선. YAML 파서 `yaml@2.9.1`은 일반 의존성으로 추가했으며, Diff·Glob 등은 필요 시 검증된 최소 의존성 추가.
- npm 의존성은 **정확한 버전 + `package-lock.json`** 관리. 설치 재현에는 `npm ci`.
- `npm run build` (`tsc -p tsconfig.build.json`)로 `src/`만 컴파일 → `node dist/main.js` 실행. `npm run typecheck`는 기본 `tsconfig.json`을 사용하여 `src/`와 `tests/`를 출력 없이 타입 검사한다. 실제 운영은 빌드 결과만 실행; 변경 시 테스트·빌드 후 재시작.
- HTTP/Express/WebSocket 서버는 **도입하지 않음**. `tunnel-client`가 서버를 `mcp-command`로 시작하고 **stdio**로 통신.
- `stdout`은 MCP 메시지 전용, 운영/진단 로그는 `stderr`.

**역할별 모듈 분리:**

```text
src/
  main.ts            # stdio 진입점 및 서버 연결
  server.ts          # MCP 서버 생성 및 Tool 등록
  tools/             # 도구 등록·입력 검증·응답 변환
  path/              # 공통 경로 해석·문자열 기준 프로젝트 경계 검증
  policy/            # 파일 접근 권한·Denylist·심볼릭 링크 정책 (예정)
  files/             # 읽기·검색·생성·수정·해시·안전 저장
  config/            # YAML 파싱·검증
  preview/           # 수정안 보관·Diff
  audit/             # 감사 기록
```

현재 테스트는 루트 `tests/`에 둔다. `config.test.ts`는 15개(정상 2, 타입 실패 5, 경로 허용 1·거부 7), `path.test.ts`는 6개(유효 3·거부 3)다. `access.test.ts`는 미완성으로 단언문 누락과 이전 함수명 참조 등이 남아 있다. `ping.test.ts`/`ping.stdio.test.ts`는 InMemory/빌드된 stdio 연결을 검증한다. 실제 테스트·typecheck·lint·빌드 최신 실행 결과는 확인하지 않았다.

이후 모듈 디렉터리 구조는 **책임 분리 예시**이며, 불필요한 추상화·파일 세분화는 구현하면서 조정 가능. MCP Tools는 파일시스템 접근을 직접 하지 않고 공통 서비스·정책을 통과해야 한다.

## 8. 프로젝트·설정·로그 경로

```text
~/repos/gpt-helper-mcp/               # 개발 Git 프로젝트
~/tools/tunnel-client/                # 기존 터널 실행 파일
~/.config/personal-mcp/config.yaml    # 프로젝트 및 권한 설정
~/.config/tunnel-client/              # 기존 터널 프로필
~/.config/tunnel-client/.env          # 터널 API 키 예정 (아직 만들지 않음)
~/.local/state/personal-mcp/          # 감사 로그
~/mcp-test/                           # 기존 Filesystem MCP 테스트 보존
```

- `start-mcp.sh` 스크립트는 향후 `.env`를 안전하게 읽어 환경변수로 주입한 후 `tunnel-client run --profile eudooyoung-mcp` 실행.
- `.env` 권한 제한(예: `chmod 600`) 및 비밀 정보 Git 제외. 권한 변경 명령은 **의미와 옵션 설명 후** 진행.
- 터널 시작·종료·재시작은 우선 **수동 운영**. 비정상 종료 자동 재시작 및 `systemd --user`는 제외.
- OpenAI API 키는 수동 발급·갱신. 최초 7일 만료는 테스트용이며 장기 운영 만료 기간은 이후 결정. 별도 Admin 키를 이용한 자동 발급은 도입하지 않음.
- MCP 서버가 터널 API 키를 읽거나 전달받을 필요 없음. 자식 프로세스로 불필요하게 **키 환경변수가 상속되지 않도록 분리**하는 방안은 운영 통합 시 검증.
- 기존 `eudooyoung-mcp.yaml`의 `mcp-command`만 신규 빌드 서버 실행 명령으로 전환. 기존 파일시스템 테스트 환경은 유지.

## 9. 감사 로그 및 오류 처리

- `stderr`: 서버 실행 오류·설정 문제 진단 (stdio의 `stdout` 오염 금지).
- `~/.local/state/personal-mcp/`의 JSONL: 도구명, 시각, 성공/거부/실패, 소요 시간, 차단 사유 등 기록.
- **파일 내용, API 키, 인증 토큰, 민감 경로의 상세 정보는 기록하지 않음.** 로그 크기 제한 및 순환 보관.
- MCP 응답 오류는 내부 절대경로·스택·민감정보를 노출하지 않음.

## 10. 테스트 전략 (Vitest / TDD)

| 테스트 층 | 범위 |
|---|---|
| 단위 | 설정 스키마, 경로·권한 정책, 해시, Diff, 미리보기 수명 |
| 로컬 파일시스템 통합 | 임시 디렉터리에서 읽기·생성·수정·실패·권한·충돌·저장 검증 |
| MCP 통합 | InMemoryTransport와 빌드된 서버의 stdio 연결에서 도구 등록·호출·응답 검증 |
| 수동 실제 연결 | 7단계에서 OpenAI Tunnel·ChatGPT 승인·VS Code 충돌 확인 |

- 테스트마다 **격리된 임시 디렉터리** 사용. 실사용 소스 트리에 파괴적 테스트 금지.
- **기능별 수직 TDD:** 테스트 설계 확정(파일별 책임·기존 테스트 중복·성공/실패·경계 검토) → 정상 경로 RED → GREEN → REFACTOR → 실패·예외·보안 RED/GREEN → 다음 기능. 공통 내부 함수의 테스트는 대표 사례를 사용하되, 보안상 중요한 서로 다른 설정 필드의 공개 입력 계약은 필드별로 검증한다.
- 경쟁 조건 테스트: 해시 검사·승인·교체의 정해진 지점에서 테스트 훅/제어된 Promise 등으로 다른 쓰기를 주입해 **결정적으로 재현**; 반복 동시 테스트는 보조.
- 추가 검증: symlink 경유, `.env`/`.git` 차단, 목록·검색 누출, 기존 파일 생성 거부, 승인 거부 시 불변, 재시작 시 preview 무효, 메타데이터 유지, 불완전 파일 정리, VS Code 미저장 편집.
- 공통 완료 기준: 테스트 통과, `tsc` 타입 검사, Oxlint 검사, 코드 검토/리팩터링 완료.

## 11. 구현 순서 및 담당 (고정 아님)

| 순서 | 작업 | 제안 담당 | 해당 단계 완료 조건 |
|---|---|---|---|
| 1 | TS/ESM 초기화, 간단한 MCP Tool, stdio 실행 | **직접 구현 추천** | MCP 호출 성공 |
| 2 | YAML 설정·접근 제어 | Codex + 직접 검토 | 허용·차단 테스트 통과 |
| 3 | 목록·검색·읽기 Tool | 직접 구현 고려 | 3개 Tool 및 읽기 보안 검증 |
| 4 | 파일 생성·수정·충돌 검출·저장 | Codex | 생성·수정·실패·경쟁 테스트 통과 |
| 5 | Preview·Diff·apply | Codex | 미리보기와 적용 내용 일치 |
| 6 | 감사 로그·오류 응답 및 연동 준비 | 공동 검증 | 로그·오류 처리·빌드 확인 |

**6-1 구현 완료:** Node.js 24 / TypeScript ESM / MCP SDK v2 기반 `ping` Tool 및 stdio 진입점 구현. InMemory·stdio 통합 테스트, 루트 `tests/` 분리, 빌드·타입 검사 구성 분리(`tsconfig.build.json`, `tsconfig.json`). 실제 터널 연결은 아직 수행하지 않았다.

**6-2 진행 현황:** 6-2-1 설정 로더·검증 완료. 6-2-2 `resolveTargetPath()` 경계 검증과 테스트 6개 작성·GitHub 검토 완료(실행 검증 대기). 6-2-3 `read access` 정상 경로·Denylist 차단 테스트 4개와 코드 작성·GitHub 재검토 완료(실행 검증 대기); `write access` 미구현. 심볼릭 링크, MCP 연동, 실제 파일 접근 보안 검증은 남아 있다.

### 6-2-3 테스트 설계·구현 인계 (2026-10-22, `read` 작성 완료·실행 미확인)

- `assertAccess()`의 권한은 `read`·`write` 두 가지. 경로 접근 정책만 판단하며 파일·디렉터리 유형과 존재 여부는 Tool 책임. 생성·수정은 `write`이며 실제 저장·충돌 처리는 후속 단계의 책임이다.
- **`read access` 정상 경로:** `.`(프로젝트 루트)와 `src/main.ts`(프로젝트 내부 하위 경로) 각각 읽기 허용 및 절대경로 반환을 검증한다. 파일·디렉터리를 별개 분기로 테스트하지 않는다. 테스트 설정의 `writableDirectories`·`writableFiles`는 빈 배열로 유지한다.
- **Denylist 차단 테스트:** Default 패턴 `**/secrets/**`를 Mock하고 `src/secrets/info.txt` 요청의 거부를 검사한다. Custom `denyPatterns: ["**/private/**"]`에서 `src/private/notes.md`의 거부를 검사한다. Denylist 불일치 시 허용 테스트 및 Default·Custom 조합 테스트는 이번 범위에서 제외한다.
- **현재 구현:** `resolveTargetPath()`로 경계 확인·정규화 → `relative(root, resolvedTargetPath)`로 프로젝트 상대경로 계산 → Default/Custom 모두 `matchesGlob()` 적용. 임시 실제 Default 패턴은 `**/.env`. 테스트의 Mock과 실제 내장 목록의 동작은 구분한다.
- **미확인:** Vitest·타입 검사·린트·빌드의 최신 실행 결과, 완성된 기본 Denylist 목록, 디렉터리 경로 자체 매칭, `write access`, 심볼릭 링크와 Tool 연동. `list_files(".")`는 허용하고, 차단 경로는 이름도 누출하지 않으며, 차단되지 않은 숨김 경로는 보이는 정책을 6-3에서 검증한다.
- **다음:** `write access` 정상 경로부터 테스트를 설계하고, 차단 및 정책 우선순위 검증으로 진행한다.
담당은 세션별로 바꿀 수 있음. 사용자가 MCP 원리를 익히기 위해 초기 서버와 간단한 도구를 직접 구현할 여지 유지.

## 12. 추후 단계

- **6단계 구현:** 위 순서에 따라 한 작업씩 TDD, 성공·실패 기준 충족 시 다음 단계.
- **7단계 실환경 통합:** 기존 터널 프로필 전환, 정상 읽기·쓰기, 승인, 차단, 충돌, VS Code 저장 동작 검증.
- **8단계 보안 감사 및 운영 문서:** 권한 우회·TOCTOU·비밀 노출·로그·의존성·API 키·복구 전략 점검. 별도 고강도 리뷰 실행.
- **후속 보안 강화:** Bubblewrap 기반 OS 샌드박스 검토. MVP 필수 아님.

## 13. 구현 전에 확인할 미결정 / 수용 위험

다음은 **확정된 구현 세부사항이 아니다.** 구현 중 설계 질문이 생기면 결정·기록할 것.

- `create_file`의 부모 디렉터리 미존재 처리, 텍스트/바이너리 입력 범위, 허용 경로의 파일 생성 보장 방법.
- 원자적 교체와 외부 프로세스 동시 쓰기 사이의 TOCTOU. 해시 재검사만으로 무손실 보장 불가.
- 소유권·모드·하드링크·특수 파일 처리; 임시 파일 교체로 생기는 메타데이터 변화.
- 민감 경로 패턴 매칭의 정확한 의미 및 차단 우선순위; 검색에서 차단 대상 **사전 배제**.
- 운영 계정 자체의 OS 권한 범위. 서버 정책이 우회되면 사용자 계정이 읽을 수 있는 파일에 접근할 가능성.
- ChatGPT Tool 승인 정책이 세션·설정에서 실제로 어떻게 작동하는지 및 `preview_edit` 분류.
- `search_text` 엔진(ripgrep 등), YAML/Glob/Diff 라이브러리, 입력·출력 상한 및 정확한 버전.
- API 키 환경변수 상속 차단과 로그 파일 권한 관리.

## 14. 세션 진행 규칙

1. **한 번에 한 단계씩**, 사용자 확인 후 다음 작업 진행.
2. 설계 선택 시 **대안 비교 → 추천과 근거 → 결정** 순서.
3. 구현 전 의사코드 우선. 사용자가 요청하기 전에는 실제 구현을 한꺼번에 제시하지 않음.
4. 구현은 Codex Local 중심, 필요 시 사용자 직접 구현으로 전환.
5. 각 테스트 파일을 시작하기 전에 파일별 검증 책임·전체 케이스·기존 테스트 중복·변경으로 사라지는 검증을 확인한 뒤, 성공 경로부터 TDD로 실패·예외·보안 경로까지 검증.
6. Linux 명령 안내 시 **무엇을 확인/변경하며 옵션이 무엇을 뜻하는지** 설명.
7. 확정된 요구사항과 미해결 보안 위험을 혼동하지 않음.
8. 보안 감사에는 사용 가능한 최신 GPT 모델에서 **High 이상**의 추론 수준을 구체적으로 선정하여 실행.
9. 테스트 설계는 **실제로 미결정인 쟁점에 질문 하나 → 사용자 답변 → 합의** 순서로 진행한다. 이미 확정한 사항을 반복 질문하거나 추천안을 먼저 확정하고 단순 동의를 요구하지 않는다. 반문이 나오면 그 쟁점을 해결한 후 원래 질문 흐름으로 복귀한다.
10. **이미 확정된 구현에 대한 메모는 핵심 결과·검증 상태만 짧게 남기고 중복 설명하지 않는다.** 미결정 사항과 다음 작업을 우선 기록한다.

---

**다음 작업:** **6-2-3 `write access` 정상 경로 테스트 설계**부터 재개한다. `read access` 설계는 확정되어 있으므로 이미 합의된 사항을 다시 묻지 않는다. 쓰기 권한 경계·기본/사용자 차단·차단 우선순위를 순서대로 함께 검토한 뒤 TDD 구현으로 넘어간다.

**참고 구현:** [공식 MCP TypeScript SDK v2](https://github.com/modelcontextprotocol/typescript-sdk) · [공식 Filesystem MCP](https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem)
