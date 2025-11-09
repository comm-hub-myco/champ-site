# - THE SOIL -
A dashboard for community events and note-worthy news related to C.H.A.M.P.

A static, modular dashboard for a decentralized mycology community.


## Local preview
Open `index.html` in VS Code with “Live Server” or any static file server.


## Updating the calendar
1. Create a new file under `pages/dashboard/calendar/events/` named `YYYY-MM-DD-your-title.txt`.
2. Use the `key: value` fields like:
3. 3. Add the filename to `pages/dashboard/calendar/index.json` under `events`.
4. Commit and push. GitHub Pages will redeploy; the event appears automatically.


> **Optional:** Automate step 3 with a GitHub Action that rebuilds the manifest on push.


## Updating the Proton feed JSON
- Edit `data/proton_feed.json` manually for now, or use an automation (see below) to mirror a Proton thread to JSON.


## Suggestion box backend
- Replace `data/site-config.json → suggestionBox.endpoint` with a Formspree/Basin/Worker endpoint that forwards to your Proton address.
- You can swap backends without touching the frontend.


## Automation Options


### A) GitHub Action — regenerate calendar manifest
Add `.github/workflows/build-manifests.yml`:
```yaml
name: Build manifests

on:
  push:
    paths:
      - 'pages/dashboard/calendar/events/**'
      - '.github/workflows/build-manifests.yml'
  workflow_dispatch:

permissions:
  contents: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          persist-credentials: true

      - name: Generate calendar index.json
        shell: bash
        run: |
          set -euo pipefail
          dir="pages/dashboard/calendar/events"
          out="pages/dashboard/calendar/index.json"

          # Collect & sort event filenames (only regular files)
          mapfile -t files < <(find "$dir" -maxdepth 1 -type f -printf '%f\n' | sort)

          # Write JSON without relying on tricky printf escaping
          {
            echo '{'
            echo '  "events": ['
            sep='  '
            for f in "${files[@]}"; do
              echo "${sep}\"$f\""
              sep='  ,'
            done
            echo '  ]'
            echo '}'
          } > "$out"

      - name: Commit & push
        shell: bash
        run: |
          set -e
          git config user.name "gh-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add pages/dashboard/calendar/index.json
          git commit -m "chore: rebuild calendar manifest" || exit 0
          git push

