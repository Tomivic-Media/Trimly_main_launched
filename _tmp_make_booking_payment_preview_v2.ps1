Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = 'Stop'
$out = 'C:\Users\i\Desktop\trimly_backend\social_exports\trimly-booking-payment-preview-v2-approved.jpg'

function C([int]$r,[int]$g,[int]$b,[int]$a=255){ [System.Drawing.Color]::FromArgb($a,$r,$g,$b) }
function Add-RR([System.Drawing.Drawing2D.GraphicsPath]$p,[float]$x,[float]$y,[float]$w,[float]$h,[float]$r){
  $d=$r*2
  $p.AddArc($x,$y,$d,$d,180,90)
  $p.AddArc($x+$w-$d,$y,$d,$d,270,90)
  $p.AddArc($x+$w-$d,$y+$h-$d,$d,$d,0,90)
  $p.AddArc($x,$y+$h-$d,$d,$d,90,90)
  $p.CloseFigure()
}
function Fill-RR($g,$brush,[float]$x,[float]$y,[float]$w,[float]$h,[float]$r){ $p=New-Object System.Drawing.Drawing2D.GraphicsPath; Add-RR $p $x $y $w $h $r; $g.FillPath($brush,$p); $p.Dispose() }
function Draw-RR($g,$pen,[float]$x,[float]$y,[float]$w,[float]$h,[float]$r){ $p=New-Object System.Drawing.Drawing2D.GraphicsPath; Add-RR $p $x $y $w $h $r; $g.DrawPath($pen,$p); $p.Dispose() }
function Card($g,[float]$x,[float]$y,[float]$w,[float]$h,[float]$r,[System.Drawing.Color]$fill,[System.Drawing.Color]$line,[int]$shadowAlpha=28){
  $sb=New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb($shadowAlpha, 45, 35, 20))
  Fill-RR $g $sb ($x+12) ($y+16) $w $h $r
  $sb.Dispose()
  $fb=New-Object System.Drawing.SolidBrush($fill)
  $pen=New-Object System.Drawing.Pen($line,2)
  Fill-RR $g $fb $x $y $w $h $r
  Draw-RR $g $pen $x $y $w $h $r
  $fb.Dispose(); $pen.Dispose()
}
function Txt($g,[string]$text,$font,$brush,[float]$x,[float]$y){ $g.DrawString($text,$font,$brush,$x,$y) }
function Chip($g,[string]$text,[float]$x,[float]$y,$font,[System.Drawing.Color]$fg,[System.Drawing.Color]$bg){
  $size=$g.MeasureString($text,$font)
  $w=[math]::Ceiling($size.Width)+26
  $h=[math]::Ceiling($size.Height)+12
  $b=New-Object System.Drawing.SolidBrush($bg)
  Fill-RR $g $b $x $y $w $h 18
  $b.Dispose()
  $tb=New-Object System.Drawing.SolidBrush($fg)
  $g.DrawString($text,$font,$tb,$x+13,$y+5)
  $tb.Dispose()
  return $w
}

$bmp=New-Object System.Drawing.Bitmap 1440, 1180
$g=[System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode='AntiAlias'
$g.InterpolationMode='HighQualityBicubic'
$g.TextRenderingHint='ClearTypeGridFit'

$cream=C 247 242 233
$cream2=C 241 235 223
$green=C 46 106 79
$greenDark=C 25 57 43
$gold=C 201 169 107
$ink=C 31 54 45
$muted=C 107 98 87
$line=C 220 208 190
$panel=C 255 250 242
$approvedBg=C 239 247 242
$approvedLine=C 168 201 181

$bg=New-Object System.Drawing.Drawing2D.LinearGradientBrush((New-Object System.Drawing.Rectangle 0,0,1440,1180),$cream,$cream2,90)
$g.FillRectangle($bg,0,0,1440,1180)
$bg.Dispose()
$wash1=New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(40,201,169,107))
$wash2=New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(20,46,106,79))
$g.FillEllipse($wash1,1020,-100,450,450)
$g.FillEllipse($wash2,-140,910,360,360)
$g.FillEllipse($wash1,1180,920,220,220)
$wash1.Dispose(); $wash2.Dispose()

$brandFont=New-Object System.Drawing.Font('Segoe UI Semibold',22,[System.Drawing.FontStyle]::Bold)
$headlineFont=New-Object System.Drawing.Font('Georgia',34,[System.Drawing.FontStyle]::Bold)
$subFont=New-Object System.Drawing.Font('Segoe UI',15)
$sectionFont=New-Object System.Drawing.Font('Segoe UI Semibold',20,[System.Drawing.FontStyle]::Bold)
$cardFont=New-Object System.Drawing.Font('Segoe UI Semibold',18,[System.Drawing.FontStyle]::Bold)
$bodyFont=New-Object System.Drawing.Font('Segoe UI',13)
$smallFont=New-Object System.Drawing.Font('Segoe UI',11)
$chipFont=New-Object System.Drawing.Font('Segoe UI Semibold',11,[System.Drawing.FontStyle]::Bold)
$priceFont=New-Object System.Drawing.Font('Segoe UI Semibold',19,[System.Drawing.FontStyle]::Bold)
$ctaFont=New-Object System.Drawing.Font('Segoe UI Semibold',15,[System.Drawing.FontStyle]::Bold)

$lb=New-Object System.Drawing.SolidBrush($green)
Fill-RR $g $lb 62 52 42 42 12
$lb.Dispose()
$tb=New-Object System.Drawing.SolidBrush((C 245 241 232))
Txt $g 'T' (New-Object System.Drawing.Font('Segoe UI Semibold',18,[System.Drawing.FontStyle]::Bold)) $tb 75 58
$tb.Dispose()
$ib=New-Object System.Drawing.SolidBrush($ink)
Txt $g 'Trimly' $brandFont $ib 118 53
Txt $g 'Approved payment state' $subFont $ib 1125 58
$ib.Dispose()

$hb=New-Object System.Drawing.SolidBrush($ink)
$mb=New-Object System.Drawing.SolidBrush($muted)
$g.DrawString('Approved and ready to pay.', $headlineFont, $hb, (New-Object System.Drawing.RectangleF 62,125,720,90))
$g.DrawString('This variation pushes the approval checkpoint harder so the customer instantly knows payment is unlocked and what happens next.', $subFont, $mb, (New-Object System.Drawing.RectangleF 66,216,760,58))
[void](Chip $g 'Approval first' 66 292 $chipFont $green (C 231 239 233))
[void](Chip $g 'Transparent payment' 200 292 $chipFont $gold (C 247 239 221))

Card $g 64 350 490 760 28 $panel $line
Txt $g 'Appointment details' $sectionFont $hb 92 382
Txt $g 'Choose services and confirm the booking request.' $bodyFont $mb 92 412
Card $g 92 462 434 96 20 (C 255 252 247) $line
Txt $g 'Tomiwa Signature Studio' $cardFont $hb 116 490
Txt $g 'Lekki Phase 1, Lagos' $bodyFont $mb 116 520
[void](Chip $g 'Online' 436 490 $chipFont $green (C 231 239 233))
Txt $g 'Selected services' $cardFont $hb 92 598
Card $g 92 640 434 92 18 (C 255 250 242) $line
Txt $g 'Skin Fade' $cardFont $hb 116 665
Txt $g 'Shop visit available' $smallFont $mb 116 694
[void](Chip $g 'NGN 12,000' 388 668 $chipFont $ink (C 246 239 226))
Card $g 92 746 434 92 18 (C 255 250 242) $line
Txt $g 'Beard Sculpt' $cardFont $hb 116 771
Txt $g 'Optional add-on' $smallFont $mb 116 800
[void](Chip $g 'NGN 6,500' 400 774 $chipFont $ink (C 246 239 226))
Card $g 92 862 434 138 18 (C 248 242 230) (C 214 195 160)
Txt $g 'Request ready to send' $bodyFont $hb 116 886
Txt $g 'Apr 16, 2026 • 2:30 PM' $bodyFont $mb 116 916
Txt $g 'NGN 18,500' $priceFont $hb 382 882
[void](Chip $g 'Skin Fade' 116 952 $chipFont $green (C 231 239 233))
[void](Chip $g 'Beard Sculpt' 228 952 $chipFont $green (C 231 239 233))

Card $g 588 290 788 820 34 $approvedBg $approvedLine 34
$topBand=New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(32, 46, 106, 79))
Fill-RR $g $topBand 620 320 724 122 24
$topBand.Dispose()
$light=New-Object System.Drawing.SolidBrush((C 248 244 236))
Txt $g 'Booking approved' (New-Object System.Drawing.Font('Segoe UI Semibold',26,[System.Drawing.FontStyle]::Bold)) $light 648 350
Txt $g 'Ready to pay and secure your appointment.' (New-Object System.Drawing.Font('Segoe UI',15)) $light 650 390
$light.Dispose()
[void](Chip $g 'Approved' 1198 352 $chipFont $greenDark (C 231 239 233))

Card $g 636 474 660 190 22 (C 255 251 245) (C 214 195 160)
Txt $g 'Payment timeline' $cardFont $hb 664 500
function Step($x,$y,[string]$label,[System.Drawing.Color]$color,[bool]$ring=$false){
  $sb=New-Object System.Drawing.SolidBrush($color); $g.FillEllipse($sb,$x,$y,14,14); $sb.Dispose();
  if($ring){ $pn=New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(60,$color.R,$color.G,$color.B),8); $g.DrawEllipse($pn,$x-4,$y-4,22,22); $pn.Dispose() }
  Txt $g $label $bodyFont $hb ($x+28) ($y-4)
}
Step 668 542 'Request sent' $green
Step 668 586 'Barber approval' $green
Step 668 630 'Payment unlocked' $gold $true

Card $g 636 694 310 194 22 (C 255 251 245) $line
Txt $g 'Payment summary' $cardFont $hb 664 720
Txt $g 'Appointment' $smallFont $mb 664 758
Txt $g 'Apr 16, 2026, 2:30 PM' $bodyFont $hb 664 779
Txt $g 'Service mode' $smallFont $mb 664 815
Txt $g 'Shop visit' $bodyFont $hb 664 836
Txt $g 'Total amount' $smallFont $mb 664 872
Txt $g 'NGN 18,500' $priceFont $hb 664 892

Card $g 968 694 328 194 22 (C 255 251 245) $line
Txt $g 'What you are paying for' $cardFont $hb 996 720
[void](Chip $g 'NGN 12,000 Skin Fade' 996 762 $chipFont $green (C 231 239 233))
[void](Chip $g 'NGN 6,500 Beard Sculpt' 996 802 $chipFont $green (C 231 239 233))
Txt $g 'Protected by Trimly approval-first flow.' $smallFont $mb 998 850

Card $g 636 918 660 120 22 (C 249 243 233) (C 214 195 160)
Txt $g 'Only approved bookings unlock payment. Your status and payment updates stay visible in one place.' $bodyFont $hb 664 942

$payBrush=New-Object System.Drawing.SolidBrush($green)
Fill-RR $g $payBrush 664 1062 220 58 26
$payBrush.Dispose()
$light2=New-Object System.Drawing.SolidBrush((C 249 246 240))
Txt $g 'Pay Now' $ctaFont $light2 738 1080
$light2.Dispose()
$ghostPen=New-Object System.Drawing.Pen((C 200 182 150),2)
Draw-RR $g $ghostPen 910 1062 200 58 26
$ghostPen.Dispose()
Txt $g 'Refresh Status' $ctaFont $hb 957 1080

$jpeg=[System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$ep=New-Object System.Drawing.Imaging.EncoderParameters 1
$ep.Param[0]=New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality,92L)
$bmp.Save($out,$jpeg,$ep)
$g.Dispose(); $bmp.Dispose()
Write-Output $out
