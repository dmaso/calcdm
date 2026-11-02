# calcdm

A working replica of the iOS 26 Calculator, built as a web app you add to your Home Screen, with a forcing mechanism built in. It's made for the [I.C.F. calculator force](https://thedailymagician.com/icf-force), and lets you do the final phase with the phone face up while the spectator drums their fingers on the screen.

Live: **https://calcdm.com**

Background:

- [The Daily Magician: the I.C.F. force](https://thedailymagician.com/icf-force), the force itself
- [The Jerx: the calculator force, face up](https://www.thejerx.com/blog/2025/5/6/t12u882u8mz4kzsjc0hfh1efgbqdpx)
- [The Jerx: Carefree Toxic](https://www.thejerx.com/blog/2025/5/13/carefree-toxic)
- [andyjermann/fakecalc](https://github.com/andyjermann/fakecalc), the static-screenshot version this started from

This is a real calculator with the same pixel geometry as the iOS 26 app, measured from screenshots on an iPhone 14 Pro.

## How it works

It works as a normal calculator but has the forcing mechanism:

1. **Set the force number.** Type a number, then hold the clock icon (top left) for a second. The display clears and the clock hand swings to 9 o'clock, which tells you it's set. Hold the calculator icon (top right) at any time to peek at the number.

2. **Do any calculation.** Any adding, subtracting, multiplying or dividing, as per the normal routine.

3. **When you're ready for the final calculation**, press an operator **twice**: **+** if the running total is below the force number, **−** if it's above, or **×** / **÷** if the force number is a clean multiple or fraction of the total. Nothing visible changes.

   Not sure which to use? **Hold** any operator for a second and the display shows the number the spectator would need to enter after it to hit the force number, whole or not. Let go and the display goes back to normal without pressing the operator.

4. **Every tap anywhere on the screen** then enters the next digit of the number needed to get to the force number. So you can have them drum their fingers over it, or turn it over as in the original routine. A tap with two or three fingers counts as one tap, and it doesn't matter which keys they hit. The clock hand moves to **6 o'clock** when all digits are in, so you know it's done. Extra taps do nothing.

   The one exception is **backspace**, which still deletes the last digit, so a mis-tap can be undone. The clock hand goes back to 9 until the digit is re-entered.

5. **Hit equals.** You get the force number.

The whole thing is self-working, with no shortcuts or mental maths, and you can do it face up. After the reveal the force number clears itself and the clock hand returns to 3 o'clock.

Other things worth knowing:

- Hold the clock icon while the display shows 0 to clear the force number.
- Numbers show in US format (`1,234.56`) by default. Double-tap the calculator icon to switch to European format (`1.234,56`) and back. A single tap does nothing. A short note at the top shows which one is on, and the choice is remembered.
- If you pick an operator that doesn't work out cleanly in step 3, the sum on screen won't add up, though **=** still shows the force number. The hold-to-peek shows a minus sign or a decimal when that would happen.
- While digits are still owed, **C** counts as a tap like any other key. After the digits are complete, **C** abandons the force and keeps the number set.
- The screen goes black if the phone is turned sideways, and comes back in portrait. The real Calculator would switch to scientific mode, so keep Rotation Lock on in Control Centre for the closest match.
- You can preset the number from an iOS Shortcut by opening `https://calcdm.com/?t=1234`. It survives relaunching the app until it's used or cleared.

## Add to Home Screen

1. Open https://calcdm.com in **Safari**.
2. **Share → Add to Home Screen**. Name it **Calculator**. It picks up the real app's icon.
3. Launch it from the Home Screen once while online so it caches. It then works offline.

Tested on an iPhone 14 Pro. Sizes are expressed relative to screen width, so other iPhones should scale, but they may need a tweak.

## Development

Static files, no build step.

- `index.html` — markup, with the operator and icon glyphs as inline SVG sized to the reference
- `style.css` — all geometry as multiples of `--u`, one point on a 393pt-wide screen, anchored to the safe areas
- `app.js` — calculator engine (iOS precedence, %, ±, backspace, repeated =, swipe-to-delete, the calculation line) and the force logic
- `manifest.webmanifest`, `sw.js` — Home Screen install and offline cache
- `reference/` — the iOS screenshots used for calibration and `compare.html`, a dev page that overlays one on the live app (`?ref=ios26|result&mode=diff|half|off`)

Deploy to Netlify with `netlify deploy --prod --dir .` from the project folder (it's linked to the Netlify site).

To host it anywhere else, run `./build.sh` and upload the contents of `dist/` to the web root over SFTP. The site must be served over HTTPS for offline use and Add to Home Screen to work.
