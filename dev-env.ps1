$projectCache = Join-Path $PSScriptRoot '.build-cache'
$cacheDirectories = @{
    TEMP               = 'temp'
    TMP                = 'temp'
    npm_config_cache   = 'npm'
    NODE_COMPILE_CACHE = 'node-compile'
    GRADLE_USER_HOME   = 'gradle'
}

foreach ($entry in $cacheDirectories.GetEnumerator()) {
    $directory = Join-Path $projectCache $entry.Value
    [IO.Directory]::CreateDirectory($directory) | Out-Null
    [Environment]::SetEnvironmentVariable($entry.Key, $directory, 'Process')
}
