# Handover

Start here if you are taking over PitchSwipe. This page covers getting access, logging in to the server, where the
secrets live, and what is still open. Day-to-day server operations are in [infra/vm/README.md](../infra/vm/README.md);
how the code fits together is in [ARCHITECTURE.md](ARCHITECTURE.md).

Nothing secret is written here. Keys, passwords and the server env are handed over privately (see
[Secrets](#secrets)).

## What is running

| Thing | Where |
|---|---|
| Live site | https://noor-api.centralindia.cloudapp.azure.com (`/api/health` shows the deployed commit) |
| Server | One Azure VM, Ubuntu 22.04, 2 vCPU, 1 GB RAM + 3 GB swap, Central India. Public IP `20.204.106.112` |
| App | `next start` on `127.0.0.1:3000` behind nginx (HTTPS from Let's Encrypt), systemd service `pitchswipe` |
| Database | MongoDB 7 on the same VM, localhost only, auth on, nightly backups |
| Accounts | Firebase Authentication, project `pitchswipe-cadfd` |
| Experiments | Flagsmith Cloud, project **PitchSwipe** |
| Code and deploys | GitHub `swrno/PitchSwipe-main` (public, the final submission repo); every push to `main` that passes CI deploys itself. The earlier private repo `swrno/PitchSwipe` keeps the history up to 26 Nov 2026; its deploy workflow is disabled so it can no longer ship to the server |
| Apps | Android APK and iOS builds are published on the [releases page](https://github.com/swrno/PitchSwipe-main/releases). The iOS `.ipa` is unsigned and will not install on an iPhone until it is signed |

## Access you need

Ask the current owner for each of these. Nothing here can be done from the repo alone.

1. **GitHub:** collaborator on `swrno/PitchSwipe-main` (the owner adds you under Settings -> Collaborators). It is a
   personal-account repo, so collaborators get read and write but cannot be made admins. To manage Actions secrets,
   variables and repo settings yourself, have the owner transfer the repo to you or to an organization where you
   are an owner.
   After a transfer, update the repo name in the `github.repository == 'swrno/PitchSwipe-main'` guard in
   `.github/workflows/deploy.yml`, or deploys silently stop; the Actions variables and secrets move with the repo.
2. **The server:** an SSH key on the VM. See [Logging in to the server](#logging-in-to-the-server).
3. **Firebase:** member of project `pitchswipe-cadfd` (Firebase console -> Project settings -> Users and
   permissions -> Add member, role Owner or Editor).
4. **Flagsmith:** member of the organisation that holds project PitchSwipe (the organisation's Users and
   Permissions tab -> Members -> Invite members).
5. **Azure:** only needed to resize, restart or rebuild the VM, change its network rules, or add an SSH key when
   nobody can log in. The VM is in the Azure subscription of whoever created it; ask them for access to the VM's
   resource group (Access control (IAM) -> Add role assignment, for example Virtual Machine Contributor).
6. **The secrets bundle:** see [Secrets](#secrets).

## Logging in to the server

| | |
|---|---|
| Host | `noor-api.centralindia.cloudapp.azure.com` (IP `20.204.106.112`), port 22 |
| User | `azureuser` (has sudo, no password needed) |
| Login | SSH keys only. Password login is off, and root cannot log in with a password |

The VM also has a `deploy` user, used only by GitHub Actions. Its keys are in `/home/deploy/.ssh/authorized_keys`:
`github-actions-deploy@pitchswipe-main` is the one this repo's `DEPLOY_SSH_KEY` secret holds; the older
`github-actions-deploy@pitchswipe` belonged to the retired private repo and can be deleted. Its only root right is
`sudo /usr/local/bin/pitchswipe-activate`. Do not use it, and do not remove the `-main` key, or deploys stop.

### 1. Get your key onto the server

Use your own key rather than sharing someone else's.

Make a key on your machine (any OS with OpenSSH, including Windows PowerShell):

```bash
ssh-keygen -t ed25519 -C "your-name pitchswipe"
```

Send the **public** key (`~/.ssh/id_ed25519.pub`, one line starting `ssh-ed25519`) to someone who can already log
in. They add it on the server:

```bash
echo 'ssh-ed25519 AAAA... your-name pitchswipe' >> /home/azureuser/.ssh/authorized_keys
```

If nobody can log in any more, someone with Azure access can add a key in the Azure portal: the VM -> Help ->
Reset password -> Mode "Reset SSH public key", username `azureuser`, paste the public key, Update. Afterwards log in
and check that `sudo sshd -T | grep passwordauthentication` still says `no` (the reset tool can turn password login
back on); if it says `yes`, set `PasswordAuthentication no` in `/etc/ssh/sshd_config` and run
`sudo systemctl reload ssh`.

If you were given the original key file instead (a `.pem` file), save it as `~/.ssh/pitch-swipe-host.pem` and
make it private to you, or SSH refuses to use it:

```bash
# macOS / Linux
chmod 600 ~/.ssh/pitch-swipe-host.pem
```

```powershell
# Windows PowerShell
icacls "$HOME\.ssh\pitch-swipe-host.pem" /inheritance:r
icacls "$HOME\.ssh\pitch-swipe-host.pem" /grant:r "$($env:USERNAME):(R)"
```

### 2. Connect

```bash
ssh azureuser@noor-api.centralindia.cloudapp.azure.com
# or, with the .pem file:
ssh -i ~/.ssh/pitch-swipe-host.pem azureuser@noor-api.centralindia.cloudapp.azure.com
```

The first time, SSH shows the server's fingerprint. Continue only if it matches one of these:

```
ED25519  SHA256:B/OVxBNZnKtakGS4v+RvUkVcu2wMF4MDB71/6Jq6JRg
ECDSA    SHA256:tNfmndOEnB2qsJe5l6c2g1vunu3bvAWGuwTBj8HxaCE
RSA      SHA256:vdF+Q6EwN4wnhJSAAFZcxXtBmr9JHGgbMC9eW9e6+pw
```

To type `ssh pitchswipe` instead, add this to `~/.ssh/config` (drop the `IdentityFile` line if you use your own
default key):

```
Host pitchswipe
  HostName noor-api.centralindia.cloudapp.azure.com
  User azureuser
  IdentityFile ~/.ssh/pitch-swipe-host.pem
```

### 3. Once you are in

| To | Run |
|---|---|
| See if everything is up | `systemctl is-active pitchswipe nginx mongod cron` |
| Check the app | `curl -s http://127.0.0.1:3000/api/health` (expect `"ok":true,"db":"up","firebaseAdmin":true,"demo":false`; `version` is the live commit) |
| Follow the app log | `journalctl -u pitchswipe -f` |
| Restart the app | `sudo systemctl restart pitchswipe` |
| See which commit is live | `sudo cat /opt/pitchswipe/DEPLOYED` |
| List releases, newest first | `sudo ls -t /opt/pitchswipe/releases` |
| Edit the server env | `sudo nano /etc/pitchswipe.env`, then `sudo systemctl restart pitchswipe` |
| Roll back by hand | list releases as above, then "Rollback by hand" in [infra/vm/README.md](../infra/vm/README.md) |

`/opt/pitchswipe` is readable only by the `pitchswipe` user, so anything inside it needs `sudo`.

### Database

MongoDB listens on `127.0.0.1:27017` only. The app connects as user `pitchswipe` (password in `MONGODB_URI`); the
`admin` user is for maintenance and the nightly backup. Both passwords are in `/root/.pitchswipe-mongo` (root only,
as `MONGO_ADMIN_PASSWORD=...` and `MONGO_APP_PASSWORD=...`; keep them there). To open a shell on the server:

```bash
sudo grep MONGO_ADMIN_PASSWORD /root/.pitchswipe-mongo     # prints MONGO_ADMIN_PASSWORD=<password>
mongosh --host 127.0.0.1 -u admin --authenticationDatabase admin pitchswipe   # paste only the part after =
```

To reach the database from your own machine (for example `npm run db:sync-indexes`), open a tunnel; the steps are
under "Indexes" in [infra/vm/README.md](../infra/vm/README.md).

### Uptime check

A GitHub workflow (`.github/workflows/uptime.yml`) checks `/api/health` every 30 minutes and fails unless the site is
in real mode with the database up and Firebase Admin working. A failed scheduled run is emailed to one person: whoever
created the workflow file or last changed its `cron:` line (or last re-enabled it), not to everyone watching the repo.
GitHub switches scheduled workflows off in a public repo after 60 days without repository activity; re-enable it on
the Actions tab. Details under "Uptime check" in [infra/vm/README.md](../infra/vm/README.md).

### Backups

`/usr/local/bin/pitchswipe-backup` runs every night at 02:15 UTC (`/etc/cron.d/pitchswipe-backup`) and logs under the
tag `pitchswipe-backup` (`journalctl -t pitchswipe-backup`). It writes
`/var/backups/pitchswipe/pitchswipe-<UTC time>.archive.gz` and keeps the newest 7. List them with
`sudo ls -lt /var/backups/pitchswipe`. The script and its cron file are not in the repo yet.

**Off-site copy (ready, not yet switched on).** `.github/workflows/offsite-backup.yml` copies the newest backup off
the VM every day at 03:30 UTC, encrypted with gpg (AES256) using the `BACKUP_PASSPHRASE` secret, and keeps it as a
workflow artifact for 30 days. It works only after the owner does the one-time steps under "Off-site backup" in
[infra/vm/README.md](../infra/vm/README.md): install `/usr/local/bin/pitchswipe-backup-export`, add one line to
`/etc/sudoers.d/pitchswipe-deploy` (checked with `visudo -cf` first), and set the `BACKUP_PASSPHRASE` repository
secret. Until then the backups are on the VM only: if the VM's disk is lost, so are they.

- The repo is public, so **anyone signed in to GitHub can download the artifacts**; that is why they are encrypted.
- **Losing the passphrase makes every copy useless.** GitHub never shows a secret again: keep the passphrase in a
  password manager and hand it over with the server env.
- Without the secret the workflow fails and uploads nothing; it never uploads an unencrypted copy.

To restore from an off-site copy: download the artifact (Actions -> Off-site backup -> a run -> Artifacts, a zip),
unzip it, run `gpg --output pitchswipe-restore.archive.gz --decrypt pitchswipe-backup-<date>.archive.gz.gpg` and
enter the passphrase, copy the result to the VM as `/root/pitchswipe-restore.archive.gz` (root only, mode 600), then
run the commands below with `--archive=/root/pitchswipe-restore.archive.gz`. The full steps are under "Restore from an
off-site copy" in [infra/vm/README.md](../infra/vm/README.md).

**A restore has never been rehearsed.** Before you need one, check that the `admin` user is allowed to restore (in
mongosh, `db.getSiblingDB("admin").getUser("admin")` should show `root`, `restore` or `readWriteAnyDatabase`), and try
it into a scratch database first, which leaves the live data alone:

```bash
sudo bash -c '. /root/.pitchswipe-mongo; mongorestore --host 127.0.0.1 --username admin \
  --password "$MONGO_ADMIN_PASSWORD" --authenticationDatabase admin --gzip \
  --archive=/var/backups/pitchswipe/<file>.archive.gz \
  --nsInclude "pitchswipe.*" --nsFrom "pitchswipe.*" --nsTo "pitchswipe_restoretest.*"'
```

The real restore **replaces** the data in every collection the backup contains. Stop the app first:

```bash
sudo systemctl stop pitchswipe
sudo bash -c '. /root/.pitchswipe-mongo; mongorestore --host 127.0.0.1 --username admin \
  --password "$MONGO_ADMIN_PASSWORD" --authenticationDatabase admin --gzip \
  --archive=/var/backups/pitchswipe/<file>.archive.gz --nsInclude "pitchswipe.*" --drop'
sudo systemctl start pitchswipe
```

## Secrets

All server secrets are in one file on the server, `/etc/pitchswipe.env` (owner root, group pitchswipe, mode 640).
The current owner keeps an exact copy outside the repo and hands it over privately. Never commit it, paste it into
chat or put it in a shared drive.

It holds these variables:

| Group | Variables |
|---|---|
| App | `NODE_ENV`, `PORT`, `HOSTNAME`, `APP_URL`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SITE_URL`, `NEXT_TELEMETRY_DISABLED` |
| App secrets | `SWIPE_SIGNING_SECRET`, `CRON_SECRET` |
| Database | `MONGODB_URI` |
| Firebase (browser, public) | `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID` |
| Firebase Admin (secret) | `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, `FIREBASE_ADMIN_PRIVATE_KEY` |
| Flagsmith | `FLAGSMITH_ADMIN_API_KEY` (secret), `FLAGSMITH_ORG_ID`, `FLAGSMITH_PROJECT_ID`, `FLAGSMITH_ENVIRONMENT_ID`, `NEXT_PUBLIC_FLAGSMITH_ENV_KEY` (public) |

Every variable is explained in [.env.example](../.env.example). To change a server secret: edit
`/etc/pitchswipe.env` on the server, run `sudo systemctl restart pitchswipe`, check `/api/health`, and update your
private copy.

**AI and what is not set yet:**

- **AI key.** Set: the app runs on a free Groq key (`GROQ_API_KEY` in `/etc/pitchswipe.env`; main model
  `openai/gpt-oss-120b`, fallback `openai/gpt-oss-20b`, see `.env.example`). It powers AI drafting, the Ask assistant, insight
  wording, comment themes and voice-note translation. Without it, AI drafting says it needs a key, Ask uses a scripted
  planner over the real data, insights use code templates, and swipers type the English for voice notes themselves.
  `npm run doctor` also warns if Groq retires one of the two models.
- `RESEND_API_KEY` with `RESEND_FROM_EMAIL` (sender of the "Test decided" alert) and `EXPORT_FROM_EMAIL` (sender of
  emailed exports), server env. Without the key nothing is emailed. The senders need an address on a domain
  verified in Resend.
- `NEXT_PUBLIC_SUPPORT_EMAIL`. This one is built into the app, so it is a GitHub repo **variable**, not a server
  value (see below). Until it is set, the contact and legal pages say the address will be published before launch.

**GitHub settings.** Values built into the app are GitHub repo **variables** (Settings -> Secrets and variables ->
Actions -> Variables): `APP_URL` (which becomes `NEXT_PUBLIC_APP_URL` and `NEXT_PUBLIC_SITE_URL` at build), the four
`NEXT_PUBLIC_FIREBASE_*`, `NEXT_PUBLIC_FLAGSMITH_ENV_KEY`, and `NEXT_PUBLIC_SUPPORT_EMAIL` once created. `DEPLOY_HOST`
(the server name) is a variable too. After changing one, redeploy: Actions -> Deploy -> Run workflow, or push to
`main`. The deploy also uses two Actions **secrets**: `DEPLOY_SSH_KEY` (the `deploy` user's private key) and
`DEPLOY_KNOWN_HOSTS` (the server's host key). The off-site backup uses those two and a third secret,
`BACKUP_PASSPHRASE` (see [Backups](#backups)); hand that passphrase over privately with the server env.

### Rotate after the handover

Once you have access, replace the secrets the previous owner held. One at a time, checking `/api/health` after each:

- **SSH:** add your own key and check you can log in with it. Then list the keys with
  `ssh-keygen -lf /home/azureuser/.ssh/authorized_keys` and remove the ones you do not recognise. Today there are
  two, both commented `generated-by-azure`: the original `.pem` is
  `SHA256:A5z29rbQdICb9+mG5GoDPAnlmCmhiZE8/6oEk8XNzt0`; ask the previous owner what
  `SHA256:ts+zKAzC3x5GFLnf7/S6i1fkQEDOJnecx7a04z6kfPw` is. Keep at least one key that works. Leave
  `/home/deploy/.ssh/authorized_keys` alone.
- **`CRON_SECRET`:** a new value from `openssl rand -hex 32`. Nothing else needs to change; the cron jobs read it
  from the same file.
- **`SWIPE_SIGNING_SECRET`:** a new value from `openssl rand -hex 32`, at a quiet time. It signs the token behind
  each served card, so changing it invalidates every token issued before: a swiper mid-card loses that one answer
  (an error, then the next card loads), and anyone who answered in the previous 24 hours can no longer claim the
  reward, comment or leave a voice note on those answers ("That answer could not be verified").
- **Firebase Admin:** Google Cloud console -> IAM & Admin -> Service accounts -> click the `firebase-adminsdk-...`
  account -> Keys -> Add key -> Create new key -> JSON. Put its `private_key` in `FIREBASE_ADMIN_PRIVATE_KEY`
  (inside double quotes, newlines as literal `\n`; the project id and client email stay the same), restart, check
  that `/api/health` shows `"firebaseAdmin":true`, then delete the old key on the same Keys tab.
- **Flagsmith:** Organisation Settings -> API Access. Create a new key, swap `FLAGSMITH_ADMIN_API_KEY`, restart, then
  delete the old `pitchswipe-server` key.
- **MongoDB passwords (optional):** the `pitchswipe` user's password is in both `/root/.pitchswipe-mongo`
  (`MONGO_APP_PASSWORD`) and `MONGODB_URI`; change both and restart the app. The `admin` password is only in
  `/root/.pitchswipe-mongo` (`MONGO_ADMIN_PASSWORD`), but the nightly backup uses it, so update that file at the same
  moment and check the next backup with `journalctl -t pitchswipe-backup`.
- **`BACKUP_PASSPHRASE` (once the off-site copy is on):** set a new one (`openssl rand -base64 32`) and store it in
  your password manager. Copies made before the change still need the old passphrase, so keep it until they expire
  (30 days).

## Flagsmith setup

- Project **PitchSwipe** (id `55597`) has two environments: **Development** and **Production**. The server uses
  Production.
- Experiments are enabled, and each environment has Flagsmith's own warehouse connected (it stores the experiment
  events).
- **v2 feature versioning must stay off** in both environments. PitchSwipe ships a winner by writing the flag
  directly, which Flagsmith refuses under v2. It was switched off with `POST
  /api/v1/environments/<env key>/disable-v2-versioning/`.
- To check the whole flow against Flagsmith, run `scripts/flagsmith-lifecycle.mjs` with the **Development**
  environment's key (instructions at the top of the script). Never point it at Production. The last run passed
  11 of 11 steps.

## Local development

See "Build from source" in the [README](../README.md). In short: Node 22+, `npm install`, copy `.env.example` to
`.env.local` (with `PITCHSWIPE_DEMO=1` the app runs on labelled demo data and needs no keys), `npm run dev`.
Checks: `npm run typecheck`, `npm run lint`, `npm test`.

### Quality check and starter decks

- **The 30-card quality check is off** (`NEXT_PUBLIC_QUALITY_CHECK`, unset = off; see `src/lib/quality/switch.ts`).
  New swipers go from verify straight to `/swipe`, and every signed-in swipe counts, so feed answers go through
  Flagsmith instead of the local split. To bring it back, set the GitHub repo **variable**
  `NEXT_PUBLIC_QUALITY_CHECK=on` (it is built into the app) and redeploy.
- **Starter feed decks:** `npm run seed:feed` checks 100 decks (25 ideas x headline, description, price, launch
  reward, in `scripts/seed/feed-ideas.mjs`) and writes nothing. `npm run seed:feed -- --yes` writes and publishes them
  under the house account "PitchSwipe Ideas Lab" (its name shows on each card), one Flagsmith experiment per deck. Run
  it on the server (MongoDB is localhost only) with the server env loaded, once the owner has approved the ideas.
  Running it again adds only what is missing.

The MongoDB store test is opt-in. It refuses any database whose name does not start with `pitchswipe_it_` and drops
that database at the end. It does not check the host, so only ever point it at a local server:
`MONGODB_TEST_URI=mongodb://127.0.0.1:27017/pitchswipe_it_local npm run test:mongo`.

## Still open

- **Real traffic:** two test decks are live in production (flags `deck_pitch-swipe-headline-af2f` and
  `deck_pitch-swipe-headline-5c45`, checked 26 Nov 2026), but no deck has reached a real winner call yet. Until the
  quality check was switched off, no swiper was counting, so feed answers used the local split and never reached
  Flagsmith.
- **Keys:** Claude, Resend with a verified sending domain, and the support email (see [Secrets](#secrets)).
- **Voice notes in the apps:** built for Android on `@capacitor-community/speech-recognition` 7.0.1 (the phone's
  own speech service; no audio kept). Not yet tried on a real phone: run the device checklist in
  [mobile.md](mobile.md#voice-notes-in-the-apps), then ship a new app build (installed builds without the plugin keep
  saying "Voice notes are not in this version of the app"). iOS: the plugin has no Swift Package Manager support, so
  it is not linked into the iOS project; it needs upstream SPM support (issue "support capacitor 8" is open) or a small
  in-app Swift plugin built on a Mac. The web code is ready for either.
- **Store releases:** Android release signing and a Play Console account. PR #29 (open, never run) adds a manual
  Android build-and-release workflow that signs builds once four `ANDROID_KEY*` secrets exist. iOS needs an Apple
  Developer account and signing. The app id `app.pitchswipe.mobile` is a placeholder.
- **Operations:** backups are on the VM only until the off-site copy is switched on (see [Backups](#backups)), and a
  restore has never been rehearsed; uptime
  alerting is a GitHub workflow that emails one person (see [Uptime check](#uptime-check)), not a paging service;
  1 GB RAM is tight; the site runs on the Azure DNS name, not a custom domain.
- **Legal and product:** the terms and privacy notice are unreviewed drafts; no licence chosen; swiper earnings are
  demo earnings; about 14 quality thresholds in `src/lib/quality/rules.ts` and nearby still need the owner's
  confirmation.
