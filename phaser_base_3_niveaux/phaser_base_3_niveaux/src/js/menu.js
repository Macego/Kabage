export default class menu extends Phaser.Scene {
  constructor() {
    super({
      key: "menu"
    });
  }

  create() {
    this.cameras.main.setBackgroundColor("#1e1e2f");

    this.add.text(400, 100, "CHOIX DU NIVEAU", {
      fontSize: "40px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setOrigin(0.5);

    const boutonNiveau1 = this.add.text(400, 220, "NIVEAU 1", {
      fontSize: "32px",
      color: "#ffffff",
      backgroundColor: "#2e8b57",
      padding: { x: 20, y: 10 }
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    const boutonNiveau2 = this.add.text(400, 320, "NIVEAU 2", {
      fontSize: "32px",
      color: "#ffffff",
      backgroundColor: "#4682b4",
      padding: { x: 20, y: 10 }
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    boutonNiveau1.on("pointerover", () => {
      boutonNiveau1.setScale(1.08);
    });

    boutonNiveau1.on("pointerout", () => {
      boutonNiveau1.setScale(1);
    });

    boutonNiveau1.on("pointerdown", () => {
      this.scene.start("niveau1");
    });

    boutonNiveau2.on("pointerover", () => {
      boutonNiveau2.setScale(1.08);
    });

    boutonNiveau2.on("pointerout", () => {
      boutonNiveau2.setScale(1);
    });

    boutonNiveau2.on("pointerdown", () => {
      this.scene.start("niveau2");
    });
  }
}