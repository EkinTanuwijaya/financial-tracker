# Ubuntu VPS deployment

The `main.yml` GitHub Actions workflow triggers only on pushes to `main`. It runs tests, checks database migrations, builds three Linux amd64 images, publishes commit-tagged images to GHCR, and deploys over SSH. Pull requests, pushes to other branches, and manual dispatch do not trigger the workflow.

Images build on GitHub runners, so the VPS only pulls and runs them. The production Compose file is standalone. It runs PostgreSQL, Redis, PaddleOCR, the API, dashboard, and Nginx. Only ports 80 and 443 are published. Container memory limits total about 3.2 GiB, leaving space for Ubuntu and Docker on a 4 GB VPS. This is a starting budget, not a measured capacity guarantee. OCR can exhaust its 1.5 GiB allowance on large receipts; inspect `docker stats` and container logs if it restarts. Deployment briefly interrupts service; this is a single-instance deployment.

## 1. Prepare the VPS

Requires an **amd64 Ubuntu VPS**, Docker Engine, and a recent Compose v2 plugin supporting `up --wait`. Confirm `uname -m` prints `x86_64`, and run `docker compose version`. ARM VPS images are not built by this workflow.

Create a dedicated deploy user and deployment directory using your existing sudo account:

```bash
sudo adduser --disabled-password --gecos '' deploy
sudo usermod -aG docker deploy
sudo install -d -m 700 -o deploy -g deploy /opt/finance-tracker
```

Docker group membership grants administrative access. Use a dedicated SSH key for this repository. Generate it on your computer:

```bash
ssh-keygen -t ed25519 -f finance-tracker-deploy -C finance-tracker-actions
```

Leave its passphrase empty for unattended CI. Install `finance-tracker-deploy.pub` in `/home/deploy/.ssh/authorized_keys` on the VPS. Set that directory to mode 700, the file to 600, and owner to `deploy`. Keep the private key for the GitHub secret below. Verify `ssh -i finance-tracker-deploy deploy@YOUR_VPS_IP 'docker info >/dev/null'` succeeds.

Allow inbound TCP 80, 443, and your SSH port in your provider firewall. If UFW is active, allow the same ports there. Do not expose PostgreSQL, Redis, OCR, or the application ports. Keep SSH access open while changing firewall rules.

## 2. Configure runtime secrets on the VPS

Copy `.env.production.example` to `/opt/finance-tracker/.env.production`, owned by `deploy`, mode 600. Edit it **on the VPS**:

```dotenv
APP_ORIGIN=https://YOUR_VPS_IP
POSTGRES_PASSWORD=YOUR_FIRST_RANDOM_HEX_SECRET
JWT_SECRET=YOUR_SECOND_RANDOM_HEX_SECRET
```

Generate each secret separately with `openssl rand -hex 32`. Hex avoids URL-encoding problems in the database connection string. Fill in AI configuration to enable receipt extraction. Leave the Telegram token empty unless this is the only backend polling that bot token. Do not change the database password after initialization without also rotating it inside PostgreSQL.

For private GHCR images, log in **as deploy** once with your GitHub username and a personal access token (classic) with `read:packages`. Grant it access to this repository's packages, including organization SSO authorization if required:

```bash
docker login ghcr.io -u YOUR_GITHUB_USERNAME
```

Paste the token at the password prompt. GitHub Actions uses its own temporary `GITHUB_TOKEN` for publishing; the read-only VPS token is separate. The first workflow creates the three packages. If they already exist, ensure this repository has Actions write access to each package.

## 3. Configure GitHub Actions

In repository **Settings → Secrets and variables → Actions**, set:

| Type | Name | Value |
| --- | --- | --- |
| Variable | `APP_ORIGIN` | `https://YOUR_VPS_IP`, exactly matching the VPS file, without a trailing slash |
| Variable | `GOOGLE_CLIENT_ID` | Optional; leave empty for IP-only deployment |
| Secret | `VPS_HOST` | VPS IP |
| Secret | `VPS_USER` | `deploy` |
| Secret | `VPS_PORT` | SSH port; defaults to `22` |
| Secret | `VPS_SSH_KEY` | Full private key from `finance-tracker-deploy`, including header/footer |
| Secret | `VPS_KNOWN_HOSTS` | Verified SSH host-key entry for the VPS |

Obtain the host-key entry with `ssh-keyscan -H -p 22 YOUR_VPS_IP` from your computer. Verify its fingerprint against the VPS console's `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub` before saving it. For a custom SSH port, scan that port. The workflow enforces host-key checking.

Create a GitHub environment named `production`. Restrict deployment branches to `main` if desired. Add required reviewers only if you want manual approval on each deployment.

Commit and push these files to `main`. Watch **Actions → CI/CD**. The pipeline runs tests and migration checks, builds all three images, and then deploys. OCR's first start downloads models and can take several minutes. Ensure the VPS has outbound access and sufficient disk space for its image and model cache. Runtime API keys and database secrets stay on the VPS.

The dashboard's API origin and optional Google client ID are embedded during its image build. Changing those GitHub variables requires a new build. Set the same Google ID on the VPS only after you have a domain supported by Google's OAuth origin rules.

## 4. HTTPS without a domain

Nginx loads `/opt/finance-tracker/tls/fullchain.pem` and `privkey.pem` from the VPS through a read-only directory mount. Generate them **before the first deployment**. Deployment stops early if either file is missing. Production login cookies require HTTPS.

For IP access, run these commands as `deploy` on the VPS. Replace `YOUR_VPS_IP` with your actual IPv4 address:

```bash
cd /opt/finance-tracker
umask 077
mkdir -p ca tls
chmod 700 ca tls
vps_ip=YOUR_VPS_IP

# Create a private certificate authority once. Keep its key outside the Nginx mount.
openssl req -x509 -nodes -newkey rsa:2048 -days 3650 \
  -keyout ca/root.key -out ca/root.crt -subj '/CN=Finance Tracker Private CA' \
  -addext 'basicConstraints=critical,CA:TRUE' \
  -addext 'keyUsage=critical,keyCertSign,cRLSign'

# Issue a server certificate valid for this IP for one year.
openssl req -nodes -newkey rsa:2048 -keyout tls/privkey.pem \
  -out tls/server.csr -subj "/CN=$vps_ip"
openssl x509 -req -in tls/server.csr -CA ca/root.crt -CAkey ca/root.key \
  -CAcreateserial -days 365 -out tls/fullchain.pem \
  -extfile <(printf 'subjectAltName=IP:%s\nbasicConstraints=critical,CA:FALSE\nextendedKeyUsage=serverAuth\n' "$vps_ip")
```

Download `/opt/finance-tracker/ca/root.crt` over your verified SSH connection and import it into your device/browser's trusted certificate authorities. Only distribute `root.crt`; keep both private keys on the VPS. Trusting this CA allows it to sign certificates your device accepts, so install it only on devices you control. After deployment, open `https://YOUR_VPS_IP`. Visitors who have not installed the CA will see a certificate warning.

Renew the server certificate before its one-year expiry by rerunning the `openssl x509` command with the same CA and IP. Do not recreate the CA during ordinary renewal. From the release directory, with the image variables exported as shown below, validate and reload Nginx:

```bash
docker compose --env-file /opt/finance-tracker/.env.production -f docker-compose.prod.yml exec -T nginx nginx -t
docker compose --env-file /opt/finance-tracker/.env.production -f docker-compose.prod.yml exec -T nginx nginx -s reload
```

Later, point a domain's DNS A record at the VPS and change `APP_ORIGIN` on both GitHub and the VPS to `https://your-domain`. Replace the files in `tls` with a publicly trusted certificate chain and matching private key, then push a new commit or rerun the workflow. Arrange certificate renewal and an Nginx reload after renewal; this setup does not automate certificate issuance or renewal. See [Nginx HTTPS configuration](https://nginx.org/en/docs/http/configuring_https_servers.html) for certificate-chain requirements.

## Database migrations, backups, and rollback

The repository now includes an initial Prisma migration matching the current schema. A fresh production database initializes automatically. **For an existing database**, back it up, compare its schema with `packages/prisma/schema.prisma`, and apply any missing additive changes first. Only after confirming it matches, baseline the initial migration with `prisma migrate resolve --applied 20261111000000_init --schema=../../packages/prisma/schema.prisma` using the backend image and production environment. Do not mark a mismatched schema as migrated, and never reset an existing database.

For future changes, generate migrations against a separate development database with `pnpm --filter @finance-tracker/backend run db:migrate`, review the SQL, and commit `packages/prisma/migrations`. CI applies every migration to a fresh PostgreSQL instance and checks that the resulting schema matches the Prisma file. Production runs only `prisma migrate deploy`. Keep migrations compatible with the previous API version because it can remain running while migrations apply. Plan destructive changes separately.

Before each migration, deployment saves a compressed database dump under `/opt/finance-tracker/backups`, mode 600. A failed pull, backup, or migration stops deployment. Health-check failures fail the workflow. There is no automatic database or application rollback. Check the failed step before retrying. Releases and backups are retained; copy backups off the VPS and manage retention as disk usage grows. The deploy dump is not a scheduled backup or protection against disk loss.

For logs or manual redeployment, log in as `deploy`, select a release, and export its image settings:

```bash
cd /opt/finance-tracker/releases/COMMIT_SHA
export IMAGE_PREFIX=ghcr.io/ekintanuwijaya/financial-tracker
export IMAGE_TAG=COMMIT_SHA
docker compose --env-file /opt/finance-tracker/.env.production -f docker-compose.prod.yml logs --tail=100
```

To roll back application images, use the previous release directory and previous commit tag, then run:

```bash
docker compose --env-file /opt/finance-tracker/.env.production -f docker-compose.prod.yml up -d --remove-orphans --wait --wait-timeout 900
```

Do not rerun the old deployment script for rollback: its older migration history may not match the database. Application rollback requires backward-compatible database changes. A database restore loses writes after the chosen backup; inspect and plan it separately. Never run `docker compose down -v` on production: it deletes database and other persistent volumes.
