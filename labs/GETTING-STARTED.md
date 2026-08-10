# Getting started

**Read this once, before your first lab.** It takes about twenty minutes, and it covers the things every lab afterwards assumes you have done.

Written for **Ubuntu 24.04 LTS or 26.04**. If you are on a different Linux, the `apt` commands will differ; everything else is the same.

---

## 1. What you are about to spend a week doing

You are going to build **AxisPay** — a fictional payment platform made of sixteen small services — and run it on Kubernetes. Not a toy. It takes real payments through a real API, writes them to a real database, and by Friday it has monitoring, alerting and security controls on it.

Everything is fictional: the company, the merchants, the card numbers, the money. Nothing here touches a real bank.

You will build it in one piece, one day at a time:

| Day | What you add |
|---|---|
| 1 | Get it running — namespaces, pods, deployments, services |
| 2 | Keep it running — resource limits, health checks, autoscaling, safe releases |
| 3 | Give it memory — configuration, secrets, databases, storage |
| 4 | Let the world in — DNS, HTTPS, network security |
| 5 | Run it properly — access control, packaging, monitoring, then an assessed exercise |

Nothing gets thrown away. What you build on Monday is still running on Friday.

---

## 2. What your machine needs

| | Recommended | Minimum |
|---|---|---|
| CPU | 8 cores | 4 cores |
| Memory | 16 GB | 8 GB |
| Free disk | 40 GB | 25 GB |
| OS | Ubuntu 24.04 / 26.04 | — |

You need to be able to install software, which means your user must be able to use `sudo`. Check:

```bash
sudo -v
```

If it asks for your password and then returns you to the prompt with no error, you are fine. If it says `is not in the sudoers file`, you need an administrator to help before you can continue.

---

## 3. If you have never used a terminal

Skip this section if `cd` and `ls` are familiar.

**Opening a terminal.** Press <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>T</kbd>. A window opens with a line of text ending in `$`. That `$` is the **prompt** — it means the terminal is waiting for you to type something.

**The five commands you need this week:**

| Command | What it does | Example |
|---|---|---|
| `pwd` | Print Working Directory — shows where you are | `pwd` |
| `ls` | List the files here | `ls` |
| `cd <folder>` | Change Directory — move into a folder | `cd labs/day1` |
| `cd ..` | Go up one folder | `cd ..` |
| `cat <file>` | Print a file to the screen | `cat README.md` |

**A few conventions used everywhere in these labs:**

- Commands are shown in grey boxes. **Do not type the `$`** if you see one — it represents the prompt.
- `~` means your home folder. `~/kubernetes` means the `kubernetes` folder inside your home folder.
- **Copy and paste in the Ubuntu terminal uses <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>C</kbd> and <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>V</kbd>** — with Shift. Plain <kbd>Ctrl</kbd>+<kbd>C</kbd> does something else entirely (see below).
- <kbd>Ctrl</kbd>+<kbd>C</kbd> **stops whatever is currently running.** Several labs ask you to watch something with `-w`; that runs until you stop it. <kbd>Ctrl</kbd>+<kbd>C</kbd> is how you stop it. It is safe.
- Press <kbd>Tab</kbd> to complete a half-typed filename. This saves an enormous amount of typing and typos.
- Press <kbd>↑</kbd> to bring back the previous command.

**Editing a file.** Some labs ask you to change a line in a file. Any of these work:

```bash
nano labs/day1/L1.2-namespaces/manifests/01-namespaces.yaml
```

`nano` runs inside the terminal. Save with <kbd>Ctrl</kbd>+<kbd>O</kbd> then <kbd>Enter</kbd>; exit with <kbd>Ctrl</kbd>+<kbd>X</kbd>. The shortcuts are listed along the bottom of the screen, where `^O` means <kbd>Ctrl</kbd>+<kbd>O</kbd>.

If you prefer a window: `gedit <file>` on Ubuntu's default desktop, or open the folder in **VS Code** if you have it.

---

## 4. Install the tools

Four things: Docker, Minikube, kubectl and Helm.

### 4.1 Docker

Kubernetes runs your services in containers. Docker is what builds and runs them.

```bash
sudo apt update
sudo apt install -y docker.io
```

Now give your own user permission to use Docker without `sudo` every time:

```bash
sudo usermod -aG docker $USER
```

> **This one needs a log out and back in to take effect.** Group membership is only read when you log in. Log out of Ubuntu and back in now — or run `newgrp docker` to apply it to just this terminal.

Check it worked:

```bash
docker run --rm hello-world
```

You should see `Hello from Docker!`. If you instead see `permission denied while trying to connect to the Docker daemon socket`, you have not logged out and back in yet.

### 4.2 kubectl

`kubectl` (say "cube-cuttle", or "cube-control" — nobody agrees) is the command you will type several hundred times this week. It talks to Kubernetes.

```bash
curl -LO "https://dl.k8s.io/release/v1.36.2/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl
rm kubectl
kubectl version --client
```

Expect something like `Client Version: v1.36.2`.

> On an ARM machine — a Raspberry Pi, or Ubuntu on Apple silicon — replace `amd64` with `arm64` in that URL. `uname -m` tells you which you have: `x86_64` means amd64, `aarch64` means arm64.

### 4.3 Minikube

Minikube runs a small Kubernetes cluster on your own machine.

```bash
curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64
sudo install minikube-linux-amd64 /usr/local/bin/minikube
rm minikube-linux-amd64
minikube version
```

### 4.4 Helm

Helm packages Kubernetes applications. You will not need it until Day 5, but install it now so Friday morning is not spent installing things.

```bash
curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
helm version --short
```

### 4.5 A few small utilities

```bash
sudo apt install -y jq curl git make openssl
```

`jq` formats JSON so it is readable. You will use it constantly.

---

## 5. Get the course files

```bash
cd ~
git clone <the URL your instructor gave you> kubernetes
cd kubernetes
```

If you were given a zip file instead, unzip it so that you end up with a folder called `kubernetes` in your home directory.

**Check you are in the right place:**

```bash
pwd
ls
```

`pwd` should print `/home/<yourname>/kubernetes`, and `ls` should show `labs`, `documents`, `topics`, `manifests` and several others.

> **Every lab assumes you are in this folder** unless it says otherwise. If a command ever fails with `no such file or directory`, the first thing to check is `pwd`.

---

## 6. Run the pre-flight check

This checks your machine has everything, and tells you exactly what is missing.

```bash
make preflight
```

Fix anything it reports before continuing. It is designed to catch every environment problem we have seen, and running it now turns a lost morning into five minutes.

---

## 7. Create your cluster

This takes 5–15 minutes the first time, because it downloads a lot.

```bash
make cluster
```

Check it is alive:

```bash
kubectl get nodes
```

```
NAME           STATUS   ROLES           AGE   VERSION
axispay        Ready    control-plane   2m    v1.36.2
axispay-m02    Ready    <none>          1m    v1.36.2
axispay-m03    Ready    <none>          1m    v1.36.2
```

Three lines, all saying `Ready`. If you see fewer, or `NotReady`, wait sixty seconds and run it again — nodes take a moment to settle.

---

## 8. Build the AxisPay services

This turns the application source code into container images your cluster can run. It takes 5–10 minutes.

```bash
make build
```

Check:

```bash
minikube -p axispay image ls | grep axispay
```

You should see sixteen lines ending in `:1.0.0`.

---

## 9. You are ready

Start with [`day1/L1.1-cluster-recon/`](day1/L1.1-cluster-recon/).

---

## How the labs work

Every practical is a **folder**. Inside it you will find:

| File | What it is |
|---|---|
| `README.md` | The lab. Read it in the browser or with `cat`. Every step, every command, every expected output. |
| `manifests/` | The YAML files that lab uses. They are right there — you never have to go looking. |

Each lab follows the same shape, so once you have done one you know where to find things:

**What you are going to do** → **What you need first** → **Steps** (each with why, the command, what you should see, and what it means) → **Did it work?** → **Clean up** → **If something went wrong** → **Try this yourself** → **What you built**.

### Two habits worth forming now

**Read the "What you should see" block before you run the command.** Knowing what success looks like is what lets you notice failure.

**Run the validator when you finish.**

```bash
make validate-lab LAB=L1.3
```

A lab is not finished when the commands have run. It is finished when the check passes. This is the same discipline the incidents and the final assessment are scored on, so it is worth building early.

### When something goes wrong

It will. That is not a sign you are doing badly — about a third of this course is deliberately arranged so that things break.

Every lab has an **If something went wrong** section listing the failures we actually see, what causes each, and the command that confirms it. Look there first.

The six-step method you will learn in L1.1 works on anything:

1. Is it **Ready** — not just running?
2. What do the **events** say?
3. What do the **logs** say?
4. Is the **configuration** what you think it is?
5. Can it **reach** what it depends on?
6. What **changed**?

Nobody memorises Kubernetes. Everybody follows the method.
