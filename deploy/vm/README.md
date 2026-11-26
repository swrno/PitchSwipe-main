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
| `/etc/cron.d/pitchswipe` | the two scheduled jobs from `vercel.json` (`pitchswipe-cron` here) |
| `/usr/local/bin/pitchswipe-activate` | installs a release (`pitchswipe-activate` here) |

## How a deploy happens

1. A push to `main` runs CI. When CI passes, `.github/workflows/deploy.yml` builds on GitHub (the VM is too small to build quickly).
2. It uploads the bundle as the `deploy` user, whose key can do one thing as root: `sudo /usr/local/bin/pitchswipe-activate <bundle> <sha>`.
3. The script unpacks into `releases/<sha>`, reuses `node_modules` when the lockfile is unchanged, switches `current`, restarts, and checks (for up to a minute) that `/swipe` answers 200, that `/api/claims/wallet` (which loads the server modules) answers below 500, and that `/api/health` answers 200 with `"ok":true`. If not, it switches back to the previous release and the workflow fails. The workflow then repeats the three checks from outside over https.

`/api/health` returns `{ ok, db, firebaseAdmin, demo, version }`: `db` is `up`, `down` or `off` (demo mode or no `MONGODB_URI`), `firebaseAdmin` says whether the Admin credentials parse, `version` is the commit sha baked in at build. `ok` is true in demo mode, or in real mode when MongoDB answers a ping within 2 s and the Firebase Admin credentials parse (a missing or mangled `FIREBASE_ADMIN_*` value makes it 503, so the deploy rolls back). It never returns error text or config values.

Manual run: Actions -> Deploy -> Run workflow (on `main`).

GitHub settings it needs: secrets `DEPLOY_SSH_KEY` (the deploy user's private key) and `DEPLOY_KNOWN_HOSTS` (the VM's host key); variables `DEPLOY_HOST` and `APP_URL`. Browser config is built in, so `NEXT_PUBLIC_FIREBASE_*`, `NEXT_PUBLIC_FLAGSMITH_ENV_KEY` and `NEXT_PUBLIC_SUPPORT_EMAIL` are repo **variables** too (they are public values). Server secrets (Mongo, Firebase Admin, LLM, ...) go in `/etc/pitchswipe.env` on the VM only.

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

The VM starts in demo mode (`PITCHSWIPE_DEMO=1`). For real mode remove that line and add the keys. Releases ship only the built app (no `scripts/`), so check the same values with `npm run doctor` in a local checkout first.

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

1. In `/etc/pitchswipe.env`: check `MONGODB_URI`, the three `FIREBASE_ADMIN_*` values, and `SWIPE_SIGNING_SECRET` (a new random value, 16+ characters, e.g. `openssl rand -hex 32`). Then **delete the `PITCHSWIPE_DEMO=1` line** (it wins over `MONGODB_URI`). `NEXT_PUBLIC_APP_URL` is baked in at build from the `APP_URL` repo variable.
2. `sudo systemctl restart pitchswipe`
3. `curl -s http://127.0.0.1:3000/api/health` should show `"ok":true,"db":"up","firebaseAdmin":true,"demo":false`.
4. Run `npm run doctor` locally with the same values: it says `Real mode ... ready` only when MongoDB and Firebase Admin answer, the web Firebase config is set, `SWIPE_SIGNING_SECRET` is 16+ characters and `NEXT_PUBLIC_APP_URL` is set.

To go back to demo data, add `PITCHSWIPE_DEMO=1` again and restart.

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
