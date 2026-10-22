# TarTrak showreel

15-second promo video, built with Remotion. Everything (map, UI, score) is drawn or synthesized in code.

    npm install
    npm run render        # public/score.wav, out/tartrak-showreel.mp4, out/tartrak-showreel-web.mp4, out/poster.png
    npm run studio        # live preview
    node scripts/still.ts Shot3 270 300   # stills into out/stills/

## 45 s reel

`Reel45` (16:9) and `Reel45Vertical` (9:16) are one composition at two sizes: the showreel's shots 1-4,
six new scenes (src/reel45/scenes: how it works, maps, extracts, raid clock, shared markers, hotkeys), then
shots 5-7. The timeline is src/reel45/timeline.ts; the score's bars are audio/reel45.ts. In the vertical cut
the 16:9 shots are reframed by src/reel45/Reframe.tsx, which also moves their headlines under the picture.

    npm run render:reel45                                  # public/score45.wav, out/tartrak-reel45.mp4
    npx remotion render src/index.ts Reel45Vertical out/tartrak-reel45-vertical.mp4 --codec=h264 --crf=14
    node scripts/still.ts Reel45Vertical 1820              # stills into out/stills/

Remotion is free for individuals and companies of up to 3 people (remotion.dev/license).
