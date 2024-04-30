test:
	npm run test

build:
	npm run build

install:
	npm install

final:
	npm run test && npm run prettier && npm run build
