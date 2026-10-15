import Phaser from "phaser";
import { render } from "preact";
import { WorldScene } from "./scenes/WorldScene.ts";
import { App } from "./ui/App.tsx";
import { GAME_NAME } from "@lemonquest/shared";
import { loading } from "./ui/loading.ts";
import "./ui/attention.ts";

document.title = GAME_NAME;
loading.init(); // overlay #boot já está pintado pelo index.html; aqui ele passa a mostrar progresso real

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  pixelArt: true,
  backgroundColor: "#1b1f2a",
  scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
  scene: [WorldScene],
});

render(<App />, document.getElementById("ui")!);
