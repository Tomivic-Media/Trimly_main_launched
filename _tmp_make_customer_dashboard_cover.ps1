Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = 'Stop'
$root = 'C:\Users\i\Desktop\trimly_backend\social_exports'
$out = Join-Path $root 'trimly-social-22-carousel-customer-dashboard-v1.jpg'
$src = Join-Path $root 'trimly-social-06-customer-dashboard-ngn-v2.jpg'

function C([int]$r,[int]$g,[int]$b,[int]$a=255){ [System.Drawing.Color]::FromArgb($a,$r,$g,$b) }
function Add-RR([System.Drawing.Drawing2D.GraphicsPath]$p,[float]$x,[float]$y,[float]$w,[float]$h,[float]$r){ $d=$r*2; $p.AddArc($x,$y,$d,$d,180,90); $p.AddArc($x+$w-$d,$y,$d,$d,270,90); $p.AddArc($x+$w-$d,$y+$h-$d,$d,$d,0,90); $p.AddArc($x,$y+$h-$d,$d,$d,90,90); $p.CloseFigure() }
function Fill-RR($g,$brush,[float]$x,[float]$y,[float]$w,[float]$h,[float]$r){ $p=New-Object System.Drawing.Drawing2D.GraphicsPath; Add-RR $p $x $y $w $h $r; $g.FillPath($brush,$p); $p.Dispose() }
function Draw-RR($g,$pen,[float]$x,[float]$y,[float]$w,[float]$h,[float]$r){ $p=New-Object System.Drawing.Drawing2D.GraphicsPath; Add-RR $p $x $y $w $h $r; $g.DrawPath($pen,$p); $p.Dispose() }
function Card($g,[float]$x,[float]$y,[float]$w,[float]$h,[float]$r){
  $sb=New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(28,35,28,18))
  Fill-RR $g $sb ($x+12) ($y+16) $w $h $r
  $sb.Dispose()
  $fb=New-Object System.Drawing.SolidBrush (C 250 246 239)
  $pen=New-Object System.Drawing.Pen((C 219 208 189),2)
  Fill-RR $g $fb $x $y $w $h $r
  Draw-RR $g $pen $x $y $w $h $r
  $fb.Dispose(); $pen.Dispose()
}
function ImgContain($g,[string]$path,[float]$x,[float]$y,[float]$w,[float]$h,[float]$r){
  $img=[System.Drawing.Image]::FromFile($path)
  try {
    $scale=[Math]::Min($w/$img.Width,$h/$img.Height)
    $dw=[float]($img.Width*$scale)
    $dh=[float]($img.Height*$scale)
    $dx=[float]($x+(($w-$dw)/2))
    $dy=[float]($y+(($h-$dh)/2))
    $clip=New-Object System.Drawing.Drawing2D.GraphicsPath
    Add-RR $clip $x $y $w $h $r
    $old=$g.Clip
    $g.SetClip($clip)
    $dest=New-Object System.Drawing.RectangleF($dx,$dy,$dw,$dh)
    $g.DrawImage($img,$dest)
    $g.Clip=$old
    $clip.Dispose()
  } finally { $img.Dispose() }
}
function Brand($g,$ink,$green,$brandFont){
  $lb=New-Object System.Drawing.SolidBrush($green)
  Fill-RR $g $lb 56 50 40 40 12
  $lb.Dispose()
  $tb=New-Object System.Drawing.SolidBrush((C 245 241 232))
  $g.DrawString('T',(New-Object System.Drawing.Font('Segoe UI Semibold',18,[System.Drawing.FontStyle]::Bold)),$tb,68,57)
  $tb.Dispose()
  $nb=New-Object System.Drawing.SolidBrush($ink)
  $g.DrawString('Trimly',$brandFont,$nb,108,51)
  $nb.Dispose()
}
function Save-Jpeg($bmp,[string]$path){
  $jpeg=[System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
  $ep=New-Object System.Drawing.Imaging.EncoderParameters 1
  $ep.Param[0]=New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality,92L)
  $bmp.Save($path,$jpeg,$ep)
}

$ink=C 31 54 45
$green=C 46 106 79
$muted=C 107 98 87

$bmp=New-Object System.Drawing.Bitmap 1080,1350
$g=[System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode='AntiAlias'
$g.InterpolationMode='HighQualityBicubic'
$g.TextRenderingHint='ClearTypeGridFit'

$bg=New-Object System.Drawing.Drawing2D.LinearGradientBrush((New-Object System.Drawing.Rectangle 0,0,1080,1350),(C 248 243 233),(C 243 237 226),90)
$g.FillRectangle($bg,0,0,1080,1350)
$bg.Dispose()
$w1=New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(32,201,169,107))
$w2=New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(18,46,106,79))
$g.FillEllipse($w1,760,-80,380,380)
$g.FillEllipse($w2,-110,1070,300,300)
$g.FillEllipse($w1,860,1100,190,190)
$w1.Dispose(); $w2.Dispose()

$brandFont=New-Object System.Drawing.Font('Segoe UI Semibold',20,[System.Drawing.FontStyle]::Bold)
$headlineFont=New-Object System.Drawing.Font('Georgia',31,[System.Drawing.FontStyle]::Bold)
$subFont=New-Object System.Drawing.Font('Segoe UI',15,[System.Drawing.FontStyle]::Regular)
$footerFont=New-Object System.Drawing.Font('Segoe UI',12,[System.Drawing.FontStyle]::Regular)

Brand $g $ink $green $brandFont
$hb=New-Object System.Drawing.SolidBrush($ink)
$mb=New-Object System.Drawing.SolidBrush($muted)
$g.DrawString('Customer dashboards should make bookings easy to track.',$headlineFont,$hb,(New-Object System.Drawing.RectangleF 56,118,800,96))
$g.DrawString('Customers should see upcoming bookings, status, recent activity, and quick actions without confusion.',$subFont,$mb,(New-Object System.Drawing.RectangleF 58,224,820,72))

Card $g 150 314 780 900 34
ImgContain $g $src 182 346 716 836 26
$g.DrawString('This slide shows the customer side of the Trimly experience.',$footerFont,$mb,(New-Object System.Drawing.RectangleF 154,1234,760,44))

$hb.Dispose(); $mb.Dispose(); $brandFont.Dispose(); $headlineFont.Dispose(); $subFont.Dispose(); $footerFont.Dispose(); $g.Dispose()
Save-Jpeg $bmp $out
$bmp.Dispose()
Write-Output $out
