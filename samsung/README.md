# calcdm for Android: Samsung Calculator

A working copy of **Samsung Calculator** as it looks on One UI 8.5 and One UI 9 (app version 12.5.10 and later), with the calcdm force built in. It's served at **[calcdm.com/samsung/](https://calcdm.com/samsung/)**.

It works as a normal calculator, with the same layout, colours, live preview, scientific keys, smart brackets, limits and messages as the real app. Every calculation before the final one is genuine.

## Install it

1. Open **calcdm.com/samsung/** in **Chrome** or **Samsung Internet** on the Galaxy phone. Stick to the one you install from, because the saved force number lives in that browser.
2. Chrome: three dots, then **Install app**. Samsung Internet: the install icon in the address bar, then **Install**. It installs as an app called **Calculator** with the Calculator icon.
3. Open it once while online, so it works offline from then on.

The colours are the app's own, light and dark, and follow the phone's dark mode, so there's nothing to set up.

## The force

The same moves as the iPhone version:

| Do this | It does |
| --- | --- |
| Type a number, tap the **history clock** (top left) | Saves the force number |
| Hold the decimal key | Peeks at the saved number |
| Hold ⌫ | Full reset, clears the saved number |
| Hold % | Hides or shows the specks |
| Speck on + or − | The operator that reaches the force number |
| Speck on a number key | How many digits that takes |
| Tap the operator with the speck twice | Arms the force |
| Hold an operator | Shows the number needed after it |
| Type 0 to 9, **hold the ruler** | Sets the force number to the date and time, that many minutes ahead |

**The tell** is the long hand of the history clock, as on the iPhone:

- 3 o'clock: nothing saved.
- 9 o'clock: a force number is saved.
- 6 o'clock: every digit is in, ready for `=`.

The grey preview line counts up as the spectator drums, and shows the force number once every digit is in. Press `=` and it becomes the result in green, as in the real app.

## Good to know

- `?t=1234` on the link presets the force number.
- Holding `( )` shows the +/− bubble, as in the real app. The ruler (unit converter) does nothing when tapped.
- One back swipe is caught, so a stray swipe mid-routine doesn't close the app. Two in a row close it, as with any app.
- **Tells to avoid:** App info says the app was installed by the browser. The text uses Roboto, because Samsung's own font isn't licensed for the web; it's very close, but the digits are a touch narrower.
- Galaxy phones on One UI 7 or 8 with an older Calculator show the previous design (pill-shaped keys, a ⌫ icon above the keypad). This copies the current one.

Built from Samsung Calculator 12.6's own layout percentages, colours and messages. Font: [Roboto](https://fonts.google.com/specimen/Roboto) (SIL Open Font License, in `fonts/`).
