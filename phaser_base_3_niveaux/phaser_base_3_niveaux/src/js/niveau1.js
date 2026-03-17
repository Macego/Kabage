import * as fct from "./fonctions.js";

export default class niveau1 extends Phaser.Scene {
  constructor() {
    super({
      key: "niveau1"
    });
  }

  preload() {
    fct.doNothing();
    fct.doAlsoNothing();

    this.load.spritesheet("img_perso", "src/assets/dude.png", {
      frameWidth: 32,
      frameHeight: 48
    });

    this.load.tilemapTiledJSON("mapkabage", "src/assets/mapkabage.json");

    this.load.image("ts_layer_back", "src/assets/layer.back.png");
    this.load.image("ts_layer_back01", "src/assets/layer.back01.png");
    this.load.image("ts_ground_tiles", "src/assets/Ground Tiles.png");
    this.load.image("ts_game_objects", "src/assets/Game Objects Tiles.png");
    this.load.image("ts_tileset", "src/assets/TileSet.png");
    this.load.image("ts_tilesheet_dungeon", "src/assets/tilesheet_dungeon.png");
    this.load.image("ts_tilesheet_grass", "src/assets/tilesheet_grass.png");
    this.load.image("ts_tilesheet_grass_bg", "src/assets/tilesheet_grass-bg.png");
    this.load.image("ts_tilesheet_ice", "src/assets/tilesheet_ice.png");
    this.load.image("ts_tilesheet_pagoda", "src/assets/tilesheet_pagoda.png");
    this.load.image("ts_tilesheet_snow", "src/assets/tilesheet_snow.png");
  }

  create() {
    this.gameOver = false;
  

    const carteDuNiveau = this.make.tilemap({ key: "mapkabage" });

    const tileset_layer_back = carteDuNiveau.addTilesetImage("layer.back", "ts_layer_back");
    const tileset_layer_back01 = carteDuNiveau.addTilesetImage("layer.back01", "ts_layer_back01");
    const tileset_ground_tiles = carteDuNiveau.addTilesetImage("Ground Tiles", "ts_ground_tiles");
    const tileset_game_objects = carteDuNiveau.addTilesetImage("Game Objects Tiles", "ts_game_objects");
    const tileset_tileset = carteDuNiveau.addTilesetImage("TileSet", "ts_tileset");
    const tileset_tilesheet_dungeon = carteDuNiveau.addTilesetImage("tilesheet_dungeon", "ts_tilesheet_dungeon");
    const tileset_tilesheet_grass = carteDuNiveau.addTilesetImage("tilesheet_grass", "ts_tilesheet_grass");
    const tileset_tilesheet_grass_bg = carteDuNiveau.addTilesetImage("tilesheet_grass-bg", "ts_tilesheet_grass_bg");
    const tileset_tilesheet_ice = carteDuNiveau.addTilesetImage("tilesheet_ice", "ts_tilesheet_ice");
    const tileset_tilesheet_pagoda = carteDuNiveau.addTilesetImage("tilesheet_pagoda", "ts_tilesheet_pagoda");
    const tileset_tilesheet_snow = carteDuNiveau.addTilesetImage("tilesheet_snow", "ts_tilesheet_snow");

    const tousLesTilesets = [
      tileset_layer_back,
      tileset_layer_back01,
      tileset_ground_tiles,
      tileset_game_objects,
      tileset_tileset,
      tileset_tilesheet_dungeon,
      tileset_tilesheet_grass,
      tileset_tilesheet_grass_bg,
      tileset_tilesheet_ice,
      tileset_tilesheet_pagoda,
      tileset_tilesheet_snow
    ].filter(ts => ts !== null);

    const calque_ciel = carteDuNiveau.createLayer("ciel", tousLesTilesets, 0, 0);
    const calque_background = carteDuNiveau.createLayer("background", tousLesTilesets, 0, 0);
    const calque_plateforme = carteDuNiveau.createLayer("plateforme", tousLesTilesets, 0, 0);
    const calque_deco = carteDuNiveau.createLayer("déco", tousLesTilesets, 0, 0);

    this.player = this.physics.add.sprite(25, 25, "img_perso");
    this.player.setScale(0.5);
    this.player.setBounce(0.1);
    this.player.setCollideWorldBounds(false);
    this.player.body.setSize(20, 30);

    calque_plateforme.setCollisionByProperty({ estSolide: true });

    this.physics.add.collider(this.player, calque_plateforme, (player, tile) => {
      if (tile && tile.properties && tile.properties.estMortel) {
        this.mourir("branche");
      }
    });

    this.physics.world.setBounds(0, 0, 3800, 500);
    this.cameras.main.setBounds(0, 0, 3800, 500);

    this.cameras.main.startFollow(this.player);
    this.cameras.main.setBackgroundColor("#87CEEB");

    this.anims.create({
      key: "anim_tourne_gauche",
      frames: this.anims.generateFrameNumbers("img_perso", {
        start: 0,
        end: 3
      }),
      frameRate: 10,
      repeat: -1
    });

    this.anims.create({
      key: "anim_face",
      frames: [{ key: "img_perso", frame: 4 }],
      frameRate: 20
    });

    this.anims.create({
      key: "anim_tourne_droite",
      frames: this.anims.generateFrameNumbers("img_perso", {
        start: 5,
        end: 8
      }),
      frameRate: 10,
      repeat: -1
    });

    this.clavier = this.input.keyboard.createCursorKeys();
  }

  update() {
    if (this.gameOver) {
      return;
    }

    if (this.clavier.left.isDown) {
      this.player.setVelocityX(-160);
      this.player.anims.play("anim_tourne_gauche", true);
    } else if (this.clavier.right.isDown) {
      this.player.setVelocityX(160);
      this.player.anims.play("anim_tourne_droite", true);
    } else {
      this.player.setVelocityX(0);
      this.player.anims.play("anim_face");
    }

    if (this.clavier.up.isDown && this.player.body.blocked.down) {
      this.player.setVelocityY(-250);
    }

    if (this.player.y > 600) {
      this.mourir("chute");
    }
  }

  mourir(typeMort) {
    if (this.gameOver) return;

    this.gameOver = true;
    this.physics.pause();
    this.player.setTint(0xff0000);

    let message = "GAME OVER - Appuie sur ENTRÉE pour recommencer";

    if (typeMort === "branche") {
      message += "\nNe touche pas les branches !";
    }

    this.texteGameOver = this.add.text(
      400,
      20,
      message,
      {
        fontSize: "28px",
        fill: "#ff0000",
        backgroundColor: "#000000",
        align: "center"
      }
    );

    this.texteGameOver.setOrigin(0.5, 0);
    this.texteGameOver.setScrollFactor(0);
    this.texteGameOver.setDepth(1001);

    this.input.keyboard.once("keydown-ENTER", () => {
      this.scene.restart();
    });
  }
}