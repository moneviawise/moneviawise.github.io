# Monevia Wise Blog Workflow

Use the website as the source of truth, then import each published article into Medium.

## Folder structure

- Blog index: `blog.html`
- Site-hosted posts: `blog/posts/<slug>.html`
- Reusable post template: `blog/posts/_template.html`

## New article steps

1. Copy `blog/posts/_template.html` to `blog/posts/<keyword-focused-slug>.html`.
2. Replace the title, description, canonical URL, Open Graph tags, JSON-LD dates, category, date, and article body.
3. Add the article card near the top of `blog.html` under “Latest Monevia Wise articles”.
4. Add the new URL to `sitemap.xml`.
5. Preview locally.
6. After David approves, push/deploy to GitHub Pages.
7. Once live, open Medium → import story → paste the live Monevia Wise URL.
8. In Medium, check formatting, add tags, and publish/import only after review.

## Medium import URL format

Use the live site URL, for example:

`https://moneviawise.com/blog/posts/how-to-start-a-zero-based-budget-in-20-minutes.html`

Medium should treat the website page as the original/canonical source. Keep the site post live before importing.

## Site-first rules

- Monevia Wise owns the full article first.
- Medium is a republishing/distribution channel.
- Every article should link naturally to one relevant planner, freebie, calculator, or Etsy listing.
- Do not replace the full blog archive from Medium RSS; preserve old Medium links while adding new site-hosted posts.
