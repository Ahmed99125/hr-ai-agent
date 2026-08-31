# Company HR Employee Portal

This is the front-end interface for the Company HR AI Assistant. It is a standalone, static HTML webpage that embeds the HeyLua chat widget, allowing employees to access HR services like Onboarding and Performance Check-ins directly from their browser.

## Features
- **Zero Dependencies**: Pure HTML and CSS. No build step required.
- **Premium UI**: Modern dark-mode aesthetic with glassmorphism and animated mesh gradients.
- **AI Integration**: Directly embeds the HeyLua `LuaPop` widget hooked to the production HR Agent.

## How to Run Locally

You can open `index.html` directly in your browser, or run a local static server:

```bash
npx serve .
```

## How to Deploy to GitHub Pages

Because this is a completely static site, it is 100% ready to be deployed to GitHub Pages for free hosting:

1. Create a new repository on GitHub (e.g., `hr-portal`).
2. Upload `index.html` and this `README.md` to the repository.
3. In your GitHub repository settings, go to **Pages**.
4. Under **Build and deployment**, select **Deploy from a branch**.
5. Select the `main` branch and click **Save**.
6. Within a minute, your HR portal will be live on the web at `https://<your-username>.github.io/hr-portal/`!

## Configuration

If you need to point the chat widget to a different agent, open `index.html` and scroll to the bottom. Update the `agentId` inside the `window.LuaPop.init` function:

```javascript
window.LuaPop.init({
  agentId: "YOUR_NEW_AGENT_ID",
  // ...
});
```
