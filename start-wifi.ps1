param(
    [switch]$Server,
    [switch]$Check,
    [switch]$AllowFirewall,
    [string]$Address
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'dev-env.ps1')

if (-not $Address) {
    $addresses = @(
        foreach ($adapter in [Net.NetworkInformation.NetworkInterface]::GetAllNetworkInterfaces()) {
            if ($adapter.OperationalStatus -ne 'Up' -or $adapter.NetworkInterfaceType -ne 'Wireless80211') { continue }
            $properties = $adapter.GetIPProperties()
            if (-not @($properties.GatewayAddresses | Where-Object { $_.Address.AddressFamily -eq 'InterNetwork' }).Count) { continue }
            foreach ($entry in $properties.UnicastAddresses) {
                if ($entry.Address.AddressFamily -eq 'InterNetwork' -and $entry.Address.ToString() -notlike '169.254.*') {
                    $entry.Address.ToString()
                }
            }
        }
    ) | Select-Object -Unique
    if (@($addresses).Count -ne 1) {
        throw 'Cannot select Wi-Fi address. Use: .\start-wifi.ps1 -Address YOUR_WIFI_IPV4'
    }
    $Address = @($addresses)[0]
}
$parsedAddress = $null
if (-not [Net.IPAddress]::TryParse($Address, [ref]$parsedAddress) -or $parsedAddress.AddressFamily -ne 'InterNetwork') {
    throw 'Address must be an IPv4 address.'
}

Write-Host "Wi-Fi: $Address"
Write-Host "Phone API check: http://${Address}:3000/api/health"
Write-Host "Phone Expo check: http://${Address}:8082/status"
if ($AllowFirewall) {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw 'Open PowerShell as administrator and run: .\start-wifi.ps1 -AllowFirewall'
    }
    $ruleName = 'ITPZ-WiFi-Dev'
    $nodePath = (Get-Command node -ErrorAction Stop).Source
    if (Get-NetFirewallRule -Name $ruleName -ErrorAction SilentlyContinue) {
        Set-NetFirewallRule -Name $ruleName -Enabled True -Direction Inbound -Action Allow `
            -Protocol TCP -LocalPort 3000,8082 -RemoteAddress LocalSubnet `
            -Profile Any -InterfaceType Wireless -Program $nodePath | Out-Null
    } else {
        New-NetFirewallRule -Name $ruleName -DisplayName 'ITPZ Wi-Fi development' `
            -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3000,8082 `
            -RemoteAddress LocalSubnet -Profile Any -InterfaceType Wireless -Program $nodePath | Out-Null
    }
    Write-Host 'Firewall rule ready (Wi-Fi, local subnet, Node.js, ports 3000/8082, all network profiles).'
    return
}
if ($Check) {
    foreach ($endpoint in @("http://${Address}:3000/api/health", "http://${Address}:8082/status")) {
        try {
            $request = [Net.HttpWebRequest]::Create($endpoint)
            $request.Proxy = $null
            $request.Timeout = 5000
            $response = $request.GetResponse()
            try {
                $reader = New-Object IO.StreamReader($response.GetResponseStream())
                try { Write-Host "$endpoint -> $($reader.ReadToEnd())" } finally { $reader.Dispose() }
            } finally { $response.Dispose() }
        } catch { Write-Warning "$endpoint -> $($_.Exception.Message)" }
    }
    return
}

# Apply only to the processes launched here; leave the system VPN settings alone.
$env:NO_PROXY = "localhost,127.0.0.1,$Address"
$env:no_proxy = $env:NO_PROXY
Push-Location $PSScriptRoot
try {
    if ($Server) {
        $env:HOST = $Address
        $env:PORT = '3000'
        Set-Location server
        & node index.js
    } else {
        $env:REACT_NATIVE_PACKAGER_HOSTNAME = $Address
        $env:EXPO_PUBLIC_API_URL = "http://${Address}:3000"
        Remove-Item Env:EXPO_PACKAGER_PROXY_URL -ErrorAction SilentlyContinue
        Set-Location mobile
        & node --dns-result-order=ipv4first ./node_modules/expo/bin/cli start --go --lan --port 8082 --clear
    }
    if ($LASTEXITCODE -ne 0) { throw "Server exited with code $LASTEXITCODE" }
} finally {
    Pop-Location
}
