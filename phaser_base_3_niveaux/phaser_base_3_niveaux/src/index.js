import niveau1 from "/src/js/niveau1.js";

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
      debug: true
    }
  },
  scene: [niveau1]
};

var game = new Phaser.Game(config);
game.scene.start("niveau1");