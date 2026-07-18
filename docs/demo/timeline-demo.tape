# VHS tape for the ChronoClaude /timestamps timeline demo GIF.
# Render:  vhs docs/demo/timeline-demo.tape   (output → docs/demo.gif)
# Requires charmbracelet/vhs (brew install vhs).
Output docs/demo.gif

Set Shell bash
Set FontSize 15
Set Width 1080
Set Height 620
Set Padding 24
Set Theme "GruvboxDark"
Set TypingSpeed 30ms

Hide
Type "clear && bash docs/demo/timeline-replay.sh" Enter
Sleep 700ms
Show
Sleep 6s
