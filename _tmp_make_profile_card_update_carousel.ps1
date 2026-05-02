Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = 'Stop'
$root = 'C:\Users\i\Desktop\trimly_backend\social_exports'

function C([int]$r,[int]$g,[int]$b,[int]$a=255){ [System.Drawing.Color]::FromArgb($a,$r,$g,$b) }
function Add-RR([System.Drawing.Drawing2D.GraphicsPath]$p,[float]$x,[float]$y,[float]$w,[float]$h,[float]$r){
  $d = $r * 2
  $p.AddArc($x,$y,$d,$d,180,90)
  $p.AddArc($x+$w-$d,$y,$d,$d,270,90)
  $p.AddArc($x+$w-$d,$y+$h-$d,$d,$d,0,90)
  $p.AddArc($x,$y+$h-$d,$d,$d,90,90)
  $p.CloseFigure()
}
function Fill-RR($g,$brush,[float]$x,[float]$y,[float]$w,[float]$h,[float]$r){
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  Add-RR $p $x $y $w $h $r
  $g.FillPath($brush,$p)
  $p.Dispose()
}
function Draw-RR($g,$pen,[float]$x,[float]$y,[float]$w,[float]$h,[float]$r){
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  Add-RR $p $x $y $w $h $r
  $g.DrawPath($pen,$p)
  $p.Dispose()
}
function Card($g,[float]$x,[float]$y,[float]$w,[float]$h,[float]$r){
  $shadow = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(28,35,28,18))
  Fill-RR $g $shadow ($x+12) ($y+16) $w $h $r
  $shadow.Dispose()
  $fill = New-Object System.Drawing.SolidBrush (C 250 246 239)
  $pen = New-Object System.Drawing.Pen((C 219 208 189),2)
  Fill-RR $g $fill $x $y $w $h $r
  Draw-RR $g $pen $x $y $w $h $r
  $fill.Dispose()
  $pen.Dispose()
}
function Save-Jpeg($bmp,[string]$path){
  $jpeg = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
  $ep = New-Object System.Drawing.Imaging.EncoderParameters 1
  $ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality,92L)
  $bmp.Save($path,$jpeg,$ep)
}
function Brand($g,$ink,$green,$brandFont){
  $badge = New-Object System.Drawing.SolidBrush($green)
  Fill-RR $g $badge 56 50 40 40 12
  $badge.Dispose()

  $light = New-Object System.Drawing.SolidBrush((C 245 241 232))
  $tFont = New-Object System.Drawing.Font('Segoe UI Semibold',18,[System.Drawing.FontStyle]::Bold)
  $g.DrawString('T',$tFont,$light,68,57)
  $light.Dispose()
  $tFont.Dispose()

  $name = New-Object System.Drawing.SolidBrush($ink)
  $g.DrawString('Trimly',$brandFont,$name,108,51)
  $name.Dispose()
}
function Draw-Badge($g,[float]$x,[float]$y,[string]$text,$bgColor,$textColor){
  $font = New-Object System.Drawing.Font('Segoe UI Semibold',13,[System.Drawing.FontStyle]::Bold)
  $size = $g.MeasureString($text,$font)
  $w = [Math]::Ceiling($size.Width + 32)
  $h = 38
  $fill = New-Object System.Drawing.SolidBrush($bgColor)
  Fill-RR $g $fill $x $y $w $h 18
  $fill.Dispose()
  $textBrush = New-Object System.Drawing.SolidBrush($textColor)
  $g.DrawString($text,$font,$textBrush,($x+16),($y+8))
  $textBrush.Dispose()
  $font.Dispose()
}
function Draw-InfoCard($g,[float]$x,[float]$y,[float]$w,[float]$h,[string]$kicker,[string]$title,[string]$body,$ink,$green,$muted,$accent){
  Card $g $x $y $w $h 28
  Draw-Badge $g ($x+24) ($y+22) $kicker ([System.Drawing.Color]::FromArgb(24,46,106,79)) $green

  $titleFont = New-Object System.Drawing.Font('Georgia',20,[System.Drawing.FontStyle]::Bold)
  $bodyFont = New-Object System.Drawing.Font('Segoe UI',12,[System.Drawing.FontStyle]::Regular)
  $titleBrush = New-Object System.Drawing.SolidBrush($ink)
  $bodyBrush = New-Object System.Drawing.SolidBrush($muted)
  $g.DrawString($title,$titleFont,$titleBrush,(New-Object System.Drawing.RectangleF(($x+26),($y+74),($w-52),60)))
  $g.DrawString($body,$bodyFont,$bodyBrush,(New-Object System.Drawing.RectangleF(($x+26),($y+136),($w-52),110)))
  $titleFont.Dispose()
  $bodyFont.Dispose()
  $titleBrush.Dispose()
  $bodyBrush.Dispose()
}
function Draw-PhoneFrame($g,[float]$x,[float]$y,[float]$w,[float]$h,$ink,$line,$green,$cream){
  $shell = New-Object System.Drawing.SolidBrush($ink)
  Fill-RR $g $shell $x $y $w $h 38
  $shell.Dispose()
  $screen = New-Object System.Drawing.SolidBrush($cream)
  Fill-RR $g $screen ($x+14) ($y+18) ($w-28) ($h-32) 28
  $screen.Dispose()
  $notch = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(45,255,255,255))
  Fill-RR $g $notch ($x+110) ($y+10) 120 12 6
  $notch.Dispose()
}
function Draw-SettingsMock($g,[float]$x,[float]$y,[float]$w,[float]$h,[string]$headline,[string]$sub1,[string]$sub2,$ink,$green,$muted,$line){
  Draw-PhoneFrame $g $x $y $w $h $ink $line $green (C 250 246 239)

  $headBrush = New-Object System.Drawing.SolidBrush($ink)
  $mutedBrush = New-Object System.Drawing.SolidBrush($muted)
  $titleFont = New-Object System.Drawing.Font('Segoe UI Semibold',18,[System.Drawing.FontStyle]::Bold)
  $bodyFont = New-Object System.Drawing.Font('Segoe UI',11,[System.Drawing.FontStyle]::Regular)
  $g.DrawString('Settings',$titleFont,$headBrush,($x+34),($y+54))
  $g.DrawString($headline,$bodyFont,$mutedBrush,(New-Object System.Drawing.RectangleF(($x+34),($y+94),($w-68),36)))

  $panelY = $y + 142
  Card $g ($x+26) $panelY ($w-52) 126 24
  Draw-Badge $g ($x+46) ($panelY+18) 'Required' ([System.Drawing.Color]::FromArgb(24,201,169,107)) $green
  $labelFont = New-Object System.Drawing.Font('Segoe UI Semibold',16,[System.Drawing.FontStyle]::Bold)
  $g.DrawString($sub1,$labelFont,$headBrush,($x+46),($panelY+60))
  $g.DrawString('Clear face photo of the account owner.',$bodyFont,$mutedBrush,(New-Object System.Drawing.RectangleF(($x+46),($panelY+90),($w-92),24)))

  Card $g ($x+26) ($panelY+148) ($w-52) 126 24
  Draw-Badge $g ($x+46) ($panelY+166) 'Required' ([System.Drawing.Color]::FromArgb(24,201,169,107)) $green
  $g.DrawString($sub2,$labelFont,$headBrush,($x+46),($panelY+208))
  $g.DrawString('The public card image customers see first.',$bodyFont,$mutedBrush,(New-Object System.Drawing.RectangleF(($x+46),($panelY+238),($w-92),24)))

  $btnBrush = New-Object System.Drawing.SolidBrush($green)
  Fill-RR $g $btnBrush ($x+40) ($y+$h-116) ($w-80) 46 16
  $btnBrush.Dispose()
  $btnFont = New-Object System.Drawing.Font('Segoe UI Semibold',14,[System.Drawing.FontStyle]::Bold)
  $btnTextBrush = New-Object System.Drawing.SolidBrush((C 247 244 236))
  $btnSize = $g.MeasureString('Save changes',$btnFont)
  $g.DrawString('Save changes',$btnFont,$btnTextBrush,($x + (($w - $btnSize.Width)/2)),($y+$h-104))

  $titleFont.Dispose()
  $bodyFont.Dispose()
  $labelFont.Dispose()
  $btnFont.Dispose()
  $headBrush.Dispose()
  $mutedBrush.Dispose()
  $btnTextBrush.Dispose()
}

$ink = C 31 54 45
$green = C 46 106 79
$muted = C 107 98 87
$accent = C 201 169 107
$cream = C 248 243 233
$sage = C 243 237 226

$slides = @(
  @{
    Out='trimly-social-33-profile-card-update-cover-v1.jpg'
    Kind='cover'
    Title='Trimly profile photo and barber card update is live.'
    Subtitle='Barber accounts now have clearer image roles, so customers know who owns the account and what public card image they are seeing.'
    Footer='Cleaner trust signals for customers. Simpler setup for barbers.'
  },
  @{
    Out='trimly-social-34-profile-card-update-why-v1.jpg'
    Kind='why'
    Title='Why we changed it'
    Subtitle='The old image flow made some barber cards unclear. The new setup separates identity, public card image, and optional portfolio.'
    Footer='One role for each image. Less confusion across the marketplace.'
  },
  @{
    Out='trimly-social-35-profile-card-update-profile-v1.jpg'
    Kind='profile'
    Title='Profile photo is now required.'
    Subtitle='This should be a clear face photo of the actual account owner so customers can trust who they are booking.'
    Footer='This is for identity and trust, not for the public barber card.'
  },
  @{
    Out='trimly-social-36-profile-card-update-card-v1.jpg'
    Kind='card'
    Title='Barber card photo is also required.'
    Subtitle='This is the image customers see on the public barber card. Use a clean haircut, studio, or branded barber shot.'
    Footer='Your public first impression should be separate from your face profile photo.'
  },
  @{
    Out='trimly-social-37-profile-card-update-steps-v1.jpg'
    Kind='steps'
    Title='How to update your account'
    Subtitle='Barbers can change both images anytime from Settings.'
    Footer='Login. Open Settings. Upload both photos. Save changes.'
  }
)

foreach($slide in $slides){
  $bmp = New-Object System.Drawing.Bitmap 1080,1350
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.InterpolationMode = 'HighQualityBicubic'
  $g.TextRenderingHint = 'ClearTypeGridFit'

  $bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush((New-Object System.Drawing.Rectangle 0,0,1080,1350),$cream,$sage,90)
  $g.FillRectangle($bg,0,0,1080,1350)
  $bg.Dispose()

  $wash1 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(32,201,169,107))
  $wash2 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(18,46,106,79))
  $g.FillEllipse($wash1,760,-80,380,380)
  $g.FillEllipse($wash2,-110,1070,300,300)
  $g.FillEllipse($wash1,860,1100,190,190)
  $wash1.Dispose()
  $wash2.Dispose()

  $brandFont = New-Object System.Drawing.Font('Segoe UI Semibold',20,[System.Drawing.FontStyle]::Bold)
  $headlineFont = New-Object System.Drawing.Font('Georgia',30,[System.Drawing.FontStyle]::Bold)
  $subFont = New-Object System.Drawing.Font('Segoe UI',15,[System.Drawing.FontStyle]::Regular)
  $footerFont = New-Object System.Drawing.Font('Segoe UI',12,[System.Drawing.FontStyle]::Regular)
  $headlineBrush = New-Object System.Drawing.SolidBrush($ink)
  $subBrush = New-Object System.Drawing.SolidBrush($muted)

  Brand $g $ink $green $brandFont
  Draw-Badge $g 56 116 'Barber image update' ([System.Drawing.Color]::FromArgb(26,46,106,79)) $green
  $g.DrawString($slide.Title,$headlineFont,$headlineBrush,(New-Object System.Drawing.RectangleF 56,170,880,120))
  $g.DrawString($slide.Subtitle,$subFont,$subBrush,(New-Object System.Drawing.RectangleF 58,300,860,84))

  switch($slide.Kind){
    'cover' {
      Card $g 56 430 968 620 34
      Draw-InfoCard $g 94 476 270 228 'Required' 'Profile photo' 'Use a clear face photo of the real account owner. This helps customers trust who they are booking.' $ink $green $muted $accent
      Draw-InfoCard $g 404 476 270 228 'Required' 'Barber card photo' 'This is the public card image customers see first when they browse the marketplace.' $ink $green $muted $accent
      Draw-InfoCard $g 714 476 270 228 'Optional' 'Portfolio photos' 'Use extra haircut or studio images to support your public profile and booking confidence.' $ink $green $muted $accent

      $bigFont = New-Object System.Drawing.Font('Georgia',22,[System.Drawing.FontStyle]::Bold)
      $copyFont = New-Object System.Drawing.Font('Segoe UI',14,[System.Drawing.FontStyle]::Regular)
      $bigBrush = New-Object System.Drawing.SolidBrush($ink)
      $copyBrush = New-Object System.Drawing.SolidBrush($muted)
      $g.DrawString('Three image roles. One cleaner barber setup.',$bigFont,$bigBrush,(New-Object System.Drawing.RectangleF 94,782,860,56))
      $g.DrawString('This gives customers clearer trust signals and makes barber profiles easier to manage inside Trimly Settings.',$copyFont,$copyBrush,(New-Object System.Drawing.RectangleF 94,850,860,74))
      $bigFont.Dispose(); $copyFont.Dispose(); $bigBrush.Dispose(); $copyBrush.Dispose()
    }
    'why' {
      Card $g 56 430 968 560 34
      Draw-InfoCard $g 90 474 430 210 'Before' 'One image could mean too many things.' 'That made it harder to tell whether the barber card image was showing the barber, a haircut, or just whatever got uploaded first.' $ink $green $muted $accent
      Draw-InfoCard $g 560 474 430 210 'Now' 'Each image has a clear job.' 'Profile photo shows the account owner. Barber card photo handles public display. Portfolio stays optional for extra proof.' $ink $green $muted $accent
      Draw-InfoCard $g 90 720 900 214 'Result' 'Customers understand who they are booking faster.' 'This update helps Trimly look more trustworthy and professional, especially when a new customer is deciding between multiple barbers.' $ink $green $muted $accent
    }
    'profile' {
      Draw-SettingsMock $g 92 430 390 740 'Identity and public images' 'Profile photo' 'Barber card photo' $ink $green $muted (C 219 208 189)
      Draw-InfoCard $g 540 470 452 210 'What it is' 'A face photo of the account owner' 'Use a clean front-facing image so customers and admins can connect the account to the real barber behind it.' $ink $green $muted $accent
      Draw-InfoCard $g 540 714 452 210 'What it is not' 'Not the public barber card image' 'The profile photo is for identity and trust. It does not have to be the same as the card image customers first see in the marketplace.' $ink $green $muted $accent
    }
    'card' {
      Draw-SettingsMock $g 598 430 390 740 'Identity and public images' 'Profile photo' 'Barber card photo' $ink $green $muted (C 219 208 189)
      Draw-InfoCard $g 88 470 452 210 'Use this for' 'Your public barber card display' 'Upload a strong haircut, studio, or branded barber image that looks polished enough to attract bookings at first glance.' $ink $green $muted $accent
      Draw-InfoCard $g 88 714 452 210 'Best practice' 'Pick the image customers should notice first' 'This should feel like your marketplace cover image. Make it clean, sharp, and worthy of a customer deciding to tap Book Now.' $ink $green $muted $accent
    }
    'steps' {
      Card $g 56 430 968 620 34
      Draw-InfoCard $g 88 472 416 180 'Step 1' 'Log in and open Settings' 'Go to your barber account and open the Settings page where your images are managed.' $ink $green $muted $accent
      Draw-InfoCard $g 540 472 416 180 'Step 2' 'Upload your profile photo' 'Use a clear face photo of the barber who owns the account.' $ink $green $muted $accent
      Draw-InfoCard $g 88 684 416 180 'Step 3' 'Upload your barber card photo' 'Choose the image you want customers to see on your public barber card.' $ink $green $muted $accent
      Draw-InfoCard $g 540 684 416 180 'Step 4' 'Save changes' 'You can return anytime later to replace either image when you want to refresh your profile.' $ink $green $muted $accent
    }
  }

  $footerBrush = New-Object System.Drawing.SolidBrush($muted)
  $g.DrawString($slide.Footer,$footerFont,$footerBrush,(New-Object System.Drawing.RectangleF 58,1232,900,36))
  $footerBrush.Dispose()
  $brandFont.Dispose()
  $headlineFont.Dispose()
  $subFont.Dispose()
  $footerFont.Dispose()
  $headlineBrush.Dispose()
  $subBrush.Dispose()

  Save-Jpeg $bmp (Join-Path $root $slide.Out)
  $g.Dispose()
  $bmp.Dispose()
}

Write-Host 'Created profile + barber card update carousel.'
