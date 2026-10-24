RENTNEST - COMPLETE SITE PACKAGE (everything built so far, in one folder)

HOW TO PUT IT ON GITHUB (website, no tokens needed)
1. Unzip this folder.
2. Open https://github.com/kiranpatel001200-code/rentals
3. Add file > Upload files. Drag in ALL files and the "images" folder. Same names replace the old files.
4. Choose "Create a new branch" > Propose changes > Create pull request > Merge (or commit to main).
5. Wait 1-2 minutes, then press Ctrl+Shift+R on the site.

ONE-TIME SETTINGS (only you can do these)
- site-config.js        : put your support email and your state.
- pass.js               : put your PayPal Client ID in clientId (public). Price text must match the secrets below.
- Supabase > Edge Functions > Secrets:
    PAYPAL_CLIENT_ID, PAYPAL_SECRET, PAYPAL_ENV (sandbox first, then live)   [Contact Pass payments]
    PASS_PRICE (default 4.99), PASS_DAYS (default 365)
    RESEND_API_KEY, RESEND_FROM                                              [new-message emails]
- Supabase > Authentication > URL Configuration: Site URL + Redirect URLs for the GitHub Pages address.
- First admin (run once in the Supabase SQL Editor):
    update public.profiles set role = 'admin' where email = 'YOUR@EMAIL';
- Google Search Console: submit sitemap.xml.

RENTER CONTACT PASS RULES (enforced in the database)
- Email must be verified before paying.
- Renter and landlord accounts can buy the separate Renter Contact Pass add-on; landlord premium alone does not unlock other landlords' contact details.
- One active pass at a time. The pass expires after the configured number of days.
- Each Renter Contact Pass unlocks contact details for up to 3 distinct approved listings. Reopening the same listing is included.
- When the 3 contacts are used, the listing page points renters to Contact us for a larger premium offer.
- The allowance resets when a new pass starts after the current pass expires.
- The expiry date and the used/3 count are shown in My account and listing details.
- Configure PayPal before collecting live payments; prices/duration must match the Supabase PASS_PRICE and PASS_DAYS secrets.

MESSAGES (enforced in the database)
- Anyone logged in sees "Messages" in the header with an unread count. The count is stored in the database, so it survives refreshes.
- Receivers see who wrote (name and verified email badge) but the text, phone and email stay locked until they have an active Contact Pass.
- A message turns to "read" only when its receiver opens it with an active pass. Sending a message is free.

TESTING PREMIUM WITHOUT PAYPAL
- Supabase > Table Editor > premium_grants > Insert row: email = the user's email, days = 365 (0 = no end date).
  The user becomes premium straight away (same as a paid Contact Pass). It also works if the email signs up later.
- To test "expired": set expires_at to a past date. The pay button should appear again.
- Delete the row and the pass is removed.
- Before you go live, keep this table EMPTY (every row gives a free pass). Real payments use PayPal.

BLOCK LIST (spam users)
- Run block-list-migration.sql ONCE in the Supabase SQL Editor (it is safe to run again).
- Then block someone: website > Admin > Users > "Block user", or Table Editor > blocked_users > Insert row (email + reason).
- A blocked person can log in but sees only a 404 page, and the database refuses everything they try
  (listings, messages, reviews, reports, uploads, payments). Their listings disappear for everyone. Delete the row to unblock.
- Upload 404.html with the other files (GitHub Pages shows it for pages that do not exist).
