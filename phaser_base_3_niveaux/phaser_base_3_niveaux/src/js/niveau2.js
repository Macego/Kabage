export default class niveau2 extends Phaser.Scene {
  constructor() {
    super({
      key: "niveau2"
    });
  }

  create() {
    this.cameras.main.setBackgroundColor("#222244");

    this.add.text(400, 300, "NIVEAU 2", {
      fontSize: "40px",
      color: "#ffffff"
    }).setOrigin(0.5);

    this.input.keyboard.once("keydown-ENTER", () => {
      this.scene.start("menu");
    });
  }
}