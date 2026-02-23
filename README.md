# FormFixer (v4 Social Foundation)

## v4 features
- Unique usernames (`profiles.username`) with DB-level uniqueness and client-side validation
- Account privacy mode (`public` / `private`) for friend behavior
- Friend search by username
- Friend relationships + pending request inbox
- In-app notifications:
  - friend request received
  - friend request accepted
  - custom gym invite
- Manual workout calendar + v3 training/nutrition/program features

## Environment variables
Create `.env` in project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
USDA_API_KEY=your-usda-fooddata-central-key
```

## Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Run SQL in Supabase SQL editor:
   - `supabase/schema.sql`
3. Start app:
   ```bash
   npm run dev
   ```

## v4 social routes
- `/social` find friends, manage requests, send invite messages
- `/notifications` in-app notification center
- `/profile` username + privacy mode settings

## Updated folder structure (v4 additions)
```txt
src/
  app/
    social/page.tsx
    notifications/page.tsx
    profile/page.tsx                # updated with username/privacy settings
  components/
    social/
      FriendCard.tsx
      FriendRequestCard.tsx
      NotificationItem.tsx
    layout/Navbar.tsx               # updated with social link + bell indicator
  lib/
    social/
      sessions.ts
      types.ts
    supabaseClient.ts               # updated singleton init (promise cache)
supabase/
  schema.sql                        # updated with v4 social tables + policies
```

## Social flow behavior
- Public profile target:
  - `Add Friend` immediately creates accepted friendship (both directions)
- Private profile target:
  - `Request Friend` creates pending request
  - target user can accept/decline from `/social`
- “Notify Friend” sends a text gym invite to recipient notifications

## VS Code terminal setup (Windows PowerShell)
```powershell
# 1) Clean previous install artifacts
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Remove-Item -Force package-lock.json -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue

# 2) Install JavaScript dependencies
npm install

# 3) Install optional Python helper dependency
py -m pip install -r requirements.txt

# 4) Start app
npm run dev
```

## Manual test steps (v4)
1. Login and open `/profile`.
2. Set a new username and choose privacy mode.
3. Open `/social`, search another username.
4. For a public user, click **Add Friend** and confirm they appear in friends list.
5. For a private user, click **Request Friend**.
6. Login as target user, open `/social`, accept/decline from pending inbox.
7. From friends list, click **Notify Friend**, send message.
8. Open `/notifications` as recipient and mark notification as read.

## Known limitations (post-v4 ideas)
- No chat threads/history yet (invite is single notification message)
- No push/email/SMS notifications (in-app only)
- No blocking/reporting/mute controls yet
- No pagination for very large friend/notification lists yet


## Dev auth behavior note
- In development (`npm run dev`), app boot now clears persisted auth session once per full reload so you start logged out after restart/relaunch.
- This is intentional to prevent stale auth state while debugging login/logout flows.


## Social schema migration note
If you see errors like `column profiles.username does not exist`, your Supabase database is on an older schema.
Run `supabase/schema.sql` again in Supabase SQL Editor (it is idempotent and safe to re-run).
