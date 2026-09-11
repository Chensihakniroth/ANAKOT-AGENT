$ErrorActionPreference = 'Stop'

$HomeDir = $PSScriptRoot
$ProxyScript = Join-Path $HomeDir 'bigpickle_proxy.py'
$LogDir = Join-Path $HomeDir 'logs'
New-Item -ItemType Directory -Path $LogDir -Force | Out-Null

$Python = 'D:\School\PROJECT\anakot-agent-home\anakot-agent\venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $Python)) { $Python = 'python' }

function Test-PortListening([int]$Port) {
    return [bool](Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
}

function Wait-PortUp([int]$Port, [string]$Log) {
    for ($i = 0; $i -lt 90; $i++) {
        if (Test-PortListening $Port) { return $true }
        Start-Sleep -Seconds 1
    }
    Write-Host "[warn] port $Port not up after ~90s. Log tail:"
    if (Test-Path -LiteralPath $Log) {
        Get-Content -LiteralPath $Log -Tail 20
    }
    return $false
}

# ---- bigpickle proxy on 8000 (cloud mode) ----
if (Test-PortListening 8000) {
    Write-Host "[ok] bigpickle proxy already running on 8000."
} else {
    Write-Host "[..] starting bigpickle proxy on 8000 (cloud mode)..."
    $proxyOut = Join-Path $LogDir 'proxy.out.log'
    $proxyErr = Join-Path $LogDir 'proxy.err.log'
    Start-Process -FilePath $Python -ArgumentList $ProxyScript, '--mode', 'cloud', '--port', '8000' `
        -WindowStyle Minimized -RedirectStandardOutput $proxyOut -RedirectStandardError $proxyErr
    if (-not (Wait-PortUp 8000 $proxyOut)) { Write-Error 'bigpickle proxy failed to start on 8000' }
    Write-Host "[ok] bigpickle proxy up on 8000."
}

Write-Host ''
Write-Host ' All set: http://127.0.0.1:8000/v1  (api key: anything)  model: big-pickle'