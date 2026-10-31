$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$cli = Join-Path $projectRoot 'node_modules\.bin\supabase.cmd'
$stamp = [guid]::NewGuid().ToString('N')
$envFile = Join-Path ([IO.Path]::GetTempPath()) ('venue-cleanup-' + $stamp + '.env')
$sqlFile = Join-Path ([IO.Path]::GetTempPath()) ('venue-cleanup-' + $stamp + '.sql')
$bytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
$token = [Convert]::ToHexString($bytes).ToLowerInvariant()
$encoding = New-Object Text.UTF8Encoding($false)
try {
  [IO.File]::WriteAllText($envFile, "PHOTO_CLEANUP_TOKEN=$token", $encoding)
  & $cli secrets set --env-file $envFile --workdir $projectRoot
  if ($LASTEXITCODE -ne 0) { throw 'Cleanup secret could not be set.' }
  $sql = "do `$`$ declare existing uuid; begin select id into existing from vault.secrets where name='venue_photo_cleanup_token'; if existing is null then perform vault.create_secret('$token','venue_photo_cleanup_token'); else perform vault.update_secret(existing,'$token'); end if; end `$`$;"
  [IO.File]::WriteAllText($sqlFile, $sql, $encoding)
  & $cli db query --linked --file $sqlFile --workdir $projectRoot
  if ($LASTEXITCODE -ne 0) { throw 'Cleanup vault secret could not be set.' }
  Write-Output 'Cleanup authentication provisioned; secret value was not displayed.'
} finally {
  if (Test-Path -LiteralPath $envFile) { Remove-Item -LiteralPath $envFile }
  if (Test-Path -LiteralPath $sqlFile) { Remove-Item -LiteralPath $sqlFile }
  $token = $null
}
