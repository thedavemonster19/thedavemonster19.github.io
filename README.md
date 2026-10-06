# thedavemonster19.github.io

Static GitHub Pages site (no Jekyll: see `.nojekyll`).

## kaizen-gto/

`kaizen-gto/` is a **generated build** of the Kaizen GTO trainer. Don't edit files here by hand.
The source is maintained privately; each deploy copies the verified build output over this folder
and commits it to `main`, which publishes it.

- `index.html`: the trainer (Play, Progress, My training)
- `review.html`: Hand reviews. It replays imported review packs (`.json`) step by step and pauses at the
  coached decisions. Packs stay in the visitor's own browser storage; none ship with the site.
