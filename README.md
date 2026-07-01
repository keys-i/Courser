# Courser - CSSE6400

[![CI](https://github.com/keys-i/Courser/actions/workflows/ci.yml/badge.svg)](https://github.com/keys-i/Courser/actions/workflows/ci.yml)

Courser is a local-only grade and PAF calculator for CSSE6400. It uses the course's `1-7` mark scale, keeps all calculations in the browser, and helps explain how the team capstone grade turns into an individual project grade.

The Courser mark is an original parody-style snake-cursor hybrid. It is not affiliated with Cursor, does not copy Cursor's official logo, and uses no Cursor assets.

## Released Grade Context

The released feedback says:

> Your individual project grade is based on the team's project grade and your peer assessment factor. The peer assessment factor is based on the feedback provided by other team members, and yourself; plus observations made by staff in your practical class and data from GitHub.

Courser treats the peer evaluation score as released feedback only. It is not the PAF. PAF is the factor that adjusts the team capstone project grade into the individual project grade.

Gradebook may show PAF strangely as out of 10, but it is a factor. `1.00` means `100%`, `1.20` means `120%`, and `0.80` means `80%`.

## Released Grade Example

Radhesh Goel's released marks:

| Item | Date | Mark |
| --- | --- | --- |
| Stage 1 - API Functionality | 27/03/2026 | 7/7 |
| Stage 2 - Deployed to Cloud | 13/04/2026 | 7/7 |
| Stage 3 - Scalable Application | 01/05/2026 | 7/7 |
| Architecture Presentation | 29/05/2026 | 6/7 |
| Team Capstone Project | 08/06/2026 | 7/7 |
| Capstone Project Peer Evaluation display | released feedback | 1 |
| Individual Project Grade | 08/06/2026 | 7/7 |

For this example:

- Stage average: `7.00`
- Team capstone grade: `7.00`
- Individual project grade: `7.00`
- Estimated PAF: `7 / 7 = 1.00`
- Weighted result: `6.70 before course rounding`

Courser does not claim official course rounding rules.

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

- `S1`, `S2`, `S3` are the three stage marks
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
