# Keep the Customer

A short story game about getting found, delivering, and keeping customers. Three situations, your choices, and what they lead to. Designed in the HUMAN.md visual language.

**It is one file.** `index.html` has the page, the styles and the game logic. There is no build step and nothing to install. The only outside request is Google Fonts (Bricolage Grotesque and Cutive Mono).

```
keep-the-customer-site/
  index.html     the whole game
  .nojekyll      tells GitHub Pages to serve the files as they are
  README.md      this file
```

## Publish it on GitHub Pages

1. Create a new repository on GitHub, for example `keep-the-customer`. Public is fine and is what the free Pages plan needs.
2. Upload the contents of this folder to the repository root (`index.html`, `.nojekyll`, `README.md`). On the repository page: **Add file → Upload files**, drag them in, then **Commit changes**.
3. Open **Settings → Pages**. Under **Build and deployment**, set **Source** to **Deploy from a branch**, choose branch **main** and folder **/ (root)**, then **Save**.
4. Wait a minute or two. The page shows the address at the top: `https://YOUR-USERNAME.github.io/keep-the-customer/`.
5. Open that address and play through once to check it.

## Link it from drpnvasist.com

Pick one of these.

**A. Plain link (simplest).** Add a link or button on your site that points to the GitHub Pages address from step 4. It opens the game as its own page.

```html
<a href="https://YOUR-USERNAME.github.io/keep-the-customer/" target="_blank" rel="noopener">Play Keep the Customer</a>
```

**B. Your own address, for example `keep.drpnvasist.com`.** This needs a change in your domain's DNS settings, which I could not do for you.
1. In your DNS provider, add a record: type **CNAME**, name **keep**, value **YOUR-USERNAME.github.io**.
2. In the repository, go to **Settings → Pages → Custom domain**, enter `keep.drpnvasist.com`, and save. GitHub adds a `CNAME` file for you.
3. Tick **Enforce HTTPS** once it becomes available (it can take up to a day).
4. Link to `https://keep.drpnvasist.com` from your site.

**C. Show it inside a page on your site.** Use an iframe. The game is built to fill one screen, so give the frame a full-screen-ish height.

```html
<iframe src="https://YOUR-USERNAME.github.io/keep-the-customer/"
        title="Keep the Customer"
        style="width:100%;height:85vh;border:0;border-radius:12px"
        loading="lazy" allow="fullscreen"></iframe>
```
If your site builder blocks iframes, use option A or B.

## Making changes later

Edit `index.html` in GitHub (pencil icon) or on your computer, and commit. Pages republishes within a minute or two. The story text, options and numbers sit near the top of the `<script>` section, in the objects named `S1`, `S2`, `S3`, `LENS` and the `METER` texts.

## Notes

- The illustrations are flat shapes drawn inside the page, so there are no image files to manage.
- The framed pictures in the side margins only show on very wide screens (1560px and above). On narrower screens the space is used by the game.
- No cookies, no analytics and no data collection. Nothing is stored in the browser.
- No licence file is included. Add one if you want others to reuse the code, or keep it as it is to retain all rights.
