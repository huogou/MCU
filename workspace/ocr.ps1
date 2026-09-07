$imgs = @(
  "C:\Users\Administrator\.workbuddy\clipboard-images\clipboard-2026-09-07T05-18-37-003Z-b0db044e.png",
  "C:\Users\Administrator\.workbuddy\clipboard-images\clipboard-2026-09-07T05-18-37-008Z-ca3fc845.png",
  "C:\Users\Administrator\.workbuddy\clipboard-images\clipboard-2026-09-07T05-18-37-012Z-3011bf3a.png",
  "C:\Users\Administrator\.workbuddy\clipboard-images\clipboard-2026-09-07T05-18-37-015Z-3d85268a.png",
  "C:\Users\Administrator\.workbuddy\clipboard-images\clipboard-2026-09-07T05-18-37-017Z-6f7e0759.png"
)

Add-Type -AssemblyName System.Runtime.WindowsRuntime | Out-Null
$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
})[0]

function Await($op, $type) {
  $m = $asTaskGeneric.MakeGenericMethod($type)
  $t = $m.Invoke($null, @($op))
  $t.Wait(-1) | Out-Null
  return $t.Result
}

$null = [Windows.Storage.StorageFile,Windows.Storage,ContentType=WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder,Windows.Foundation,ContentType=WindowsRuntime]
$null = [Windows.Media.Ocr.OcrEngine,Windows.Foundation,ContentType=WindowsRuntime]

$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage([Windows.Globalization.Language]::new("zh-CN"))
if ($null -eq $engine) { $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages() }
if ($null -eq $engine) { Write-Output "NO_OCR_ENGINE"; exit 1 }

foreach ($p in $imgs) {
  if (-not (Test-Path $p)) { Write-Output "MISSING: $p"; continue }
  $file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($p)) ([Windows.Storage.StorageFile])
  $stream = Await ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
  $decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
  $bitmap = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
  $res = Await ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
  Write-Output "===== $($p.Split('\')[-1]) ====="
  Write-Output $res.Text
  Write-Output ""
}
