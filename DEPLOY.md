# Deploy the RTX Online Service

Goal: the optimizer running on a cloud VM, usable from your phone anywhere,
your laptop off. Two ways: Docker (recommended) or plain Node.

## What the service needs

- Linux VM, ARM or x64
- 2 GB RAM free (a 600 MB 4K upload is processed in memory ~2-3x)
- ~5 GB disk (system + Docker image + one job at a time)
- Port 3005 open (or any port you set with `PORT=`)
- Node 20+ and ffmpeg (only for the non-Docker way)

## Step 1 — Oracle Always Free VM (recommended, $0)

Current free tier (verified 2026): **VM.Standard.A1.Flex, up to 4 ARM CPUs +
24 GB RAM, 200 GB disk, 10 TB/month traffic — free forever.**

1. Sign up at cloud.oracle.com (needs a credit card for verification only —
   you will NOT be charged while staying in the free limits).
2. Create instance:
   - Shape: VM.Standard.A1.Flex, 4 OCPU, 24 GB RAM
   - Image: Ubuntu 22.04 (or 24.04)
   - Boot volume: 50 GB
   - SSH key: let it generate one, save the private key
   - If you see "out of capacity": try another region, or retry later
     (capacity is the hard part; popular regions are often full).
3. After it starts, open the network: instance details → subnet →
   Security List → Add Ingress Rule: source 0.0.0.0/0, destination port
   3005, TCP. (Also keep 22 for SSH, source = your IP only if possible.)
4. Note the public IP.

## Step 2 — Run the service

### Way A: Docker (recommended)

```bash
ssh -i your-key ubuntu@VM_IP

# install docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu && exit
ssh -i your-key ubuntu@VM_IP   # reconnect

# get the code
git clone -b online-rtx-service https://github.com/Willsonraiii/vague-transcode.git
cd vague-transcode

# configure
cp .env.example .env
nano .env        # set ACCESS_TOKEN to: openssl rand -hex 24  (run that first)

# build and run (auto-restarts on reboot/crash)
docker compose -f docker-compose.yml up -d --build
```

`docker-compose.yml` is in the repo. Service is now on `http://VM_IP:3005`.

### Way B: plain Node

```bash
sudo apt update && sudo apt install -y nodejs npm ffmpeg git
git clone -b online-rtx-service https://github.com/Willsonraiii/vague-transcode.git
cd vague-transcode && npm install
cp .env.example .env && nano .env   # set ACCESS_TOKEN

# run under systemd so it restarts automatically:
sudo tee /etc/systemd/system/rtx-online.service <<'EOF'
[Unit]
Description=RTX online optimizer
After=network.target

[Service]
WorkingDirectory=/home/ubuntu/vague-transcode
EnvironmentFile=/home/ubuntu/vague-transcode/.env
ExecStart=/usr/bin/node server-rtx-online.js
Restart=always
User=ubuntu

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl enable --now rtx-online
```

## Step 3 — check it works

```bash
curl http://VM_IP:3005/health     # {"ok":true,...,"auth":"token"}
```

Open `http://VM_IP:3005` in your phone browser, enter your access token,
upload a test video, download the result, check it in TikTok Studio.

## Step 4 — HTTPS (before real use)

HTTP sends your access token unencrypted. For real use, put Caddy in front
(any domain works, free HTTPS automatic):

```bash
# point your domain's DNS A record at VM_IP first, then on the VM:
sudo apt install -y caddy
echo "yourdomain.com { reverse_proxy 127.0.0.1:3005 }" | sudo tee /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Then use `https://yourdomain.com`. No domain yet? The service still works
over HTTP with the token for quick tests — do not share it.

## Keep the free VM alive

Oracle reclaims instances that are 100% idle for ~7 days. Our cron keepalive
is included in `docker-compose.yml` (a tiny daily CPU blip). For Way B:

```bash
( crontab -l 2>/dev/null; echo "0 3 * * * /usr/bin/sha256sum /dev/zero | head -c 100M > /dev/null" ) | crontab -
```

## Rules that keep it free

- Never scale the VM above 4 OCPU / 24 GB.
- Keep the boot volume within 200 GB total.
- In the Oracle console set a budget alert at $0.01 — tells you immediately
  if anything paid is ever touched.

## Rollback / remove

- Stop: `docker compose down` (or `sudo systemctl stop rtx-online`).
- Delete everything: terminate the instance in the Oracle console. No data
  worth keeping lives on the VM (jobs auto-delete; GitHub has the code).
