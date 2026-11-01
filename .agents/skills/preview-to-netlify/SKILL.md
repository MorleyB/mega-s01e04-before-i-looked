---
name: preview-to-netlify
description: Publish a rig page as a one-file public preview on Netlify, and later upload it again without the lane marker (ADR 0003). Use when a plan's "Preview for review" or "Clean up" issue comes up.
---

# preview-to-netlify

A preview is one HTML file on a public HTTPS link that we can upload over later (ADR 0003).
Previews never go in the repo, in issues or in chat attachments.

## Before you start

- Ask the human before installing the CLI, before signing in, and before every upload. Say what
  goes up, where, who can see it (anyone with the link) and how to undo it (delete the site).
- `netlify --version` and `netlify status`. Missing: `npm install -g netlify-cli` (with a yes).
  Not signed in: `netlify login`; the human authorizes in the browser.

## 1. Save the page (a command, not "save as")

Render through the app with the lane's `.env`, into a folder outside the repo:

```sh
mkdir -p "$OUT/preview"
npx tsx --env-file=.env -e "import('./src/app.tsx').then(async ({createApp}) => {
  const r = await createApp().request('/digest/<night>');
  if (r.status !== 200) throw new Error('status ' + r.status);
  process.stdout.write(await r.text());
})" > "$OUT/preview/index.html"
```

Check the banner: `grep -o 'class="marker">[^<]*' "$OUT/preview/index.html"`.

## 2. First upload

```sh
netlify sites:create --name <site-name> --disable-linking   # note the Project ID
netlify deploy --prod --dir "$OUT/preview" --site <project-id> --message "preview with marker"
```

Run it from `$OUT`, not the repo, so no `.netlify/` state lands in git.

## 3. Check the link from outside, then send it

```sh
curl -sI https://<site-name>.netlify.app/ | head -1        # expect 200
curl -s  https://<site-name>.netlify.app/ | grep -o 'class="marker">[^<]*'
```

Send the reviewer the link and the plan's issues. Keep the preview issue open until the reviewer
has looked.

## 4. Clean up (after the review is in)

Save again with the marker unset, then upload over the same site:

```sh
env -u LANE_MARKER npx tsx -e "..." > "$OUT/clean/index.html"   # same command as step 1, no --env-file
grep -c '<marker value>' "$OUT/clean/index.html"                # expect 0
netlify deploy --prod --dir "$OUT/clean" --site <project-id> --message "preview without marker"
curl -s https://<site-name>.netlify.app/ | grep -o 'class="marker">[^<]*'   # "no marker set"
```

Netlify keeps every deploy at its own `https://<deploy-id>--<site-name>.netlify.app` link, so the
marked copy stays reachable there. Tell the human; deleting the site once the plan is done removes
it (`netlify sites:delete <project-id>`, with a yes).
