[![make.fun · news-image-20261122](https://make.fun/badge/news-image-20261122.svg)](https://make.fun/bounty/news-image-20261122?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261122)
[![rank](https://make.fun/badge/news-image-20261122/gmxbtt/news-image-20261122/rank.svg)](https://make.fun/bounty/news-image-20261122/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261122)
[![reward](https://make.fun/badge/news-image-20261122/gmxbtt/news-image-20261122/reward.svg)](https://make.fun/bounty/news-image-20261122?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261122)

# THE WORLD IN ONE PAGE — 22 November 2026

Entry for [make.fun **news-image-20261122**](https://make.fun/bounty/news-image-20261122):
"Sum up 22 November's world news in one image" ($100 in USDC, shared by the
top 50 entries).

`main.ts` is a self-contained Node 22 program (standard library only — no
assets, no network, no dependencies) that draws a newspaper front page in
code and writes it to `entry.png`. The masthead names the day, **Sunday 22
November 2026**, and the page carries six stories from that day:

- COP31 collapses in Antalya: the EU rejects a climate deal that never mentions fossil fuels
- Iran fires missiles and drones at US bases in Bahrain; tankers struck near Hormuz
- Mexico captures cartel boss 'El Chapo Isidro' in Sinaloa; 11 killed in the raid
- a Russian drone strike partly destroys an apartment block near Kyiv; 14 missing
- the World Court rules Myanmar committed genocide against the Rohingya
- US stocks fall into correction as the AI sell-off spreads to Asia

Every fact on the page was checked against live news coverage of 22 November
2026 (Reuters, AP, AFP). Nothing is invented.

## Run

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Two runs write byte-identical PNGs (1024×1024, 28 KB, well under the 1 MiB cap).

## Referral

Built for [make.fun](https://make.fun/r/vg0kgv1n) — join with referral code `vg0kgv1n`.

## License

MIT — see [LICENSE](LICENSE).
