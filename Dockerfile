FROM node:18-alpine

# Install pnpm
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# Copy package.json files
COPY package.json pnpm-lock.yaml ./
COPY packages/types/package.json ./packages/types/
COPY apps/Flotix_backend/package.json ./apps/Flotix_backend/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/types ./packages/types/
COPY apps/Flotix_backend ./apps/Flotix_backend/

# Build the application
WORKDIR /app/packages/types
RUN pnpm build

WORKDIR /app/apps/Flotix_backend
RUN pnpm build

# Expose port
EXPOSE 3001

# Start the application
CMD ["npm", "run", "start:prod"]