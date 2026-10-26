#!/bin/sh
# sshq 설치는 install.js가 한다 (맥·리눅스·윈도우 공통). 예전 설치 방법과 sshq update 호환용
DIR="$(cd "$(dirname "$0")" && pwd)"
command -v node >/dev/null 2>&1 || { echo "Node 22 이상이 필요합니다. (현재: 없음)"; exit 1; }
exec node "$DIR/install.js"
