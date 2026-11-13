
# ============================================================
# CIS 285 - Lab 8
# SplitSmart AI-Assisted Development Environment
#
# Technology Stack:
#   Node.js 22
#   Next.js 15
#   React + TypeScript
#   Tailwind CSS
#   Prisma 6 + SQLite
#   Vitest
#
# All dependencies are installed during Docker image build.
# Lab 8 prepares the environment.
# Lab 9 implements the SplitSmart prototype using AI.
# ============================================================

FROM node:22-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive

# ------------------------------------------------------------
# 1. Install system dependencies
# ------------------------------------------------------------

RUN apt-get update && apt-get install -y \
    --no-install-recommends \
    git \
    curl \
    ca-certificates \
    sqlite3 \
    python3 \
    build-essential \
    openssl \
    && rm -rf /var/lib/apt/lists/*

# ------------------------------------------------------------
# 2. Create Next.js 15 starter application
# ------------------------------------------------------------

WORKDIR /opt

RUN npx --yes create-next-app@15 splitsmart-starter \
    --typescript \
    --tailwind \
    --eslint \
    --app \
    --src-dir \
    --use-npm \
    --yes

WORKDIR /opt/splitsmart-starter

# ------------------------------------------------------------
# 3. Install Prisma, SQLite, and testing dependencies
#
# Explicitly install @types/node@22 to avoid the
# npm ERESOLVE conflict with Vitest.
# ------------------------------------------------------------

RUN npm install \
    @prisma/client@6 \
    better-sqlite3 \
    && npm install -D \
    prisma@6 \
    @types/better-sqlite3 \
    @types/node@22 \
    vitest@5

# ------------------------------------------------------------
# 4. Initialize Prisma with SQLite
# ------------------------------------------------------------

RUN npx prisma init --datasource-provider sqlite

# ------------------------------------------------------------
# 5. Create starter Prisma schema
#
# This is an environment verification model.
# Students will implement the actual SplitSmart
# data model in Lab 9.
# ------------------------------------------------------------

RUN printf '%s\n' \
    'generator client {' \
    '  provider = "prisma-client-js"' \
    '}' \
    '' \
    'datasource db {' \
    '  provider = "sqlite"' \
    '  url      = env("DATABASE_URL")' \
    '}' \
    '' \
    'model EnvironmentCheck {' \
    '  id        Int      @id @default(autoincrement())' \
    '  message   String' \
    '  createdAt DateTime @default(now())' \
    '}' \
    > prisma/schema.prisma

# ------------------------------------------------------------
# 6. Configure SQLite database
# ------------------------------------------------------------

RUN printf '%s\n' \
    'DATABASE_URL="file:./dev.db"' \
    > .env

# ------------------------------------------------------------
# 7. Generate Prisma Client and initialize database
# ------------------------------------------------------------

RUN npx prisma generate \
    && npx prisma db push

# ------------------------------------------------------------
# 8. Save fully installed application as a template
#
# All npm dependencies are already installed.
# Students do not need to run npm install manually.
# ------------------------------------------------------------

RUN mkdir -p /opt/splitsmart-template \
    && cp -a /opt/splitsmart-starter/. \
       /opt/splitsmart-template/

# ------------------------------------------------------------
# 9. Create workspace initialization script
#
# This script runs through devcontainer.json's
# postCreateCommand.
#
# It copies the preinstalled application into prototype/
# without overwriting an existing application.
# ------------------------------------------------------------

RUN printf '%s\n' \
    '#!/bin/sh' \
    'set -eu' \
    '' \
    'TARGET=/workspaces/SplitSmart/prototype' \
    'TEMPLATE=/opt/splitsmart-template' \
    '' \
    'mkdir -p "$TARGET"' \
    '' \
    'if [ ! -f "$TARGET/package.json" ]; then' \
    '  echo "Initializing SplitSmart prototype..."' \
    '  cp -a "$TEMPLATE/." "$TARGET/"' \
    'fi' \
    '' \
    'if [ ! -d "$TARGET/node_modules" ]; then' \
    '  echo "Copying preinstalled dependencies..."' \
    '  cp -a "$TEMPLATE/node_modules" "$TARGET/"' \
    'fi' \
    '' \
    'echo "SplitSmart development environment ready."' \
    > /usr/local/bin/init-splitsmart \
    && chmod +x /usr/local/bin/init-splitsmart

# ------------------------------------------------------------
# 10. Configure workspace and application port
# ------------------------------------------------------------

WORKDIR /workspaces/SplitSmart

EXPOSE 3000

# ============================================================
# End of Dockerfile
# ============================================================
