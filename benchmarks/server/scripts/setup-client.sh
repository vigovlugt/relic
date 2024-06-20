curl -fsSL https://fnm.vercel.app/install | bash
fnm use --install-if-missing 20
node -v # should print `v20.14.0`
npm install -g pnpm