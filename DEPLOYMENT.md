# Publish at portfolio.roboticrays.com

Target: a separate public `roboticrays/rr-portfolio` repository, hosted by GitHub Pages. The existing main website uses `roboticrays/roboticrays.github.io`; portfolio deployment uses the new repository.

GitHub Pages hosting and HTTPS are available free for public repositories. The existing domain still needs its normal renewal. This static site requires no build command, Node installation or backend.

## 1. Create the repository and upload this project

In the `roboticrays` GitHub account, create an empty **public** repository named `rr-portfolio`. Leave the initial README, licence and gitignore options unchecked because this project already contains its files.

From a normal terminal in this project:

```bash
git init -b main
git add .
git commit -m "Publish Robotic Rays scan portfolio"
git remote add origin git@github.com:roboticrays/rr-portfolio.git
git push -u origin main
```

These commands assume an empty new repository and an SSH key already authorized for the `roboticrays` account. GitHub Desktop or the HTTPS remote can also be used with an authenticated account. Never paste an access token into a remote URL.

The `.gitignore` excludes raw capture directories, local environments and caches. The `CNAME` file contains `portfolio.roboticrays.com`; the empty `.nojekyll` file tells Pages to serve the static files directly.

## 2. Enable GitHub Pages

Open the new repository → **Settings → Pages**.

1. Set **Source** to **Deploy from a branch**.
2. Select **main** and **/(root)**, then **Save**.
3. Set **Custom domain** to `portfolio.roboticrays.com` and **Save**. This repository setting is required even though a CNAME file is included.
4. Wait for the Pages deployment to finish in the Actions tab.

Configure the custom domain in GitHub before adding its DNS record.

## 3. Add the portfolio DNS record in Namecheap

The domain's publicly queried nameservers were `dns1.registrar-servers.com` and `dns2.registrar-servers.com`, which indicate Namecheap DNS.

In Namecheap: **Domain List → Manage roboticrays.com → Advanced DNS → Host Records → Add New Record**.

| Field | Value |
| --- | --- |
| Type | CNAME Record |
| Host | portfolio |
| Value / Target | roboticrays.github.io |
| TTL | Automatic |

Save the record. Enter only `portfolio` in Host and `roboticrays.github.io` in Value, with no protocol or repository path. If a record already exists for this exact host, inspect it before changing it. The existing root-domain, www, email and platform records are separate from this portfolio record.

## 4. Enable HTTPS and verify

Return to GitHub **Settings → Pages**. When the DNS check and certificate provisioning finish, enable **Enforce HTTPS**.

The final URL is **https://portfolio.roboticrays.com/**. GitHub advises allowing up to 24 hours for DNS propagation and for HTTPS to become available.

Verify the RGB-to-wireframe hero, all three objects' photographs, wireframes and rendered video playback, plus the Bags empty state.

## Future updates

Edit the local project, commit the changes and push to `main`. GitHub Pages will redeploy automatically. Keep master scans outside the web repository and commit only prepared web assets.

## References

- https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
- https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site
- https://www.namecheap.com/support/knowledgebase/article.aspx/9646/2237/how-to-create-a-cname-record-for-your-domain/
