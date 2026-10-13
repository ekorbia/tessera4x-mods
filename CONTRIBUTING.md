# Adding a mod

Thanks for sharing one. A mod here is a folder with two files, and a check
runs on every pull request to make sure the game will take it.

## Steps

1. **Make the mod and play it.** The mod panel (**New game → Mods**) checks
   it as you go, and **Test it in the Balance Lab** shows what it does to a
   game. The full reference is at [tessera4x.com/mods](https://tessera4x.com/mods/).
2. **Fork this repo** and add a folder under `mods/`, named for your mod in
   lowercase words joined by hyphens: `mods/iron-harvest/`.
3. **Put your mod in `mod.json`**, exactly as the game reads it.
4. **Add a `README.md`** from the template below.
5. **Run the checks** if you have Node 22 or later (optional, because CI runs
   them anyway):
   ```
   npm run check
   npm run catalogue
   ```
   `catalogue` writes your README's heading, Play links and table of changes,
   and adds your mod to the list on the front page.
6. **Open a pull request** and tick the checklist.

## House rules

- **Your own original work.** Real history and public-domain stories
  (places, rulers, wonders, characters) are welcome. If your mod is based on
  a book, name the book and its year in the description.
- **Nothing taken from another game:** no names, rules, rosters or text.
- **Names a family audience can read**, and a description that says what
  the mod does.
- **Leave a blurb out unless you want new wording.** The game writes your
  numbers and new names into the blurbs you leave alone. If your numbers make
  a blurb's claim untrue ("the fastest", "pays for itself"), write it a new
  one. A new blurb keeps everything the old one said that your mod doesn't
  change: what the thing needs, and what it does that no field holds.
- **List only what you change.** An entry with nothing in it, or a victory
  set to `true`, is the game's own rule already.
- **One mod per pull request.** To change someone else's mod, open an issue
  first.
- **Mod names are unique** in this repo.

## Licensing

By opening a pull request you dedicate your mod to the public domain under
[CC0 1.0](LICENSE): anyone may play, change and share it, and it may be
bundled with the game itself. The pull request template's checkbox says so.

## README template

The parts between the markers are written by `npm run catalogue`; leave
the markers in place and write the rest.

```markdown
<!-- head:start -->
<!-- head:end -->

## How it plays

A few sentences: what the first turns now turn on, and what the player
decides that they didn't before.

## What changes

<!-- changes:start -->
<!-- changes:end -->

## Balance Lab

Optional: what **Test it in the Balance Lab** showed. How many worlds, and
what moved: who wins and how, what gets built, which wonders rise.
```
