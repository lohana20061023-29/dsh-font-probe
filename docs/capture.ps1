# Capture a screenshot of the DSH window (Windows / PowerShell)
#
# This is how docs/settings.png was produced.
# How it works: EnumWindows locates the "DeepSeek Harness" window, then
# PrintWindow(PW_RENDERFULLCONTENT) renders it into an in-memory bitmap which is
# cropped to the given rectangle and saved. No browser devtools needed.
#
# Usage:
#   1. Open "Settings -> 文字显示设置" in DSH and leave it on screen
#   2. powershell -NoProfile -ExecutionPolicy Bypass -File docs/capture.ps1
#   3. Result is written to docs/settings.png
#
# Notes:
#   - Only what is currently on screen gets captured, so scroll where you want first
#   - -Crop is relative to the window's top-left corner, in pixels
#   - If your window size differs, adjust -Crop
#
# Kept ASCII-only on purpose: Windows PowerShell 5.1 reads BOM-less scripts as ANSI,
# so non-ASCII literals would turn into mojibake in the console.

param(
  [string]$Out  = "$PSScriptRoot\settings.png",
  [string]$Crop = '311,74,1000,826'   # x,y,w,h
)

Add-Type -AssemblyName System.Drawing

Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public class Shot {
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr p);
  public delegate bool EnumProc(IntPtr h, IntPtr p);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowTextLength(IntPtr h);
  [DllImport("user32.dll")] public static extern int GetWindowThreadProcessId(IntPtr h, out int pid);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h, IntPtr hdc, uint flags);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
}
"@

[void][Shot]::SetProcessDPIAware()

# Locate the window. Title must mention DeepSeek Harness AND the process name must
# contain "DeepSeek" -- a browser tab with the same title would match the title alone.
$script:target = [IntPtr]::Zero
$script:bounds = $null
$cb = {
  param($hWnd, $lParam)
  if (-not [Shot]::IsWindowVisible($hWnd)) { return $true }
  $len = [Shot]::GetWindowTextLength($hWnd)
  if ($len -le 0) { return $true }
  $sb = New-Object System.Text.StringBuilder ($len + 2)
  [void][Shot]::GetWindowText($hWnd, $sb, $sb.Capacity)
  if ($sb.ToString() -notlike '*DeepSeek Harness*') { return $true }

  $procId = 0
  [void][Shot]::GetWindowThreadProcessId($hWnd, [ref]$procId)
  $pname = ''
  try { $pname = (Get-Process -Id $procId -ErrorAction Stop).ProcessName } catch { }
  if ($pname -notmatch 'DeepSeek') { return $true }

  $r = New-Object Shot+RECT
  [void][Shot]::GetWindowRect($hWnd, [ref]$r)
  if (($r.Right - $r.Left) -lt 800) { return $true }
  $script:target = $hWnd
  $script:bounds = $r
  return $true
}
[void][Shot]::EnumWindows($cb, [IntPtr]::Zero)

if ($script:target -eq [IntPtr]::Zero) {
  Write-Error 'Cannot find the DeepSeek Harness window. Is the app open with Settings visible?'
  exit 2
}
$b = $script:bounds
$w = $b.Right - $b.Left
$h = $b.Bottom - $b.Top
Write-Output ("window {0}x{1} at {2},{3}" -f $w, $h, $b.Left, $b.Top)

[void][Shot]::ShowWindow($script:target, 9)     # SW_RESTORE
[void][Shot]::SetForegroundWindow($script:target)
Start-Sleep -Milliseconds 700

# Capture the whole window
$bmp = New-Object System.Drawing.Bitmap -ArgumentList @($w, $h)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$hdc = $g.GetHdc()
$ok = [Shot]::PrintWindow($script:target, $hdc, 2)   # 2 = PW_RENDERFULLCONTENT
$g.ReleaseHdc($hdc)
$g.Dispose()

if (-not $ok) { Write-Error 'PrintWindow failed'; $bmp.Dispose(); exit 3 }

# All-black means the GPU-composited layers were not rendered into the bitmap
$p = $bmp.GetPixel([int]($w / 2), [int]($h / 2))
if (($p.R + $p.G + $p.B) -eq 0) {
  Write-Warning 'Captured image looks all black (known GPU-compositing limitation). Bring the window to the foreground and retry.'
}

# Crop and save
$parts = $Crop.Split(',') | ForEach-Object { [int]$_.Trim() }
$cw = [Math]::Min($parts[2], $w - $parts[0])
$ch = [Math]::Min($parts[3], $h - $parts[1])
$rect = New-Object System.Drawing.Rectangle -ArgumentList @($parts[0], $parts[1], $cw, $ch)
$outBmp = $bmp.Clone($rect, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$outBmp.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)
Write-Output ("saved {0}  {1}x{2}  {3} bytes" -f $Out, $outBmp.Width, $outBmp.Height, (Get-Item $Out).Length)

$outBmp.Dispose()
$bmp.Dispose()
