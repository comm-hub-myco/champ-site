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
jobs:
build:
runs-on: ubuntu-latest
steps:
- uses: actions/checkout@v4
- name: Generate calendar index.json
run: |
files=$(ls -1 pages/dashboard/calendar/events | sort)
printf '{\n "events": [\n' > pages/dashboard/calendar/index.json
first=1
for f in $files; do
if [ $first -eq 1 ]; then sep=' '; first=0; else sep=' ,'; fi
printf "%s\"%s\"\n" "$sep" "$f" >> pages/dashboard/calendar/index.json
done
printf ' ]\n}\n' >> pages/dashboard/calendar/index.json
- name: Commit & push
run: |
git config user.name "gh-actions"
git config user.email "actions@github.com"
git add pages/dashboard/calendar/index.json
git commit -m "chore: rebuild calendar manifest" || echo "No changes"
git push
