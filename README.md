

# Chitran – Sketch. Create. Inspire.

**Chitran** is a real-time collaborative drawing platform that allows users to draw shapes, write text, erase, undo, redo, and customize fonts and colors all on a shared canvas with full synchronization.

What makes Chitran different isn't just the ability to draw - it’s the robust **real-time collaboration**, **role-based control**, and **scalable system architecture** built with production-level patterns and tooling.

-----

## Core Features

  * **Multi-Shape Drawing**: Draw rectangles, circles, arrows, and insert text with adjustable font, color, and size.
  * **Precise Erasing**: Erase individual shapes based on coordinate detection.
  * **Undo / Redo**: Powerful stack-based undo/redo system for seamless control.
  * **Live Collaboration**: Real-time drawing sync powered by a custom Redis Pub/Sub architecture.
  * **Admin Controls**:
      * Grant or revoke editing rights.
      * Toggle collaboration on/off at any time.
  * **Persistent Canvas Storage**: Each stroke and shape is stored in PostgreSQL for long-term access.
  * **Scalable State Management**: Uses Redux Toolkit and React Query to ensure minimal latency and fast updates.
  * **Turborepo Architecture**: A modular monorepo setup for optimal scalability and code sharing.

-----

## Tech Stack

| Layer | Tools & Libraries |
| :--- | :--- |
| **Frontend** | Next.js (App Router), Tailwind CSS, Shadcn UI, Redux Toolkit, React Query |
| **Backend (API)** | Express.js |
| **Backend (Real-time)** | Socket.IO, Redis |
| **Database** | PostgreSQL |
| **Patterns** | Singleton Pattern, Pub/Sub for real-time updates |
| **Monorepo** | Turborepo (with apps + shared packages) |

-----

## Architecture Highlights

  * **Zod + TypeScript** – Enforces type safety and runtime validation across services.
  * **Singleton Pattern** – Guarantees a single active WebSocket instance per session to avoid message duplication.
  * **Redis Pub/Sub** – Decouples message flow for scalable real-time collaboration on canvases.
  * **Turborepo Structure** – Separates concerns into apps (`web`, `server`, `ws-server`) and shared logic, making the project team- and microservice-ready.

-----

## Project Structure

```
/apps
  └── web        # Frontend with canvas UI and drawing logic
  └── server     # Express API handling roles, DB interaction
  └── ws-server  # WebSocket server using Socket.IO for real-time sync

/packages
  └── backend-common    # Things common in backend
  └── database          # Prisma is initialized here
  └── common            # Things common in whole project
```

-----

## Getting Started

Follow these instructions to get the project up and running on your local machine.

### Prerequisites

  * **Node.js** (v18.0 or higher)
  * **pnpm** (v8.0 or higher)
  * **PostgreSQL** and **Redis** instances running locally or accessible via a URL.

### Installation & Setup Guide

1.  **Clone the Repository**

    ```bash
    git clone https://github.com/your-username/chitran.git
    cd chitran
    ```

2.  **Install Dependencies**
    Install all dependencies for all packages from the root of the project.

    ```bash
    pnpm install
    ```

3.  **Set Up Environment Variables**
    This project requires environment variables for the server and the web client. You'll find `.env.example` files in `apps/server` and `apps/web`.

      * **For the server:**
        ```bash
        cd apps/server
        cp .env.example .env
        ```
      * **For the web client:**
        ```bash
        cd apps/web
        cp .env.example .env.local
        ```

4.  **Fill in the Environment Variables**
    You now need to populate the `.env` and `.env.local` files with your keys and secrets.

      * **`DATABASE_URL`**: Your PostgreSQL connection string.
      * **`REDIS_URL`**: Your Redis connection string.
      * **`NEXT_PUBLIC_WS_URL`**: The URL for your WebSocket server (e.g., `http://localhost:8080`).
      * **`NEXTAUTH_SECRET`**: Generate a secret by running `openssl rand -base64 32` in your terminal.
      * **`GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET`**:
        1.  Go to the [Google Cloud Console](https://console.cloud.google.com/).
        2.  Create a new project.
        3.  Navigate to **APIs & Services \> Credentials**.
        4.  Click **Create Credentials \> OAuth client ID**.
        5.  Select **Web application** and add `http://localhost:3000/api/auth/callback/google` as an **Authorized redirect URI**.
        6.  Copy the Client ID and Secret into your `.env` file.
      * **`GITHUB_CLIENT_ID` & `GITHUB_CLIENT_SECRET`**:
        1.  Go to **GitHub \> Settings \> Developer settings \> OAuth Apps \> New OAuth App**.
        2.  Set the **Authorization callback URL** to `http://localhost:3000/api/auth/callback/github`.
        3.  Copy the Client ID and generate a new Client Secret.

5.  **Run Database Migrations**
    This command applies the Prisma schema to your database, creating the necessary tables.

    ```bash
    pnpm --filter=@repo/db db:migrate
    ```

6.  **Build All Packages**
    Build the shared packages to make them available to the apps.

    ```bash
    pnpm build
    ```

7.  **Run All Applications**
    This command will start the frontend (`web`), the backend (`server`), and the WebSocket server (`ws-server`) in development mode.

    ```bash
    pnpm dev
    ```

    Your application should now be running\!

      * **Frontend**: `http://localhost:3000`
      * **Backend Server**: `http://localhost:5000`
      * **WebSocket Server**: `http://localhost:8080`

-----

## Preview

\<table\>
\<tr\>
\<td align="center"\>
\<img src="./assets/1.png" width="300px" /\>
\<br /\>
\<sub\>\<b\>Home Screen\</b\>\</sub\>
\</td\>
\<td align="center"\>
\<img src="./assets/2.png" width="300px" /\>
\<br /\>
\<sub\>\<b\>Dashboard View\</b\>\</sub\>
\</td\>
\<td align="center"\>
\<img src="./assets/3.png" width="300px" /\>
\<br /\>
\<sub\>\<b\>Canvas Editor\</b\>\</sub\>
\</td\>
\</tr\>
\</table\>

-----

## Why Chitran?

Most collaborative drawing tools are either too minimal or too complex. **Chitran strikes a balance**:

  * Clean, fast UI with **modern drawing tools**
  * **Role-based access control** for security and collaboration
  * **True real-time sync** with Redis Pub/Sub
  * **Modular, maintainable codebase** built for scale and team workflows
  * Optimistic updates and **state reconciliation** to ensure a consistent experience across all users

-----

## Roadmap

  * [ ] Version history with granular undo/redo
  * [ ] Real-time cursor tracking
  * [ ] Export canvas as image / PDF
  * [ ] Auto-save with intelligent throttling
  * [ ] Canvas-level chat
  * [ ] Multi-tab sync with activity indicators

-----

## Live Demo

Deployment is currently being configured with rate-limiting, security headers, and performance profiling.
\-\> A working video demo is available [on Youtube](https://youtu.be/vRV5SdqgUFw)

-----

## For Contributors

Chitran isn’t just a drawing tool — it’s a **real-world system design playground**.
Open to contributions in:

  * WebSocket performance & scaling
  * Canvas optimizations
  * UI/UX enhancements
  * Infrastructure improvements
  * Redis or PostgreSQL query optimization

-----

## Inspiration

> The name **Chitran** comes from the Sanskrit word *चित्रण*, meaning *drawing* or *sketching*.
> It reflects the core philosophy that every brilliant idea starts with a blank canvas.
