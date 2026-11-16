# calcdm

A working replica of the iOS 26 Calculator, built as a web app you add to your Home Screen, with a forcing mechanism built in. It's made for the [I.C.F. calculator force](https://thedailymagician.com/icf-force) and similar routines, and lets you do the final phase with the phone face up while the spectator drums their fingers on the screen.

It works as a normal calculator. Every calculation before the final one is genuine, so the spectator can check the numbers on another calculator afterwards.

## Pick your version

| Link | Numbers look like | For |
| --- | --- | --- |
| **[calcdm.com](https://calcdm.com)** or **[calcdm.com/us](https://calcdm.com/us)** | `1,234,567.89` | US |
| **[calcdm.com/uk](https://calcdm.com/uk)** | `1,234,567.89` | UK, Ireland, Australia |
| **[calcdm.com/eu](https://calcdm.com/eu)** | `1.234.567,89` | Most of Europe, Brazil |

Each link installs as its own app, so pick one and stick with it.

## Add it to your Home Screen

1. Open your version's link in **Safari** on your iPhone.
2. Tap **Share** (the square with an upward arrow), then **Add to Home Screen**.
3. Name it **Calculator** and tap **Add**. Keep **Open as Web App** on if you see it.
4. Open it once from the Home Screen while online, so it works offline from then on.

The icon looks the same as Apple's Calculator. Put one of them somewhere you'll remember, so you don't open the wrong one in performance.

## Set the force number

1. Open the calculator from your Home Screen.
2. Type the number you want to force.
3. **Tap the clock icon** (top left) once.

The display clears and the clock hand swings to **9 o'clock**. That tells you the number is saved. It stays saved if you close and reopen the app.

From now on, two tiny white specks show you where you stand:

- One on **+** or **−**: the operator that gets from the number on screen to your force number.
- One on a **number key**: how many digits that would take.

They update after every key, so you always know whether you're above or below your force number, and by how much. If you're far off, you can do another calculation to get closer before you start the force.

Each key puts its speck in a random spot around the symbol, so look at the whole key.

No specks means the screen already shows your force number, or the number needed is too long to type (over 9 digits). Do another calculation to bring it back in range.

**Peek at it:** press and hold the decimal key (`.` or `,`, left of `=`). The saved number shows while you hold it.

**Clear it:** press and hold the delete key (top left of the keypad). This resets the calculator and the clock hand goes to **3 o'clock**. You don't need to do this after a performance, because a completed force clears itself.

## Perform the force

1. **Do ordinary calculations.** Let the spectator add, subtract, multiply or divide. Division tends to give long decimals, so use it with care.

2. **Check the number-key speck, then tap the operator with the speck twice.** The number-key speck is how many digits will be entered, so you know whether to ask for "a couple" of taps or "a bunch". The double tap arms the force, and both specks go. Double-tapping the other operator does nothing, so the maths always comes out right.

   Want to see the actual number? **Hold** an operator and the display shows the number that would need to follow it. Let go and nothing has changed.

3. **Have the spectator drum their fingers** on the screen. Each tap enters the next digit of the needed number, wherever it lands. Every key works the same way, delete included, so nothing can be undone by accident. The key for each digit entered lights up briefly.

   The clock hand moves to **6 o'clock** when all the digits are in. Have them stop there. Extra taps do nothing.

4. **Press =.** The result is your force number.

## Quick reference

| Do this | It does |
| --- | --- |
| Type a number, tap the clock | Saves the force number (clock at 9) |
| Hold the decimal key | Peeks at the saved number |
| Hold delete | Full reset, clears the saved number (clock at 3) |
| Speck on + or − | The operator that reaches your force number |
| Speck on a number key | How many digits that takes |
| Tap the operator with the speck twice | Arms the force |
| Hold an operator | Shows the number needed after it |
| Clock at 6 | All digits in, ready for = |

## Good to know

- The screen goes black if the phone is turned sideways, and comes back in portrait. Keep Rotation Lock on in Control Centre for the closest match to the real app.
- You can preset the number from an iOS Shortcut by opening your version's link with `?t=1234` on the end, for example `https://calcdm.com/uk/?t=1234`.
- Tested on an iPhone 14 Pro and an iPhone 15 Pro Max. Sizes scale with screen width, so other modern iPhones should work, but haven't all been checked.

## Credits

- Original app by [Dave Mason](https://github.com/dmaso).
- One-tap setup, the peek and reset gestures, the digit-count dot, the lit keys, making every key enter the next digit during the force, and showing whether to add or subtract, by [Demian Max](https://github.com/100ratings/sumduo).
- US English version and instructions by [Andy](https://github.com/andyjermann/sumduo).
- European number format by [Groschenroman](https://github.com/Groschenroman/calcdm).
- Started from [andyjermann/fakecalc](https://github.com/andyjermann/fakecalc).

Background:

- [The Daily Magician: the I.C.F. force](https://thedailymagician.com/icf-force)
- [The Jerx: the calculator force, face up](https://www.thejerx.com/blog/2025/5/6/t12u882u8mz4kzsjc0hfh1efgbqdpx)
- [The Jerx: Carefree Toxic](https://www.thejerx.com/blog/2025/5/13/carefree-toxic)

## Development

Static files, no build step.

- `index.html`: markup, with the operator and icon glyphs as inline SVG sized to the reference
- `style.css`: all geometry as multiples of `--u`, one point on a 393pt-wide screen, anchored to the safe areas
- `app.js`: calculator engine and force logic. The number and date format comes from the path (`/us`, `/uk`, `/eu`).
- `manifest.webmanifest`, `sw.js`: Home Screen install and offline cache
- `netlify.toml`: serves the same files at `/us/`, `/uk/` and `/eu/`
