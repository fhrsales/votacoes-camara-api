import App from "./routes/App.svelte";
const container = document.querySelector(".embed-container");
const embed = document.createElement("div");
embed.id = "uva-embed";
container.appendChild(embed);

const app = new App({
    target: embed
});

export default app;