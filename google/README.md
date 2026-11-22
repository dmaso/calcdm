# calcdm for Android: Google Calculator

A working copy of **Google Calculator** (the Pixel calculator, version 9.x) with the calcdm force built in. It's served at **[calcdm.com/google/](https://calcdm.com/google/)**.

It works as a normal calculator, with the same layout, keys, live result preview, scientific keys, menu and history as the real app. Every calculation before the final one is genuine.

## Install it

1. Open **calcdm.com/google/** in **Chrome** on the Android phone.
2. Tap the three dots, then **Install app** (or **Add to Home screen**, then **Install**). It installs as an app called **Calculator** with the Calculator icon, and it shows in the app drawer.
3. Open it once while online, so it works offline from then on.

## Match the phone's colours (do this once)

Pixels colour the calculator from the wallpaper, so every phone's keys are different. The copy reads the colours from a screenshot of the real app:

1. Open the real Calculator, clear it, and take a screenshot. If the phone switches between light and dark mode, take one in each.
2. In the copy, **hold the ⌃⌄ chevron** (left, above the keys) to open the colour setup.
3. Pick each screenshot, then tap **Done**.

Without this it uses Google's standard colours, which match a phone with wallpaper colours turned off. The **⋮ → Choose theme** setting works as in the real app.

## The force

The same moves as the iPhone version:

| Do this | It does |
| --- | --- |
| Type a number, tap the **history** icon (top left) | Saves the force number |
| Hold the decimal key | Peeks at the saved number |
| Hold ⌫ | Full reset, clears the saved number |
| Hold % | Hides or shows the specks |
| Speck on + or − | The operator that reaches the force number |
| Speck on a number key | How many digits that takes |
| Tap the operator with the speck twice | Arms the force |
| Hold an operator | Shows the number needed after it |
| Type 0 to 9, **hold ⋮** | Sets the force number to the date and time, that many minutes ahead |

**The tell** is the long hand of the history icon:

- About half past four, as drawn: nothing saved.
- Half past seven: a force number is saved.
- Six o'clock: every digit is in, ready for `=`.

The grey preview line counts up as the spectator drums, and shows the force number once every digit is in. Press `=` and it becomes the result, in the same colour as the real app.

## Good to know

- `?t=1234` on the link presets the force number. `?setup=1` opens the colour setup.
- Swipe down on the number to see the history, as in the real app.
- One back swipe is caught (it closes the menu or history instead of the app). Two in a row close the app, as with any app.
- **Tells to avoid:** App info says the app was installed by Chrome. On a Pixel with themed icons turned on, the icon is tinted automatically and won't exactly match the real one.
- Haptics use the browser's vibration, which is a little buzzier than the native key tick, and silent when the ringer is on silent.

Built from Google Calculator 9.3's own layout fractions and colour roles, and the AOSP ExactCalculator's behaviour. Font: [Google Sans Flex](https://fonts.google.com/specimen/Google+Sans+Flex) (SIL Open Font License, in `fonts/`). Icons: [Material Symbols](https://github.com/google/material-design-icons) (Apache 2.0).
