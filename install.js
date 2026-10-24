#!/usr/bin/env node
// sshq 설치: 라이브러리 설치, sshq 명령·Claude 스킬 링크, 접속정보 양식 생성 (맥·리눅스·윈도우 공통)
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const DIR = __dirname;
const WIN = process.platform === 'win32';
const HOME = os.homedir();
const BIN = path.join(HOME, '.local', 'bin');
const SKILLS = path.join(HOME, '.claude', 'skills');
const fail = (msg) => { console.error(msg); process.exit(1); };

if (Number(process.versions.node.split('.')[0]) < 22) fail(`Node 22 이상이 필요합니다. (현재: ${process.version})`);

// 라이브러리 목록(package-lock.json)이 바뀌었을 때만 다시 설치
const mtime = (f) => { try { return fs.statSync(f).mtimeMs; } catch (e) { return 0; } };
const installed = path.join(DIR, 'node_modules', '.package-lock.json');
if (!fs.existsSync(path.join(DIR, 'node_modules')) || mtime(path.join(DIR, 'package-lock.json')) > mtime(installed)) {
  // 윈도우의 npm은 npm.cmd라 셸로 실행한다
  const r = spawnSync('npm', ['ci', '--silent'], { cwd: DIR, stdio: 'inherit', shell: WIN });
  if (r.status !== 0) fail('npm ci 실패');
}

// 서버 파일 사본(work)·백업(backup)·작업 기록(log)이 들어가는 폴더
const PRIVATE = ['work', 'backup', 'log'].map((d) => path.join(DIR, d));
for (const d of [BIN, SKILLS, ...PRIVATE]) fs.mkdirSync(d, { recursive: true });

// 프로젝트마다 .nvmrc로 node가 바뀌어도 설치할 때의 node로 실행되게 고정
// nvm4w의 C:\nvm4w\nodejs는 nvm use로 바뀌는 링크라 실제 버전 폴더의 node로 고정한다
const node = fs.realpathSync(process.execPath);
const script = path.join(DIR, 'sshq');
const sh = path.join(BIN, 'sshq');
fs.rmSync(sh, { force: true });
if (WIN) {
  // Git Bash용: /로 시작하는 인자(원격경로)를 윈도우 경로로 바꾸지 않게 한다
  const fwd = (p) => p.replace(/\\/g, '/');
  fs.writeFileSync(sh, `#!/bin/sh\nexport MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL='*'\nexec "${fwd(node)}" "${fwd(script)}" "$@"\n`);
  // PowerShell·cmd용
  fs.writeFileSync(path.join(BIN, 'sshq.cmd'), `@"${node}" "${script}" %*\r\n`);
} else {
  fs.writeFileSync(sh, `#!/bin/sh\nexec "${node}" "${script}" "$@"\n`);
  fs.chmodSync(sh, 0o755);
  fs.chmodSync(script, 0o755);
}

// 스킬 폴더 링크. 윈도우는 관리자 권한이 필요 없는 junction을 쓴다
const link = path.join(SKILLS, 'sshq');
const target = path.join(DIR, 'skill');
let st = null;
try { st = fs.lstatSync(link); } catch (e) { /* 없음 */ }
if (st && st.isSymbolicLink()) fs.unlinkSync(link);
else if (st) {
  // 예전에 Git Bash의 ln -s가 링크 대신 복사해 둔 sshq 스킬 폴더만 지운다
  const md = path.join(link, 'SKILL.md');
  if (!fs.existsSync(md) || !/^name: sshq$/m.test(fs.readFileSync(md, 'utf8'))) fail(`${link}가 sshq 스킬이 아닌 폴더입니다. 확인 후 지우고 다시 실행하세요.`);
  fs.rmSync(link, { recursive: true, force: true });
}
fs.symlinkSync(target, link, WIN ? 'junction' : 'dir');

// 접속정보 파일과 위 폴더는 본인만 쓰게 한다. 윈도우는 chmod가 듣지 않아 상속 권한을 끊고 본인에게만 준다
// (C:\ 바로 아래 만든 폴더는 기본으로 Users 그룹 전체가 읽을 수 있다)
const conf = path.join(DIR, 'sshq.json');
if (!fs.existsSync(conf)) fs.copyFileSync(path.join(DIR, 'sshq.example.json'), conf);
if (WIN) {
  const user = process.env.USERDOMAIN ? `${process.env.USERDOMAIN}\\${process.env.USERNAME}` : process.env.USERNAME;
  for (const [p, perm] of [[conf, 'F'], ...PRIVATE.map((d) => [d, '(OI)(CI)F'])]) {
    const r = spawnSync('icacls', [p, '/inheritance:r', '/grant:r', `${user}:${perm}`], { encoding: 'utf8' });
    if (r.status !== 0) console.error(`${p} 권한을 바꾸지 못했습니다. 다른 사용자가 읽을 수 없는지 확인하세요. (${(r.stderr || r.stdout || '').trim()})`);
  }
} else {
  fs.chmodSync(conf, 0o600);
}

const sep = WIN ? ';' : ':';
const norm = (p) => { const r = path.resolve(p).replace(/[\\/]+$/, ''); return WIN ? r.toLowerCase() : r; };
if (!(process.env.PATH || '').split(sep).some((p) => p && norm(p) === norm(BIN))) {
  console.log(WIN
    ? `${BIN}을 PATH에 추가하세요 (PowerShell, 새 터미널부터 적용):\n  [Environment]::SetEnvironmentVariable('Path', "$env:USERPROFILE\\.local\\bin;" + [Environment]::GetEnvironmentVariable('Path', 'User'), 'User')`
    : `~/.local/bin을 PATH에 추가하세요: echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc`);
}

console.log(`설치 완료. ${conf}에 접속정보를 입력하세요.`);
