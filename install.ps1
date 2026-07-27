$ErrorActionPreference = "Stop"

function Fail($Message) {
    Write-Error "错误：$Message"
    exit 1
}

function Test-Python312($Command, [string[]]$Arguments) {
    try {
        $script = "import sys; raise SystemExit(0 if sys.version_info >= (3, 12) else 1)"
        & $Command @Arguments -c $script *> $null
        return $LASTEXITCODE -eq 0
    } catch {
        return $false
    }
}

function Find-Python312 {
    if (Get-Command py -ErrorAction SilentlyContinue) {
        if (Test-Python312 "py" @("-3.12")) {
            return @{ Command = "py"; Arguments = @("-3.12") }
        }
    }
    foreach ($candidate in @("python", "python3")) {
        if (Get-Command $candidate -ErrorAction SilentlyContinue) {
            if (Test-Python312 $candidate @()) {
                return @{ Command = $candidate; Arguments = @() }
            }
        }
    }
    return $null
}

$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Join-Path $RootDir "src\backend"
$PyprojectPath = Join-Path $BackendDir "pyproject.toml"
$InstallDir = Join-Path $env:USERPROFILE ".bid-master-cli"
$VenvDir = Join-Path $InstallDir "venv"
$CommandDir = Join-Path $env:LOCALAPPDATA "Programs\BidMaster"
$Launcher = Join-Path $CommandDir "bidmaster.cmd"

if (-not (Test-Path $PyprojectPath)) {
    Fail "请在 bid-master-web 仓库根目录执行：powershell -ExecutionPolicy Bypass -File .\install.ps1"
}

$Python = Find-Python312
if (-not $Python) {
    Fail "未找到 Python 3.12+。请先安装 Python 3.12 或更高版本后重试。"
}

Write-Host "使用 Python：$($Python.Command) $($Python.Arguments -join ' ')"
Write-Host "创建隔离环境：$VenvDir"
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
New-Item -ItemType Directory -Force -Path $CommandDir | Out-Null
& $Python.Command @($Python.Arguments + @("-m", "venv", $VenvDir))
if ($LASTEXITCODE -ne 0) { Fail "创建虚拟环境失败" }

$VenvPython = Join-Path $VenvDir "Scripts\python.exe"
$VenvBidmaster = Join-Path $VenvDir "Scripts\bidmaster.exe"

Write-Host "升级 pip..."
& $VenvPython -m pip install --upgrade pip
if ($LASTEXITCODE -ne 0) { Fail "升级 pip 失败" }

Write-Host "安装 Bid Master CLI 及依赖..."
& $VenvPython -m pip install -e $BackendDir
if ($LASTEXITCODE -ne 0) { Fail "安装 Bid Master CLI 失败" }

@"
@echo off
"$VenvBidmaster" %*
"@ | Set-Content -Path $Launcher -Encoding ASCII

Write-Host "验证 bidmaster 命令..."
& $Launcher --version
if ($LASTEXITCODE -ne 0) { Fail "bidmaster --version 验证失败" }
& $Launcher tools list | Out-Null
if ($LASTEXITCODE -ne 0) { Fail "bidmaster tools list 验证失败" }

$UserPath = [Environment]::GetEnvironmentVariable("Path", "User")
$PathParts = @()
if ($UserPath) {
    $PathParts = $UserPath -split ";" | Where-Object { $_ }
}
if ($PathParts -notcontains $CommandDir) {
    $NewPath = if ($UserPath) { "$UserPath;$CommandDir" } else { $CommandDir }
    [Environment]::SetEnvironmentVariable("Path", $NewPath, "User")
    Write-Host "已将 $CommandDir 加入当前用户 PATH。请重新打开终端后使用 bidmaster。"
}

Write-Host ""
Write-Host "安装完成。"
Write-Host "命令入口：$Launcher"
Write-Host "下一步：执行 bidmaster auth login 登录网页端，然后运行 bidmaster --help 查看用法。"
