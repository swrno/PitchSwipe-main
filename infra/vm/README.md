# Azure VM deploy

PitchSwipe runs on one Ubuntu 22.04 VM: `noor-api.centralindia.cloudapp.azure.com` (2 vCPU, 1 GB RAM plus 3 GB swap).

```
internet :443 (https) -> nginx (pitchswipe.nginx) -> 127.0.0.1:3000 next start (pitchswipe.service, user pitchswipe)
internet :80  -> nginx -> 301 to https (except /.well-known/acme-challenge/)
```

## Layout on the VM

| Path | What |
|---|---|
| `/opt/pitchswipe/releases/<sha>` | one folder per deployed commit (the 3 newest are kept) |
| `/opt/pitchswipe/current` | symlink to the live release |
| `/opt/pitchswipe/DEPLOYED` | short sha of the live release |
| `/etc/pitchswipe.env` | server env (root:pitchswipe 640). Secrets live here, never in the repo |
| `/etc/systemd/system/pitchswipe.service` | the app service (`pitchswipe.service` here) |
| `/etc/nginx/sites-available/pitchswipe` | reverse proxy (`pitchswipe.nginx` here) |
| `/etc/cron.d/pitchswipe` | the two scheduled jobs: assistant watcher every 5 minutes, audio cleanup daily (`pitchswipe-cron` here) |
| `/usr/local/bin/pitchswipe-activate` | installs a release (`pitchswipe-activate` here) |
| `/etc/sudoers.d/pitchswipe-deploy` | what the `deploy` user may run as root (`pitchswipe-deploy.sudoers` here) |
| `/usr/local/bin/pitchswipe-backup` | nightly MongoDB backup, run by `/etc/cron.d/pitchswipe-backup` at 02:15 UTC (`pitchswipe-backup` and `pitchswipe-backup.cron` here; it reads the MongoDB `admin` password from root-only `/root/.pitchswipe-mongo`) |
| `/var/backups/pitchswipe/` | the backups: `pitchswipe-<UTC time>.archive.gz`, root only, newest 7 kept |
| `/usr/local/bin/pitchswipe-backup-export` | writes the newest backup to stdout for the off-site copy (`pitchswipe-backup-export` here; not installed until the owner does the steps under "Off-site backup") |

## How a deploy happens

1. A push to `main` runs CI. When CI passes, `.github/workflows/deploy.yml` builds on GitHub (the VM is too small to build quickly).
2. It uploads the bundle as the `deploy` user, whose key can run only these as root: `sudo /usr/local/bin/pitchswipe-activate <bundle> <sha>`, and (once installed, see "Off-site backup") `sudo /usr/local/bin/pitchswipe-backup-export` with no arguments.
3. The script unpacks into `releases/<sha>`, reuses `node_modules` when the lockfile is unchanged, switches `current`, restarts, and checks (for up to a minute) that `/swipe` answers 200, that `/api/claims/wallet` (which loads the server modules) answers below 500, and that `/api/health` answers 200 with `"ok":true`. If not, it switches back to the previous release and the workflow fails. The workflow then repeats the three checks from outside over https.

`/api/health` returns `{ ok, db, firebaseAdmin, version }`: `db` is `up`, `down` or `off` (no `MONGODB_URI`), `firebaseAdmin` says whether the Admin credentials parse, `version` is the commit sha baked in at build. `ok` is true when MongoDB answers a ping within 2 s and the Firebase Admin credentials parse (a missing or mangled `FIREBASE_ADMIN_*` value makes it 503, so the deploy rolls back). It never returns error text or config values.

Manual run: Actions -> Deploy -> Run workflow (on `main`).

GitHub settings it needs (on `swrno/PitchSwipe-main`): secrets `DEPLOY_SSH_KEY` (a private key whose public half is in `/home/deploy/.ssh/authorized_keys`, comment `github-actions-deploy@pitchswipe-main`) and `DEPLOY_KNOWN_HOSTS` (the VM's host key); variables `DEPLOY_HOST` and `APP_URL`. Browser config is built in, so `NEXT_PUBLIC_FIREBASE_*`, `NEXT_PUBLIC_FLAGSMITH_ENV_KEY` and `NEXT_PUBLIC_SUPPORT_EMAIL` are repo **variables** too (they are public values). Server secrets (Mongo, Firebase Admin, LLM, ...) go in `/etc/pitchswipe.env` on the VM only.

## Uptime check

`.github/workflows/uptime.yml` calls `${APP_URL}/api/health` every 30 minutes (and on demand: Actions -> Uptime -> Run workflow). A run passes only when the answer is HTTP 200 with `"ok":true`, `"db":"up"`, `"firebaseAdmin":true`. It tries 3 times, 10 s apart, before failing, so one slow answer or a deploy restart does not count as an outage. It runs only in `swrno/PitchSwipe-main` (not in forks), needs only the `APP_URL` variable, and has read-only permissions.

Who hears about a failure: GitHub emails a failed **scheduled** run to one person, the user who created the workflow file; after that, the user who last changed its `cron:` line, or who last re-enabled the workflow. It does not email everyone who watches the repo. That person needs Actions notifications switched on (GitHub -> Settings -> Notifications -> Actions; on by default). To move the alerts to someone else, have them make a commit that changes the `cron:` line, or disable and re-enable the workflow themselves.

GitHub switches scheduled workflows **off** in a public repo after 60 days without repository activity (pushes, merged pull requests, ...). The Actions tab then shows the workflow as disabled; re-enable it with Actions -> Uptime -> Enable workflow (which also makes you the person who gets the failure emails).

GitHub starts scheduled runs on a best-effort basis: a run can start late, and under heavy load one can be skipped. Treat this as a coarse alarm, not a minute-by-minute monitor.

## Off-site backup

The nightly backup (02:15 UTC, `/var/backups/pitchswipe`) lives on the VM's own disk. `.github/workflows/offsite-backup.yml` copies the newest one off the VM every day at 03:30 UTC (and on demand: Actions -> Off-site backup -> Run workflow):

1. It runs `ssh deploy@<DEPLOY_HOST> sudo /usr/local/bin/pitchswipe-backup-export`, which writes the newest archive to stdout. The export refuses (and the run fails) when there is no backup, when the newest is older than 36 hours, or when it is not a complete gzip file.
2. The stream goes straight into `gpg --symmetric --cipher-algo AES256` with the `BACKUP_PASSPHRASE` secret, so the unencrypted backup never lands on the runner's disk.
3. It checks the encrypted file is not empty and decrypts it in memory to check it holds a complete gzip archive, then uploads it as the artifact `pitchswipe-backup-<UTC date and time>`, kept for 30 days.

Without `BACKUP_PASSPHRASE` the run fails before connecting and uploads nothing; it never uploads an unencrypted file. It runs only in `swrno/PitchSwipe-main`.

**The repo is public: anyone signed in to GitHub can download these artifacts.** That is why they are encrypted, and why the passphrase must stay secret. **If the passphrase is lost, every copy is useless**: GitHub never shows a secret again, so keep the passphrase in a password manager and hand it over with the server env. When you change it, keep the old one for 30 days, because older artifacts still need it.

A failed scheduled run is emailed to one person, the same way as the uptime check (see "Uptime check"), and the same 60-day rule applies: in a public repo GitHub switches the schedule off after 60 days without repository activity. The `deploy` key can now read the backup. It could already ship app code that runs as the `pitchswipe` user and reads the whole `pitchswipe` database through `MONGODB_URI`, and the nightly dump is limited to that database (`mongodump --db pitchswipe` in `pitchswipe-backup`), so the export exposes nothing new. Keep it that way: if the dump is ever widened to the whole server, the archive would also hold the `admin` database with the password hashes of every MongoDB user, which the key cannot read today.

Until the steps below are done and the secret is set, the workflow still runs every day once it is on `main` and fails (no `BACKUP_PASSPHRASE`, or the export script or sudoers line missing), so the person it emails gets a failure email each day. Install first, or expect those emails. GitHub only runs a schedule, and only shows the "Run workflow" button, for workflow files on the default branch.

### One-time install on the VM (owner, after review)

Nothing here is installed yet. A deploy ships only the built app, so copy the two files over by hand:

```
# on your machine, in a checkout
scp infra/vm/pitchswipe-backup-export infra/vm/pitchswipe-deploy.sudoers <your-user>@noor-api.centralindia.cloudapp.azure.com:~/

# on the VM
sudo grep -n mongodump /usr/local/bin/pitchswipe-backup   # should show --db pitchswipe; see the note above if not
sudo install -o root -g root -m 755 ~/pitchswipe-backup-export /usr/local/bin/pitchswipe-backup-export
sudo cat /etc/sudoers.d/pitchswipe-deploy          # today: the single pitchswipe-activate line
sudo diff /etc/sudoers.d/pitchswipe-deploy ~/pitchswipe-deploy.sudoers   # adds comments and one export line only
sudo cp -p /etc/sudoers.d/pitchswipe-deploy /root/pitchswipe-deploy.bak
sudo install -o root -g root -m 440 ~/pitchswipe-deploy.sudoers /root/pitchswipe-deploy.new
sudo visudo -cf /root/pitchswipe-deploy.new        # must say "parsed OK"; stop here if it does not
sudo mv /root/pitchswipe-deploy.new /etc/sudoers.d/pitchswipe-deploy
sudo visudo -c                                     # the whole configuration still parses
sudo -l -U deploy                                  # lists pitchswipe-activate and pitchswipe-backup-export ""
rm ~/pitchswipe-backup-export ~/pitchswipe-deploy.sudoers
```

Keep the file name `pitchswipe-deploy` with no dot: sudo skips files in `/etc/sudoers.d` whose names contain a `.`. The `""` after the export path means "no arguments allowed". Check it as the `deploy` user:

```
sudo -u deploy sudo -n /usr/local/bin/pitchswipe-backup-export | wc -c        # the newest backup's size in bytes
sudo -u deploy sudo -n /usr/local/bin/pitchswipe-backup-export anything      # refused by sudo
```

Then the GitHub side:

1. Make a passphrase on your own machine, one line, for example `openssl rand -base64 32`, and store it in your password manager.
2. Add it as a **repository** secret named `BACKUP_PASSPHRASE` (Settings -> Secrets and variables -> Actions -> New repository secret, or `gh secret set BACKUP_PASSPHRASE -R swrno/PitchSwipe-main` and paste it when asked). It sits next to `DEPLOY_SSH_KEY` and `DEPLOY_KNOWN_HOSTS`, which this workflow also uses, with the `DEPLOY_HOST` variable.
3. Actions -> Off-site backup -> Run workflow, then check the run's Artifacts list shows `pitchswipe-backup-...`.

### Restore from an off-site copy

1. Download it: Actions -> Off-site backup -> pick a run -> Artifacts -> `pitchswipe-backup-<date>` (GitHub serves it as a zip), or `gh run download <run-id> -R swrno/PitchSwipe-main -n pitchswipe-backup-<date>` (unzips for you).
2. Unzip it if needed; inside is `pitchswipe-backup-<date>.archive.gz.gpg`.
3. Decrypt it (gpg asks for the passphrase):

   ```
   gpg --output pitchswipe-restore.archive.gz --decrypt pitchswipe-backup-<date>.archive.gz.gpg
   ```

   The result is the whole database in plain form, users' details included: keep it on an encrypted disk and delete it when you are done.
4. Copy it to the VM (a rebuilt VM needs MongoDB and the `admin` user set up first) and put it somewhere only root can read:

   ```
   scp pitchswipe-restore.archive.gz <your-user>@noor-api.centralindia.cloudapp.azure.com:~/
   sudo install -o root -g root -m 600 ~/pitchswipe-restore.archive.gz /root/pitchswipe-restore.archive.gz && rm ~/pitchswipe-restore.archive.gz
   ```

5. Run the `mongorestore` steps under "Backups" in [docs/HANDOVER.md](../../docs/HANDOVER.md) with `--archive=/root/pitchswipe-restore.archive.gz`: first into the scratch database, then the real restore. Delete `/root/pitchswipe-restore.archive.gz` afterwards.

## Updating the nginx config or the activate script

A deploy ships only the built app. `pitchswipe.nginx` and `pitchswipe-activate` are copied to the VM by hand when they change:

```
sudo cp pitchswipe.nginx /etc/nginx/sites-available/pitchswipe
sudo nginx -t && sudo systemctl reload nginx
sudo install -m 755 pitchswipe-activate /usr/local/bin/pitchswipe-activate
```

The nginx file overwrites `X-Forwarded-For` with the socket address (the app's rate limiter reads `X-Real-IP`, then the last `X-Forwarded-For` hop), rate-limits `/api/` to 20 requests/s per IP (burst 40, then 429), and gzips text responses. Security headers (CSP, `X-Frame-Options`, ...) come from the app (`next.config.ts`); nginx adds only HSTS.

## Changing server env

```
sudo nano /etc/pitchswipe.env
sudo systemctl restart pitchswipe
```

Add the keys to `/etc/pitchswipe.env`. Releases ship only the built app (no `scripts/`), so check the same values with `npm run doctor` in a local checkout first.

## Real mode on the VM

### MongoDB (local, on the VM)

MongoDB runs on the VM itself, listening on `127.0.0.1:27017` only (not reachable from the internet), with authorization on and the WiredTiger cache capped at 256 MB to fit the 1 GB box. The app connects as user `pitchswipe`, which has `readWrite` on database `pitchswipe` and nothing else.

- The credentials are in `/root/.pitchswipe-mongo` (root only). Do not copy them anywhere else.
- `MONGODB_URI` is already in `/etc/pitchswipe.env`.
- `systemctl status mongod` and `journalctl -u mongod` for the database service.

### Indexes

Releases ship no `scripts/`, so indexes are created from a local checkout through an SSH tunnel:

```
# terminal 1: forward a local port to the VM's MongoDB
ssh -N -L 27018:127.0.0.1:27017 <your-user>@noor-api.centralindia.cloudapp.azure.com

# terminal 2: in the repo, the URI from /etc/pitchswipe.env with the host:port changed to 127.0.0.1:27018
MONGODB_URI='mongodb://pitchswipe:...@127.0.0.1:27018/pitchswipe?...' npm run db:sync-indexes -- --yes
```

`--yes` is required: the script refuses to run without it. It confirms that the script creates the indexes the schemas declare and also DROPS any index on those collections that the schema no longer declares. Run it again whenever a model's indexes change. Close the tunnel afterwards.

### Firebase

- In the Firebase console: Authentication -> Sign-in method -> enable Email/Password, and Authentication -> Settings -> Authorized domains -> add `noor-api.centralindia.cloudapp.azure.com`.
- Server values go in `/etc/pitchswipe.env`: `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, `FIREBASE_ADMIN_PRIVATE_KEY` (in double quotes, literal `\n` for newlines).
- Browser values are GitHub repo **variables** (baked in at build, so a new deploy is needed after changing them): `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`. The admin project id must match `NEXT_PUBLIC_FIREBASE_PROJECT_ID`.

### Switch over

1. In `/etc/pitchswipe.env`: check `MONGODB_URI`, the three `FIREBASE_ADMIN_*` values, and `SWIPE_SIGNING_SECRET` (a new random value, 16+ characters, e.g. `openssl rand -hex 32`). `NEXT_PUBLIC_APP_URL` is baked in at build from the `APP_URL` repo variable.
2. `sudo systemctl restart pitchswipe`
3. `curl -s http://127.0.0.1:3000/api/health` should show `"ok":true,"db":"up","firebaseAdmin":true`.
4. Run `npm run doctor` locally with the same values: it says `Real mode ... ready` only when MongoDB and Firebase Admin answer, the web Firebase config is set, `SWIPE_SIGNING_SECRET` is 16+ characters and `NEXT_PUBLIC_APP_URL` is set.


## Rollback by hand

```
ls -dt /opt/pitchswipe/releases/*/
sudo ln -sfn /opt/pitchswipe/releases/<sha> /opt/pitchswipe/current && sudo systemctl restart pitchswipe
```

## HTTPS

Let's Encrypt certificate for `noor-api.centralindia.cloudapp.azure.com`, issued with `certbot certonly --webroot -w /var/www/letsencrypt` (no email registered). certbot's timer renews it; `/etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh` reloads nginx after a renewal. `sudo certbot renew --dry-run` checks the renewal path.

## Build where the bundle runs

Build on Linux (the workflow does). Turbopack puts symlinks such as `.next/node_modules/firebase-admin-<hash>` into the build; a bundle built on Windows loses them, pages still render but every API route fails. The health check above catches that and rolls back.

## Logs

`journalctl -u pitchswipe -f`
