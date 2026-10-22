# sshq

Claude Code가 SSH로 서버를 직접 조회하고, 필요하면 백업한 뒤 수정하게 해 주는 명령어와 스킬.

- 조회 명령(`ls`, `cat`, `grep`, `tail`, `find` 등)은 묻지 않고 실행한다.
- 파일 수정은 `get`(내려받기) → 로컬에서 편집 → `diff`(비교) → `put`(서버 홈의 `_sshq_backup/`에 백업 후 업로드) → 확인 → `clean`(로컬 사본 지우기) 순서로 한다.
- 업로드·되돌리기는 백업 후 바로 실행하고, 옮기기·제한 없는 명령은 Claude Code가 실행 전에 사용자 승인을 받는다.

## 설치

Node 22 이상이 필요하다. `install.sh`를 실행할 때의 node로 고정되므로 프로젝트의 `.nvmrc`와 상관없이 동작한다. 그 node 버전을 지우거나 바꾸면 `install.sh`를 다시 실행한다.

```
git clone https://github.com/gidul0491/sshq.git ~/git/sshq
~/git/sshq/install.sh
```

1. `~/git/sshq/sshq.json`에 본인 접속정보를 입력한다. 별칭마다 하나씩, 형식은 `sshq.example.json` 참고.
   - 인증은 `password` 또는 `key`(개인키 파일 경로, 예: `~/.ssh/id_ed25519`) 중 하나를 채운다. 둘 다 비우면 ssh-agent를 쓴다.
   - `root`는 상대경로의 기준 폴더다(카페24 웹호스팅은 보통 `www`). 비우면 홈 폴더 기준이다.
   - `hostkey`는 처음 접속할 때 자동으로 저장된다. 이후 서버 지문이 바뀌면 접속을 중단한다.
2. `~/.claude/settings.json`의 `permissions`에 추가한다.

```
"allow": [ "Bash(sshq *)", "Edit(~/git/sshq/work/**)" ],
"ask":   [ "Bash(sshq del *)", "Bash(sshq exec *)" ],
"deny":  [ "Read(~/git/sshq/sshq.json)", "Edit(~/git/sshq/sshq.json)" ]
```

`allow`는 Claude가 묻지 않고 조회하고 내려받은 사본을 편집하게 하고, `ask`는 옮기기와 제한 없는 명령만 승인을 받게 하고, `deny`는 Claude가 접속정보 파일을 열지 못하게 한다. `~/git/sshq`가 아닌 곳에 받았다면 경로를 바꾼다.

## 사용

```
sshq                                     # 별칭 목록 (현재 프로젝트를 쓰는 별칭에 *)
sshq <별칭> "<명령>"                      # 조회 명령 실행 (root 폴더에서)
sshq get <별칭> <원격경로>                # work/<별칭>/ 아래로 내려받기 (폴더도 가능)
sshq diff <별칭> <원격경로> [로컬경로]     # 원격과 로컬 사본 비교 (폴더면 바뀐 파일·새 파일 목록)
sshq put <별칭> <원격경로> [로컬경로]      # 원격을 ~/_sshq_backup/에 백업한 뒤 업로드 (폴더면 바뀐 파일만 묶음으로)
sshq restore <별칭> <원격경로> [백업]      # 백업으로 되돌리기, 생략 시 가장 최근 백업
sshq restore <별칭> --batch [묶음]         # 폴더 put 묶음 전체 되돌리기, 생략 시 묶음 목록
sshq log <별칭> [줄수]                    # 서버를 바꾼 작업 기록 (기본 50줄)
sshq del <별칭> <원격경로>                # 지우지 않고 ~/_sshq_to_delete/ 아래로 옮기기 (승인)
sshq clean <별칭> [원격경로]              # work/<별칭>/의 로컬 사본 지우기, 생략 시 전부
sshq backup <별칭> [원격폴더]             # backup/<별칭>/에 tar.gz로 받기, 생략 시 홈 전체
sshq exec <별칭> "<명령>"                 # 제한 없는 명령 (승인)
sshq set <별칭> projects +<프로젝트>      # 이 별칭을 쓰는 프로젝트 추가 (-<프로젝트>는 제거)
sshq set <별칭> <root|desc> <값>          # 수정, 빈 값("")이면 비우기
sshq set <별칭> mode readonly             # 읽기 전용 서버로 (put·restore·del·exec 거부, ""면 해제)
sshq new <별칭> [root] [설명]             # 새 서버 양식 추가
sshq version                             # 설치된 버전과 새 버전 확인
sshq update                              # 새 버전으로 업데이트
```

- `projects`에는 프로젝트 이름을 넣는다. git `origin` 저장소 이름 → git 최상위 폴더 이름 → 현재 폴더 이름 순으로 정해지고, `sshq` 첫 줄에 나온다.
- 조회 명령은 허용 목록의 명령을 `|`로 이은 것만 실행된다. 따옴표 밖의 `;` `&&` `||` `>` `<`와 `` ` `` `$(`는 거부된다. `find -exec/-delete`, `git push` 같은 쓰기 옵션도 거부된다.
- `put`은 업로드 전에 원격 파일을 `cp -p`로 백업하고 크기를 확인한다. 백업이 확인되지 않으면 업로드하지 않는다. 원래 파일 권한은 유지한다.
- 백업은 웹에서 열리지 않도록 서버 홈의 `~/_sshq_backup/` 아래에 원래 경로 그대로 둔다. 예: `www/a.php` → `~/_sshq_backup/www/a.php.bak_<시각>`
- `restore`는 되돌리기 직전 상태도 `~/_sshq_backup/` 아래에 `.bak_<시각>_before_restore`로 남긴다.
- 폴더 `get`은 서버에서 tar로 묶어 한 번에 받고, tar를 못 쓰면 파일마다 받는다. 로컬에 이미 있던 파일은 덮어쓰고, 서버에 없는 로컬 파일은 지우지 않는다.
- `backup`은 서버 폴더를 tar.gz 하나로 받아 풀지 않고 보관한다(권한·수정 시각 유지). 홈 전체일 때는 `_sshq_backup`, `_sshq_to_delete`를 뺀다. 받은 뒤 파일 수를 서버와 비교하고, 다르면 서버 경고와 함께 알린다. DB는 포함되지 않는다.
- 폴더 `put`은 로컬 폴더와 원격을 비교해 바뀐 파일과 새 파일만 같은 시각(묶음)으로 백업·업로드하고, 묶음 내용을 `~/_sshq_backup/.batches/<묶음>.json`에 적어 둔다. 서버에만 있는 파일은 지우지 않는다. `restore --batch`는 바꾼 파일을 묶음 직전 백업으로 되돌리고, 새로 만든 파일은 `~/_sshq_to_delete/`로 옮긴다.
- `restore`는 이름의 시각으로 가장 최근 백업을 고른다(백업은 원본 수정 시각을 유지하므로 파일 시각으로 고르지 않는다).
- 서버를 바꾼 작업(put·restore·del·exec)은 `log/<별칭>.log`에 남는다(git 제외).
- `mode`가 `readonly`인 별칭은 put·restore·del·exec를 거부한다. 조회·get·diff·backup은 된다.
- `del`은 지우지 않고 서버 홈의 `~/_sshq_to_delete/` 아래 원래 경로로 옮긴다. 같은 이름이 있으면 뒤에 `_<시각>`을 붙인다. 옮긴 뒤 원래 자리에서 사라졌는지 확인한다.
- `~/_sshq_backup`, `~/_sshq_to_delete` 폴더 권한은 sshq가 700(본인만)으로 맞춘다.
- `~/`로 시작하는 원격경로는 로컬 셸이 바꾸지 않도록 `'~/...'`처럼 따옴표로 감싼다.
- 출력은 최대 2000줄.

## 업데이트

```
sshq version
sshq update
```

`update`는 새 커밋을 받은 뒤 지금 쓰는 node로 `install.sh`를 다시 실행한다. 로컬에서 고친 파일이나 올리지 않은 커밋이 있으면 멈춘다.
