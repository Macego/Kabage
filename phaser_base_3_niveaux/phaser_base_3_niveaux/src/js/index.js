import menu from "./menu.js";
import niveau1 from "./niveau1.js";
import niveau2 from "./niveau2.js";

var config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  physics: {
    default: "arcade",
    arcade: {
      gravity: {
        y: 300
      },
      debug: false
    }
  },
  scene: [menu, niveau1, niveau2]
};

new Phaser.Game(config);