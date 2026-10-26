# GoshenTrack

GoshenTrack is a static web app hosted from `docs/` and backed by Supabase.

## Deploy with GitHub Pages

1. Push this repository to GitHub.
2. Open the repository's **Settings → Pages** and set the source to **GitHub
   Actions**.
3. The workflow in `.github/workflows/main.yml` deploys the `docs/` folder
   automatically whenever changes are pushed to `main`. You can also start it
   manually from the repository's **Actions** tab.
4. Wait for GitHub Pages to publish the site. Its URL will look like
   `https://<github-username>.github.io/<repository-name>/`.

## Configure Supabase

1. Open the Supabase project used by `docs/app.js`.
2. Run `supabase_setup.sql` in the Supabase SQL Editor to create the app's
   tables, policies, and functions.
3. In **Authentication → URL Configuration**, set **Site URL** to the published
   GitHub Pages URL, including the repository path and trailing slash.
4. Add that same URL under **Redirect URLs**. The app uses the current page URL
   as the email-confirmation redirect.
5. Sign up through the published site. New accounts have the customer role.
   To grant the first administrator access, run this in the SQL Editor after
   signing up, replacing the email:

   ```sql
   update public.profiles
   set role = 'admin'
   where email = 'admin@example.com';
   ```

The Supabase URL and publishable key in `docs/app.js` are intended for browser
use. Never put a Supabase `service_role` key in this repository or frontend.
Keep the database protected by the row-level security policies in
`supabase_setup.sql`.
