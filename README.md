# Courser - CSSE6400

Courser is a local-only grade and PAF calculator for CSSE6400. It keeps marks on the immutable `1–7` scale, sorts Result by PAF, and uses Hex Check Arena when marks are missing.

The Courser mark is an original parody-style snake-cursor hybrid. It is not affiliated with Cursor, does not copy Cursor's official logo, and uses no Cursor assets.

## Formulas

Cloud is entered as `XYZ`, where each digit is one cloud task grade from `1` to `7`.

```math
Cloud = \frac{X + Y + Z}{3}
```

Overall grade:

```math
Overall = 0.40C + 0.30P + 0.30F
```

Solved per student:

```math
F = \frac{Overall - 0.40C - 0.30P}{0.30}
```

Raw team final project grade before PAF:

```math
T = \frac{1}{N}\sum_{i=1}^{N}F_i
```

PAF:

```math
p_i = \frac{F_i}{T}
```

```math
\sum_{i=1}^{N}p_i = N
```

Every row counts as a team member. The team needs at least three members before exact calculations make sense.

## Hex Check Arena

Use Hex Check when teammates are missing marks. It samples possible `1–7` ranges and estimates whether the PAF setup still works.

Missing cloud task grades are sampled as integers. Missing presentation and overall grades are sampled in tenths. The seed is shown, locked, and included in share links so a shared run can be reproduced.

Hex Check is an estimate, not proof. Final project grades after PAF above `7` may or may not be allowed by course rules.

## Profile Badge

Copy-paste snippets for a GitHub profile README are in [docs/profile-badge.md](docs/profile-badge.md).

## QA

Manual checks live in [docs/qa.md](docs/qa.md).

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
