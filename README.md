# Tidekeeper

A make.fun `best-game-01` entry: you are the keeper of a lighthouse on a
rocky coast. Guide ships home through five nights of fog.

- **Aim the beam with the mouse.** Ships inside the light steer toward it,
  into the green-lit harbour channel. Rocks, cliffs and reef-wraiths wreck
  them; lose 3 ships and the night takes the harbour.
- **Hold click / Space to focus the beam** and burn wraiths — it drinks oil.
- **Score:** docked ships (combos for streaks), banished wraiths, and a bonus
  for each night cleared. Survive all 5 nights to see the dawn.
- **Controls:** mouse aim, hold click / Space focus, P pause, R restart,
  M sound, Enter start.
- **Sound:** everything is synthesised with WebAudio — no audio files.

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

Static files only (`game/`), no build step, no network requests.

## Hand it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` to the output directory and
writes `dossier.json` with the vendored `makefun-game.ts` library.

Screenshots are staged from the real game (`game/src/shots.js`):
`1-start.jpg` title, `2-play.jpg` mid-game with HUD, `3-end.jpg` game over.

## License

MIT — see `LICENSE`.
