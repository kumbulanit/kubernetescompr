# ==============================================================================
# AxisPay Kubernetes Training — Course Automation
# ==============================================================================
# Run `make` or `make help` for the full command list.
# ==============================================================================

SHELL := /bin/bash
.DEFAULT_GOAL := help
.ONESHELL:

include VERSIONS.env
export

PROFILE ?= A
KCTX    := $(MINIKUBE_PROFILE)
K       := kubectl --context=$(KCTX)

C_RESET := \033[0m
C_BOLD  := \033[1m
C_BLUE  := \033[34m
C_GREEN := \033[32m
C_YELL  := \033[33m

define banner
	@printf "$(C_BOLD)$(C_BLUE)==> %s$(C_RESET)\n" $(1)
endef

# ------------------------------------------------------------------------------
# Help
# ------------------------------------------------------------------------------
.PHONY: help
help: ## Show this help
	@printf "\n$(C_BOLD)AxisPay Kubernetes Training$(C_RESET)  —  course $(COURSE_CODE) v$(COURSE_VERSION)\n"
	@printf "Kubernetes $(KUBERNETES_VERSION) · Minikube profile '$(MINIKUBE_PROFILE)' · cluster profile $(PROFILE)\n\n"
	@awk 'BEGIN {FS = ":.*##"} \
		/^# ---- / {printf "\n$(C_BOLD)%s$(C_RESET)\n", substr($$0, 8)} \
		/^[a-zA-Z0-9_.-]+:.*?##/ {printf "  $(C_GREEN)%-22s$(C_RESET) %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@printf "\n"

# ---- Environment setup
.PHONY: preflight
preflight: ## Check this machine can run the labs (run BEFORE day 1)
	$(call banner,"Preflight checks")
	@bash scripts/setup/00-preflight.sh --profile $(PROFILE)

.PHONY: install-tools
install-tools: ## Install Docker, minikube, kubectl and helm on Ubuntu
	$(call banner,"Installing tooling")
	@bash scripts/setup/01-install-tools.sh

.PHONY: preload
preload: ## Pull and cache all base images (one-time; classroom can then be offline)
	$(call banner,"Preloading base images")
	@bash scripts/setup/02-preload-images.sh

.PHONY: cluster
cluster: ## Create the Minikube cluster with the correct flags
	$(call banner,"Creating cluster (profile $(PROFILE))")
	@bash scripts/setup/03-create-cluster.sh --profile $(PROFILE)

.PHONY: verify-cluster
verify-cluster: ## Verify Calico, ingress, metrics-server and node count
	@bash scripts/setup/04-verify-cluster.sh

.PHONY: setup
setup: preflight install-tools preload cluster verify-cluster ## Full environment setup, start to finish
	@printf "$(C_GREEN)$(C_BOLD)Environment ready. Next: make build-all$(C_RESET)\n"

# ---- Container images
.PHONY: build-all
build-all: ## Build all 16 service images into the Minikube runtime
	$(call banner,"Building all service images")
	@bash scripts/build/build-all.sh --tag $(IMAGE_TAG)

.PHONY: build
build: ## Build one service — make build SVC=payment-service
	@test -n "$(SVC)" || { echo "Usage: make build SVC=payment-service"; exit 1; }
	@bash scripts/build/build-service.sh --service $(SVC) --tag $(IMAGE_TAG)

.PHONY: build-v2
build-v2: ## Build the 2.0.0 images used by the capstone upgrade
	@bash scripts/build/build-all.sh --tag $(IMAGE_TAG_V2)

.PHONY: images
images: ## List AxisPay images present in the Minikube runtime
	@minikube -p $(MINIKUBE_PROFILE) image ls | grep -E '^(docker.io/)?$(IMAGE_NAMESPACE)/' | sort

# ---- Platform deployment
.PHONY: namespaces
namespaces: ## Create all namespaces with their labels
	@$(K) apply -f manifests/00-namespaces/

.PHONY: deploy-day1 deploy-day2 deploy-day3 deploy-day4 deploy-day5
deploy-day1: namespaces ## Deploy the Day 1 end-state
	$(call banner,"Deploying Day 1")
	@$(K) apply -R -f manifests/day1/
	@bash scripts/validate/checkpoint-day1.sh --wait

deploy-day2: ## Deploy the Day 2 end-state (requires Day 1)
	$(call banner,"Deploying Day 2")
	@$(K) apply -R -f manifests/day2/
	@bash scripts/validate/checkpoint-day2.sh --wait

deploy-day3: ## Deploy the Day 3 end-state (requires Day 2)
	$(call banner,"Deploying Day 3")
	@$(K) apply -R -f manifests/day3/
	@bash scripts/validate/checkpoint-day3.sh --wait

deploy-day4: ## Deploy the Day 4 end-state (requires Day 3)
	$(call banner,"Deploying Day 4")
	@$(K) apply -R -f manifests/day4/
	@bash scripts/validate/checkpoint-day4.sh --wait

deploy-day5: ## Deploy the Day 5 end-state (requires Day 4)
	$(call banner,"Deploying Day 5")
	@$(K) apply -R -f manifests/day5/
	@bash scripts/validate/checkpoint-day5.sh --wait

.PHONY: deploy-all
deploy-all: deploy-day1 deploy-day2 deploy-day3 deploy-day4 deploy-day5 ## Deploy the entire platform

.PHONY: seed
seed: ## Apply database schema and load seed data
	$(call banner,"Seeding the AxisPay database")
	@bash scripts/setup/05-seed-database.sh

# ---- Validation
.PHONY: validate-day1 validate-day2 validate-day3 validate-day4 validate-day5
validate-day1: ; @bash scripts/validate/checkpoint-day1.sh ## Validate the Day 1 end-state
validate-day2: ; @bash scripts/validate/checkpoint-day2.sh ## Validate the Day 2 end-state
validate-day3: ; @bash scripts/validate/checkpoint-day3.sh ## Validate the Day 3 end-state
validate-day4: ; @bash scripts/validate/checkpoint-day4.sh ## Validate the Day 4 end-state
validate-day5: ; @bash scripts/validate/checkpoint-day5.sh ## Validate the Day 5 end-state

.PHONY: validate-lab
validate-lab: ## Validate one lab — make validate-lab LAB=L3.6
	@test -n "$(LAB)" || { echo "Usage: make validate-lab LAB=L3.6"; exit 1; }
	@bash scripts/validate/validate-lab-$(LAB).sh

.PHONY: verify
verify: ## Verify the whole course offline — no cluster required
	@bash scripts/validate/verify-course.sh

.PHONY: inventory
inventory: ## Count everything in the repository
	@bash scripts/validate/verify-course.sh --inventory

.PHONY: health
health: ## Full platform health report
	@bash scripts/validate/platform-health.sh

.PHONY: lint
lint: ## Lint YAML, shell, Helm and Python
	$(call banner,"Linting")
	@yamllint -c .yamllint manifests/ charts/ || true
	@shellcheck scripts/**/*.sh || true
	@helm lint charts/axispay || true
	@python3 scripts/validate/check-helm-chart.py
	@python3 scripts/validate/check-promql.py
	@python3 scripts/validate/check-diagrams.py
	@kubeconform -strict -kubernetes-version $(KUBERNETES_VERSION:v%=%) \
		-ignore-missing-schemas -summary manifests/ || true

# ---- Course artefacts
# The decks and manuals are GENERATED. Never edit a .pptx or a .pdf by hand —
# edit slides/src/day<N>/day<N>.js or topics/<topic>/manual-chapter.md and
# rebuild. Each target also refreshes the copy inside the topic folder, so the
# two locations cannot drift apart.
TOPICS := 01-foundations-and-core-objects 02-workloads-scaling-and-releases \
          03-storage-and-configuration 04-networking-and-exposure \
          05-security-packaging-and-operations

.PHONY: slides manuals artefacts
slides: ## Rebuild all five PowerPoint decks from slides/src/
	$(call banner,"Building decks")
	@command -v node >/dev/null || { echo "node is required: https://nodejs.org"; exit 1; }
	@node -e "require('pptxgenjs')" 2>/dev/null || { \
		echo "pptxgenjs not found. Install it with:  npm install -g pptxgenjs"; \
		echo "(or set NODE_PATH to wherever it lives)"; exit 1; }
	@mkdir -p documents/slides /tmp/deck
	@for d in 1 2 3 4 5; do \
		( cd slides/src/day$$d && node day$$d.js ) || exit 1; \
		cp /tmp/deck/AxisPay-K8s-Day$$d.pptx documents/slides/; \
	done
	@i=1; for t in $(TOPICS); do \
		cp documents/slides/AxisPay-K8s-Day$$i.pptx topics/$$t/; i=$$((i+1)); \
	done
	@echo "  decks in documents/slides/ and mirrored into topics/"

manuals: ## Rebuild all five participant manual PDFs from topics/*/manual-chapter.md
	$(call banner,"Building participant manuals")
	@mkdir -p documents/manuals
	@i=1; for t in $(TOPICS); do \
		python3 scripts/build/build_manual.py topics/$$t/manual-chapter.md \
			-o documents/manuals/AxisPay-K8s-Day$$i-Participant-Manual.pdf || exit 1; \
		cp documents/manuals/AxisPay-K8s-Day$$i-Participant-Manual.pdf topics/$$t/; \
		i=$$((i+1)); \
	done
	@echo "  manuals in documents/manuals/ and mirrored into topics/"

artefacts: slides manuals dashboards ## Rebuild every generated artefact

# ---- Observability
.PHONY: observability observability-slim observability-down dashboards validate-promql
observability: ## Install Prometheus, Grafana, Loki and Alloy (run BEFORE Day 5)
	@bash scripts/setup/07-install-observability.sh

observability-slim: ## Metrics only — skips Loki and Alloy for constrained laptops
	@bash scripts/setup/07-install-observability.sh --metrics-only

observability-down: ## Remove the observability stack
	@bash scripts/setup/07-install-observability.sh --uninstall

dashboards: ## Regenerate the Grafana dashboard ConfigMaps
	@python3 scripts/build/build-dashboards.py

validate-promql: ## Parse every PromQL expression and check every metric name
	@python3 scripts/validate/check-promql.py
	@python3 scripts/validate/check-diagrams.py

grafana: ## Port-forward Grafana (admin / axispay-training)
	@echo "http://localhost:3000  admin / axispay-training"
	@$(K) -n $(NS_OBS) port-forward svc/kube-prometheus-stack-grafana 3000:80

prometheus: ## Port-forward Prometheus
	@echo "http://localhost:9090  -> Status/Targets, then Alerts"
	@$(K) -n $(NS_OBS) port-forward svc/kube-prometheus-stack-prometheus 9090

alerts: ## Show what the alert sink has actually received
	@$(K) -n $(NS_OBS) exec deploy/alert-sink -- \
		python3 -c "import urllib.request,json;print(json.dumps(json.load(urllib.request.urlopen('http://127.0.0.1:8080/api/v1/routes')),indent=2))"

# ---- Incidents
.PHONY: incident
incident: ## Inject an incident — make incident N=2
	@test -n "$(N)" || { echo "Usage: make incident N=2   (1,2,3a,3b,4a,4b,4c,5,6,7)"; exit 1; }
	@bash scripts/incidents/inject-INC-$(N).sh

.PHONY: resolve
resolve: ## Resolve an incident (instructor escape hatch) — make resolve N=2
	@test -n "$(N)" || { echo "Usage: make resolve N=2"; exit 1; }
	@bash scripts/incidents/resolve-INC-$(N).sh

# ---- Helm
# HELM_VALUES defaults to the training values, NOT values-prod.yaml.
#
# values-prod.yaml does fit a Profile A cluster AT REST — 3380m of requests
# against roughly 4500m schedulable. What does not fit is its autoscaler
# ceiling: payment-service maxReplicas 20 alone requests 4000m. Install it if
# you want to see production shape, but the first load test wedges the
# cluster. Render it, read it, diff it; run the labs on values.yaml.
HELM_VALUES ?= charts/axispay/values.yaml

.PHONY: helm-check helm-lint helm-template helm-install helm-upgrade helm-diff helm-rollback
helm-check: ## Validate the chart offline (no helm binary needed)
	@python3 scripts/validate/check-helm-chart.py
	@python3 scripts/validate/check-promql.py
	@python3 scripts/validate/check-diagrams.py

helm-lint: ## Lint the AxisPay chart against every values file
	@for v in charts/axispay/values*.yaml; do \
		echo "--- $$v"; helm lint charts/axispay -f $$v || exit 1; \
	done

helm-template: ## Render the chart without installing — make helm-template HELM_VALUES=charts/axispay/values-prod.yaml
	@helm template axispay charts/axispay -f $(HELM_VALUES)

helm-install: ## Install the whole platform from the chart
	@helm upgrade --install axispay charts/axispay \
		-f $(HELM_VALUES) --create-namespace --wait --timeout 10m

helm-diff: ## Show what an upgrade WOULD change (requires the helm-diff plugin)
	@helm diff upgrade axispay charts/axispay -f $(HELM_VALUES) || \
		echo "install it with: helm plugin install https://github.com/databus23/helm-diff"

helm-upgrade: ## Upgrade to 2.0.0 — the capstone change
	@helm upgrade axispay charts/axispay -f $(HELM_VALUES) \
		--set global.image.tag=$(IMAGE_TAG_V2) --atomic --timeout 10m

helm-rollback: ## Roll the release back one revision
	@helm rollback axispay -n $(NS_CORE) --wait --timeout 5m
	@helm history axispay -n $(NS_CORE)

# ---- Capstone
.PHONY: capstone-prep capstone-migrate capstone-validate capstone-reset
capstone-prep: ## Pre-flight the capstone — RUN THIS THE NIGHT BEFORE
	@bash capstone/validation/prepare-capstone.sh

capstone-migrate: ## Apply the settlement schema migration (phase 2)
	@$(K) apply -f capstone/manifests/
	@$(K) -n $(NS_DATA) wait --for=condition=complete job/settlement-migration-2-0-0 --timeout=300s
	@$(K) -n $(NS_DATA) logs job/settlement-migration-2-0-0

capstone-validate: ## Score the capstone against the nine competencies
	@bash scripts/validate/capstone-validate.sh

capstone-reset: ## Reset between cohorts — resolve all incidents, roll back to 1.1.0
	@bash scripts/incidents/resolve-INC-5.sh || true
	@bash scripts/incidents/resolve-INC-6.sh || true
	@bash scripts/incidents/resolve-INC-7.sh || true
	@helm rollback axispay --wait || true
	@$(K) delete job settlement-migration-2-0-0 -n $(NS_DATA) --ignore-not-found
	@bash scripts/validate/checkpoint-day5.sh
