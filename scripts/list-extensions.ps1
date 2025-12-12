# Cursor 확장 프로그램 목록 추출 스크립트
# 작성일: 2025-01-27

$extensionsJsonPath = "C:\Users\dalko\.cursor\extensions\extensions.json"
$outputPath = "f:\mobinogi\calc-runes\cursor-extensions-list.txt"

try {
    Write-Host "확장 프로그램 파일 읽는 중..." -ForegroundColor Cyan
    Write-Host "파일 경로: $extensionsJsonPath"
    
    if (-not (Test-Path $extensionsJsonPath)) {
        throw "파일을 찾을 수 없습니다: $extensionsJsonPath"
    }
    
    $jsonContent = Get-Content $extensionsJsonPath -Raw -Encoding UTF8
    Write-Host "파일 크기: $($jsonContent.Length) bytes" -ForegroundColor Green
    
    $data = $jsonContent | ConvertFrom-Json
    Write-Host "JSON 파싱 성공" -ForegroundColor Green
    
    $extensions = @()
    $keys = $data.PSObject.Properties.Name
    
    Write-Host "확장 프로그램 정보 추출 중... ($($keys.Count)개)" -ForegroundColor Cyan
    
    foreach ($key in $keys) {
        $value = $data.$key
        if ($value -is [PSCustomObject]) {
            $extensions += [PSCustomObject]@{
                ID        = $key
                Name      = if ($value.name) { $value.name } else { "N/A" }
                Publisher = if ($value.publisher) { $value.publisher } else { "N/A" }
                Version   = if ($value.version) { $value.version } else { "N/A" }
                Enabled   = if ($null -eq $value.enabled) { $true } else { $value.enabled }
            }
        }
    }
    
    # 이름 순으로 정렬
    $extensions = $extensions | Sort-Object Name
    
    Write-Host "`n총 확장 프로그램 수: $($extensions.Count)" -ForegroundColor Yellow
    Write-Host ("=" * 100)
    
    # 콘솔 출력
    Write-Host ("{0,-6} {1,-50} {2,-35} {3,-20} {4,-15} {5,-10}" -f "번호", "ID", "이름", "게시자", "버전", "상태")
    Write-Host ("=" * 100)
    
    $idx = 1
    foreach ($ext in $extensions) {
        $status = if ($ext.Enabled) { "활성화" } else { "비활성화" }
        $id = if ($ext.ID.Length -gt 50) { $ext.ID.Substring(0, 47) + "..." } else { $ext.ID }
        $name = if ($ext.Name.Length -gt 35) { $ext.Name.Substring(0, 32) + "..." } else { $ext.Name }
        Write-Host ("{0,-6} {1,-50} {2,-35} {3,-20} {4,-15} {5,-10}" -f $idx, $id, $name, $ext.Publisher, $ext.Version, $status)
        $idx++
    }
    
    # 파일로 저장
    $output = "Cursor 확장 프로그램 목록`n"
    $output += "생성일: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')`n"
    $output += "총 확장 프로그램 수: $($extensions.Count)`n`n"
    $output += ("=" * 100) + "`n"
    $output += ("{0,-6} {1,-50} {2,-35} {3,-20} {4,-15} {5,-10}" -f "번호", "ID", "이름", "게시자", "버전", "상태") + "`n"
    $output += ("=" * 100) + "`n"
    
    $idx = 1
    foreach ($ext in $extensions) {
        $status = if ($ext.Enabled) { "활성화" } else { "비활성화" }
        $id = if ($ext.ID.Length -gt 50) { $ext.ID.Substring(0, 47) + "..." } else { $ext.ID }
        $name = if ($ext.Name.Length -gt 35) { $ext.Name.Substring(0, 32) + "..." } else { $ext.Name }
        $output += ("{0,-6} {1,-50} {2,-35} {3,-20} {4,-15} {5,-10}" -f $idx, $id, $name, $ext.Publisher, $ext.Version, $status) + "`n"
        $idx++
    }
    
    # 카테고리별 분류
    $output += "`n`n" + ("=" * 100) + "`n"
    $output += "카테고리별 분류`n"
    $output += ("=" * 100) + "`n`n"
    
    $languageExts = $extensions | Where-Object { $_.ID -like "*language*" -or $_.Name -like "*language*" -or $_.ID -like "*syntax*" }
    $themeExts = $extensions | Where-Object { $_.ID -like "*theme*" -or $_.Name -like "*theme*" }
    $gitExts = $extensions | Where-Object { $_.ID -like "*git*" -or $_.Name -like "*git*" }
    $debugExts = $extensions | Where-Object { $_.ID -like "*debug*" -or $_.Name -like "*debug*" }
    $formatExts = $extensions | Where-Object { $_.ID -like "*formatter*" -or $_.ID -like "*linter*" -or $_.ID -like "*prettier*" -or $_.ID -like "*eslint*" }
    
    $output += "언어 관련: $($languageExts.Count)개`n"
    $output += "테마 관련: $($themeExts.Count)개`n"
    $output += "Git 관련: $($gitExts.Count)개`n"
    $output += "디버깅 관련: $($debugExts.Count)개`n"
    $output += "포맷팅/린팅 관련: $($formatExts.Count)개`n"
    $otherCount = $extensions.Count - $languageExts.Count - $themeExts.Count - $gitExts.Count - $debugExts.Count - $formatExts.Count
    $output += "기타: $otherCount개`n"
    
    $output | Out-File -FilePath $outputPath -Encoding UTF8
    Write-Host "`n`n목록이 다음 파일에 저장되었습니다:" -ForegroundColor Green
    Write-Host $outputPath -ForegroundColor Yellow
    
}
catch {
    Write-Host "오류 발생: $_" -ForegroundColor Red
    Write-Host $_.ScriptStackTrace -ForegroundColor Red
    exit 1
}
