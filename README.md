# Courser - CSSE6400

[![CI](https://github.com/keys-i/Courser/actions/workflows/ci.yml/badge.svg)](https://github.com/keys-i/Courser/actions/workflows/ci.yml)

Courser is a local-only grade and PAF calculator for CSSE6400. It uses compact stage marks like `754`, keeps all calculations in the browser, and estimates how the team capstone grade turns into an individual project grade.

The Courser mark is an original parody-style snake-cursor hybrid. It is not affiliated with Cursor, does not copy Cursor's official logo, and uses no Cursor assets.

## What PAF Means

Individual project grade comes from the team capstone grade and your PAF factor. Peer feedback, staff observations, and GitHub data feed that factor.

Gradebook may show PAF weirdly, but it is a factor, not a mark out of 10. `1.00` means `100%`, so your individual project grade equals the team capstone grade.

## Formulas

```math
C = \frac{S_1 + S_2 + S_3}{3}

I = T \times p

p = \frac{I}{T}

G = 0.40C + 0.30R + 0.30I

I = \frac{G - 0.40C - 0.30R}{0.30}

T = \frac{1}{N}\sum_{i=1}^{N}I_i

p_i = \frac{I_i}{T}

\sum_{i=1}^{N}p_i = N
```

Where:

- `S` is the compact stage mark input, for example `754`
- `S1`, `S2`, `S3` are the three stage digits
- `C` is the stage average
- `R` is the Architecture Presentation mark
- `T` is the team capstone project grade
- `p` is the peer assessment factor
- `I` is the individual project grade after PAF
- `G` is the weighted course result before rounding

Marks stay on the immutable `1-7` scale. PAF is a factor, so it can be below or above `1`. An individual project grade above `7` needs course rules.

## PAF Reality Check

Use PAF Reality Check when someone's marks are missing. It samples likely `1-7` scores and shows whether the PAF story still makes sense.

The check uses a Monte Carlo-style simulation with a locked seed so shared links can reproduce the same run. It is an estimate, not proof.

## Profile Badge

Copy-paste snippets for a GitHub profile README are in [docs/profile-badge.md](docs/profile-badge.md).

## QA

Manual checks live in [docs/qa.md](docs/qa.md).

## CI/CD

Tests, build, security smoke checks, CodeQL, dependency review, and deploy run through GitHub Actions. See [docs/ci-cd-plan.md](docs/ci-cd-plan.md).

## Local Development

```sh
npm install
npm run dev
npm test
npm run build
npm run preview
```

## License

MIT License — see [LICENSE](LICENSE).
