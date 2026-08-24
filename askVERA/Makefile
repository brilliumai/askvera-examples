.PHONY: install dev-server dev-client build test test-headed pack clean

## Install dependencies for both server and web client
install:
	cd server && npm install
	cd webClient && npm install

## Start the server in watch mode (hot-reload via --watch)
## Requires server/.env to be configured first
dev-server:
	cd server && npm run dev

## Start the Vite dev server for the web client
## Requires webClient/.env to be configured first
dev-client:
	cd webClient && npm run dev

## Build the web client for production
build:
	cd webClient && npm run build

## Run Playwright tests (requires both servers to be running)
test:
	cd webClient && npm test

## Run Playwright tests in headed mode (visible browser)
test-headed:
	cd webClient && npm run test:headed

## Package the example for distribution
## Excludes: node_modules/, .env*, .idea/, dist/, test artifacts, lock files, *.zip
## Output: askvera-example.zip in this directory
pack:
	@echo "Packaging askVERA example..."
	@rm -rf /tmp/askvera-pack
	@mkdir /tmp/askvera-pack
	@rsync -a \
		--exclude='node_modules/' \
		--exclude='.env' \
		--exclude='.env.local' \
		--exclude='.env.*.local' \
		--exclude='.idea/' \
		--exclude='.claude/' \
		--exclude='dist/' \
		--exclude='*.zip' \
		--exclude='.DS_Store' \
		--exclude='test-results/' \
		--exclude='playwright-report/' \
		--exclude='blob-report/' \
		--exclude='.git' \
		--exclude='yarn.lock' \
		--exclude='package-lock.json' \
		. /tmp/askvera-pack/askVERA/
	@cd /tmp/askvera-pack && zip -r askvera-example.zip askVERA/
	@mv /tmp/askvera-pack/askvera-example.zip ./askvera-example.zip
	@rm -rf /tmp/askvera-pack
	@echo "Done → askVERA/askvera-example.zip"

## Remove node_modules, build artifacts, and generated zip
clean:
	rm -rf server/node_modules webClient/node_modules webClient/dist webClient/test-results webClient/playwright-report askvera-example.zip
