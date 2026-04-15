Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = 'Stop'
$out = 'C:\Users\i\Desktop\trimly_backend\social_exports\trimly-booking-payment-preview-v1.jpg'

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
function Card($g,[float]$x,[float]$y,[float]$w,[float]$h,[float]$r,[System.Drawing.Color]$fill,[System.Drawing.Color]$line){
  $sb=New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(26, 45, 35, 20))
  Fill-RR $g $sb ($x+10) ($y+12) $w $h $r
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

$bg=New-Object System.Drawing.Drawing2D.LinearGradientBrush((New-Object System.Drawing.Rectangle 0,0,1440,1180),$cream,$cream2,90)
$g.FillRectangle($bg,0,0,1440,1180)
$bg.Dispose()
$wash1=New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(36,201,169,107))
$wash2=New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(20,46,106,79))
$g.FillEllipse($wash1,1040,-90,430,430)
$g.FillEllipse($wash2,-120,920,340,340)
$g.FillEllipse($wash1,1180,930,200,200)
$wash1.Dispose(); $wash2.Dispose()

$brandFont=New-Object System.Drawing.Font('Segoe UI Semibold',22,[System.Drawing.FontStyle]::Bold)
$headlineFont=New-Object System.Drawing.Font('Georgia',34,[System.Drawing.FontStyle]::Bold)
$subFont=New-Object System.Drawing.Font('Segoe UI',15)
$sectionFont=New-Object System.Drawing.Font('Segoe UI Semibold',20,[System.Drawing.FontStyle]::Bold)
$cardFont=New-Object System.Drawing.Font('Segoe UI Semibold',17,[System.Drawing.FontStyle]::Bold)
$bodyFont=New-Object System.Drawing.Font('Segoe UI',13)
$smallFont=New-Object System.Drawing.Font('Segoe UI',11)
$chipFont=New-Object System.Drawing.Font('Segoe UI Semibold',11,[System.Drawing.FontStyle]::Bold)
$priceFont=New-Object System.Drawing.Font('Segoe UI Semibold',18,[System.Drawing.FontStyle]::Bold)

$lb=New-Object System.Drawing.SolidBrush($green)
Fill-RR $g $lb 62 52 42 42 12
$lb.Dispose()
$tb=New-Object System.Drawing.SolidBrush((C 245 241 232))
Txt $g 'T' (New-Object System.Drawing.Font('Segoe UI Semibold',18,[System.Drawing.FontStyle]::Bold)) $tb 75 58
$tb.Dispose()
$ib=New-Object System.Drawing.SolidBrush($ink)
Txt $g 'Trimly' $brandFont $ib 118 53
Txt $g 'Booking Flow' $subFont $ib 1170 58
$ib.Dispose()

$hb=New-Object System.Drawing.SolidBrush($ink)
$mb=New-Object System.Drawing.SolidBrush($muted)
$g.DrawString('Book your appointment and pay only after approval.', $headlineFont, $hb, (New-Object System.Drawing.RectangleF 62,125,760,110))
$g.DrawString('The live booking page now shows selected services, appointment details, and a cleaner approval-to-payment experience.', $subFont, $mb, (New-Object System.Drawing.RectangleF 66,228,760,52))
[void](Chip $g 'Booking request' 66 298 $chipFont $green (C 231 239 233))
[void](Chip $g 'Approved payment state' 222 298 $chipFont $gold (C 247 239 221))

Card $g 64 360 780 740 28 $panel $line
Txt $g 'Appointment details' $sectionFont $hb 92 392
Txt $g 'Choose services and a clean slot before you send the request.' $bodyFont $mb 92 423

Card $g 92 468 724 98 20 (C 255 252 247) $line
Txt $g 'Tomiwa Signature Studio' $cardFont $hb 116 494
Txt $g 'Lekki Phase 1, Lagos' $bodyFont $mb 116 523
[void](Chip $g 'NGN 18,500 total' 610 493 $chipFont $green (C 231 239 233))
[void](Chip $g 'Online' 691 524 $chipFont $green (C 231 239 233))

Txt $g 'Select services' $cardFont $hb 92 602
Txt $g 'Customers can pick one or more services the barber has already configured.' $bodyFont $mb 92 629

Card $g 92 672 724 88 18 (C 255 250 242) $line
Txt $g 'Skin Fade' $cardFont $hb 142 694
Txt $g 'Shop visit available' $smallFont $mb 142 723
[void](Chip $g 'NGN 12,000' 663 699 $chipFont $ink (C 246 239 226))
$g.FillEllipse((New-Object System.Drawing.SolidBrush($green)), 108, 703, 18, 18)

Card $g 92 774 724 88 18 (C 255 250 242) $line
Txt $g 'Beard Sculpt' $cardFont $hb 142 796
Txt $g 'Shop visit available' $smallFont $mb 142 825
[void](Chip $g 'NGN 6,500' 675 801 $chipFont $ink (C 246 239 226))
$pen=New-Object System.Drawing.Pen((C 182 170 150),2)
$g.DrawEllipse($pen,108,805,18,18)
$pen.Dispose()

Card $g 92 880 724 88 18 (C 255 250 242) $line
Txt $g 'Home Service Premium' $cardFont $hb 142 902
Txt $g 'Home service available' $smallFont $mb 142 931
[void](Chip $g 'NGN 8,000' 677 907 $chipFont $ink (C 246 239 226))
$pen=New-Object System.Drawing.Pen((C 182 170 150),2)
$g.DrawEllipse($pen,108,911,18,18)
$pen.Dispose()

Card $g 92 988 724 82 18 (C 248 242 230) (C 214 195 160)
Txt $g '1 service selected' $bodyFont $hb 116 1008
Txt $g 'NGN 12,000' $priceFont $hb 650 1002
[void](Chip $g 'NGN 12,000 Skin Fade' 116 1034 $chipFont $green (C 231 239 233))

Card $g 882 360 494 740 28 (C 255 249 240) $line
Txt $g 'Approved booking and payment' $sectionFont $hb 910 392
Txt $g 'This panel becomes your payment checkpoint as soon as the barber approves.' $bodyFont $mb 910 423

Card $g 910 470 438 380 22 (C 255 251 245) (C 222 206 182)
Txt $g 'Booking approved' $cardFont $hb 938 500
Txt $g 'Your barber has approved this appointment. You can pay now to secure it.' $bodyFont $mb 938 529
[void](Chip $g 'Approved' 1232 498 $chipFont $green (C 231 239 233))

function TimelineRow($y,[string]$label,[string]$state){
  $dotColor = switch ($state) { 'done' { C 46 106 79 } 'active' { C 201 169 107 } 'blocked' { C 182 84 75 } default { C 220 208 190 } }
  $sb=New-Object System.Drawing.SolidBrush($dotColor)
  $g.FillEllipse($sb,940,$y+4,12,12)
  $sb.Dispose()
  if ($state -eq 'active') {
    $ring=New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(70,201,169,107),6)
    $g.DrawEllipse($ring,936,$y,20,20)
    $ring.Dispose()
  }
  Txt $g $label $bodyFont ($(New-Object System.Drawing.SolidBrush($ink))) 966 $y
}
TimelineRow 582 'Request sent' 'done'
TimelineRow 620 'Barber approval' 'done'
TimelineRow 658 'Payment' 'active'

Card $g 936 706 386 92 16 (C 255 250 242) $line
Txt $g 'Appointment' $smallFont $mb 958 726
Txt $g 'Apr 16, 2026, 2:30 PM' $bodyFont $hb 1122 723
Txt $g 'Service mode' $smallFont $mb 958 754
Txt $g 'Shop visit' $bodyFont $hb 1230 751
Txt $g 'Total amount' $smallFont $mb 958 782
Txt $g 'NGN 12,000' $cardFont $hb 1200 776

[void](Chip $g 'NGN 12,000 Skin Fade' 938 820 $chipFont $green (C 231 239 233))

Card $g 910 870 438 92 16 (C 249 243 233) (C 214 195 160)
Txt $g 'Pay securely after approval' $bodyFont $hb 938 892
Txt $g 'Approval-first flow keeps the booking transparent for both customer and barber.' $smallFont $mb 938 919

$payBrush=New-Object System.Drawing.SolidBrush($green)
Fill-RR $g $payBrush 938 986 182 54 24
$payBrush.Dispose()
$light=New-Object System.Drawing.SolidBrush((C 249 246 240))
Txt $g 'Pay Now' (New-Object System.Drawing.Font('Segoe UI Semibold',14,[System.Drawing.FontStyle]::Bold)) $light 1001 1002
$light.Dispose()
$ghostPen=New-Object System.Drawing.Pen((C 200 182 150),2)
Draw-RR $g $ghostPen 1140 986 180 54 24
$ghostPen.Dispose()
Txt $g 'Refresh Status' (New-Object System.Drawing.Font('Segoe UI Semibold',14,[System.Drawing.FontStyle]::Bold)) $hb 1176 1002

$jpeg=[System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$ep=New-Object System.Drawing.Imaging.EncoderParameters 1
$ep.Param[0]=New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality,92L)
$bmp.Save($out,$jpeg,$ep)
$g.Dispose(); $bmp.Dispose()
Write-Output $out
