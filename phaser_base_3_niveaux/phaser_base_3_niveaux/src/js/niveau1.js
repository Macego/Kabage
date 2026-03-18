import * as fct from "./fonctions.js";

let keyE;

let levierZone;
let coffreZone;
let murBloquant;

let texteInteraction;
let texteEtoiles;

let levierActive = false;
let coffreOuvert = false;
let nbEtoiles = 0;

export default class niveau1 extends Phaser.Scene {
  constructor() {
    super({
      key: "niveau1"
    });

    this.timerChrono = null;
    this.timerVent = null;
    this.timerFinVent = null;
    this.timerFlammes = null;

    this.tempsEcoule = 0;
    this.texteChrono = null;
    this.texteVent = null;

    this.ventActif = false;
    this.forceVent = 0;

    this.tuilesFragilesDeclenchees = [];

    this.nbSautsMax = 2;
    this.sautsRestants = 2;

    this.groupeFlammes = null;
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

    this.load.image("star", "src/assets/star.png");
    this.load.image("flamme", "src/assets/flamme.png");
  }

  create() {
    this.gameOver = false;
    this.estEnTrainDeGrimper = false;

    levierActive = false;
    coffreOuvert = false;
    nbEtoiles = 0;

    this.vitesseMarche = 160;
    this.vitesseSaut = 225;
    this.vitesseEchelle = 120;

    this.vitesseMarcheNormale = 160;
    this.vitesseMarcheGlace = 260;
    this.accelerationSol = 12;
    this.accelerationGlace = 3;
    this.vitesseHorizontale = 0;

    this.ventActif = false;
    this.forceVent = 0;

    this.tempsEcoule = 0;
    this.tuilesFragilesDeclenchees = [];
    this.sautsRestants = this.nbSautsMax;

    this.cameras.main.setZoom(1);

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

    carteDuNiveau.createLayer("ciel", tousLesTilesets, 0, 0);
    carteDuNiveau.createLayer("background", tousLesTilesets, 0, 0);
    this.calque_plateforme = carteDuNiveau.createLayer("plateforme", tousLesTilesets, 0, 0);
    this.calque_mur_coffre = carteDuNiveau.createLayer("mur_coffre", tousLesTilesets, 0, 0);
    this.calque_deco = carteDuNiveau.createLayer("déco", tousLesTilesets, 0, 0);

    this.player = this.physics.add.sprite(25, 25, "img_perso");
    this.player.setScale(0.5);
    this.player.setBounce(0.1);
    this.player.setCollideWorldBounds(false);
    this.player.body.setSize(20, 30);
    this.player.body.setOffset(6, 18);

    this.calque_plateforme.setCollisionByProperty({ estSolide: true });

    if (this.calque_mur_coffre) {
      this.calque_mur_coffre.setCollisionByProperty({ estSolide: true });
      murBloquant = this.calque_mur_coffre;
    }

    this.physics.add.collider(this.player, this.calque_plateforme, (player, tile) => {
      if (tile && tile.properties && tile.properties.estMortel) {
        this.mourir("branche");
      }
    });

    if (this.calque_mur_coffre) {
      this.physics.add.collider(this.player, this.calque_mur_coffre);
    }

    this.groupeFlammes = this.physics.add.group();

    this.physics.add.overlap(this.player, this.groupeFlammes, () => {
      this.mourir("flamme");
    });

    this.physics.add.collider(this.groupeFlammes, this.calque_plateforme, (flamme) => {
      if (flamme) {
        flamme.destroy();
      }
    });

    if (this.calque_mur_coffre) {
      this.physics.add.collider(this.groupeFlammes, this.calque_mur_coffre, (flamme) => {
        if (flamme) {
          flamme.destroy();
        }
      });
    }

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
    keyE = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);

    levierZone = this.add.zone(3475, 452, 50, 50);
    this.physics.world.enable(levierZone);
    levierZone.body.setAllowGravity(false);
    levierZone.body.moves = false;

    coffreZone = this.add.zone(3547, 475, 60, 60);
    this.physics.world.enable(coffreZone);
    coffreZone.body.setAllowGravity(false);
    coffreZone.body.moves = false;

    texteInteraction = this.add.text(12, 44, "", {
      fontSize: "14px",
      color: "#ffffff",
      backgroundColor: "#000000",
      padding: { x: 6, y: 4 }
    });
    texteInteraction.setScrollFactor(0);
    texteInteraction.setDepth(1000);
    texteInteraction.setVisible(false);

    texteEtoiles = this.add.text(12, 12, "Nombre d'étoiles récupérées : 0", {
      fontSize: "16px",
      color: "#ffffff",
      backgroundColor: "#000000",
      padding: { x: 6, y: 4 }
    });
    texteEtoiles.setScrollFactor(0);
    texteEtoiles.setDepth(1000);

    this.texteChrono = this.add.text(12, 76, "Temps : 00:00", {
      fontSize: "16px",
      color: "#ffffff",
      backgroundColor: "#000000",
      padding: { x: 6, y: 4 }
    });
    this.texteChrono.setScrollFactor(0);
    this.texteChrono.setDepth(1000);

    this.texteVent = this.add.text(400, 40, "Attention : bourrasque de vent !", {
      fontSize: "24px",
      color: "#ffffff",
      backgroundColor: "#b22222",
      padding: { x: 10, y: 6 }
    });
    this.texteVent.setOrigin(0.5, 0);
    this.texteVent.setScrollFactor(0);
    this.texteVent.setDepth(1001);
    this.texteVent.setVisible(false);

    this.timerChrono = this.time.addEvent({
      delay: 1000,
      callback: this.mettreAJourChrono,
      args: [],
      callbackScope: this,
      repeat: -1
    });

    this.timerVent = this.time.addEvent({
      delay: 10000,
      callback: this.declencherBourrasque,
      args: [],
      callbackScope: this,
      repeat: -1
    });

    this.timerFlammes = this.time.addEvent({
      delay: 15000,
      callback: this.creerVagueFlammes,
      args: [],
      callbackScope: this,
      repeat: -1
    });
  }

  mettreAJourChrono() {
    if (this.gameOver) {
      return;
    }

    this.tempsEcoule += 1;

    const minutes = Math.floor(this.tempsEcoule / 60);
    const secondes = this.tempsEcoule % 60;

    const mm = String(minutes).padStart(2, "0");
    const ss = String(secondes).padStart(2, "0");

    this.texteChrono.setText("Temps : " + mm + ":" + ss);
  }

  creerFlamme(xPosition) {
    if (this.gameOver) {
      return;
    }

    const flamme = this.groupeFlammes.create(xPosition, -30, "flamme");

    flamme.setScale(0.8);
    flamme.setDepth(900);
    flamme.body.setAllowGravity(false);
    flamme.setVelocityY(260);
    flamme.setVelocityX(Phaser.Math.Between(-20, 20));
  }

  creerVagueFlammes() {
    if (this.gameOver) {
      return;
    }

    const nombreFlammes = Phaser.Math.Between(4, 7);

    for (let i = 0; i < nombreFlammes; i++) {
      const xAleatoire = Phaser.Math.Between(50, 3750);

      this.time.delayedCall(i * 120, () => {
        this.creerFlamme(xAleatoire);
      }, null, this);
    }
  }

  declencherBourrasque() {
    if (this.gameOver) {
      return;
    }

    this.texteVent.setVisible(true);

    if (this.timerFinVent) {
      this.timerFinVent.remove(false);
    }

    if (this.estEnTrainDeGrimper) {
      this.forceVent = 0;
      this.ventActif = false;

      this.time.delayedCall(800, () => {
        if (!this.gameOver) {
          this.texteVent.setVisible(false);
        }
      }, null, this);

      return;
    }

    this.forceVent = -140;
    this.ventActif = true;
    this.player.setVelocityY(-20);

    this.timerFinVent = this.time.delayedCall(800, () => {
      this.ventActif = false;
      this.forceVent = 0;
      this.texteVent.setVisible(false);
    }, null, this);
  }

  estTuileEchelle(tile) {
    return tile && tile.properties && tile.properties.estEchelle === true;
  }

  recupererTuileEchelle() {
    const points = [
      { x: this.player.x, y: this.player.y },
      { x: this.player.x, y: this.player.y + 8 },
      { x: this.player.x, y: this.player.y + 16 },
      { x: this.player.x, y: this.player.y - 8 }
    ];

    for (let i = 0; i < points.length; i++) {
      const tile = this.calque_deco.getTileAtWorldXY(points[i].x, points[i].y, false);
      if (this.estTuileEchelle(tile)) {
        return tile;
      }
    }

    return null;
  }

  recupererTuileGlace() {
    const points = [
      { x: this.player.x, y: this.player.y + 18 },
      { x: this.player.x - 6, y: this.player.y + 18 },
      { x: this.player.x + 6, y: this.player.y + 18 }
    ];

    for (let i = 0; i < points.length; i++) {
      const tile = this.calque_plateforme.getTileAtWorldXY(points[i].x, points[i].y, false);

      if (tile && tile.properties && tile.properties.estGlace === true) {
        return tile;
      }
    }

    return null;
  }

  gererPlateformesFragiles() {
    const points = [
      { x: this.player.x, y: this.player.y + 18 },
      { x: this.player.x - 6, y: this.player.y + 18 },
      { x: this.player.x + 6, y: this.player.y + 18 }
    ];

    for (let i = 0; i < points.length; i++) {
      const tileFragile = this.calque_plateforme.getTileAtWorldXY(points[i].x, points[i].y, false);

      if (
        tileFragile &&
        tileFragile.properties &&
        tileFragile.properties.estFragile === true
      ) {
        const idTuile = tileFragile.x + "_" + tileFragile.y;

        if (!this.tuilesFragilesDeclenchees.includes(idTuile)) {
          this.tuilesFragilesDeclenchees.push(idTuile);

          this.tweens.add({
            targets: tileFragile,
            alpha: 0.6,
            x: tileFragile.pixelX + 2,
            duration: 60,
            yoyo: true,
            repeat: 5,
            onComplete: () => {
              this.time.delayedCall(150, () => {
                tileFragile.setCollision(false, false, false, false);
                tileFragile.visible = false;
                tileFragile.alpha = 0;
              }, null, this);
            }
          });
        }

        break;
      }
    }
  }

  nettoyerFlammes() {
    if (!this.groupeFlammes) {
      return;
    }

    this.groupeFlammes.children.each((flamme) => {
      if (flamme && flamme.y > 700) {
        flamme.destroy();
      }
    });
  }

  update() {
    if (this.gameOver) {
      return;
    }

    const toucheSaut = Phaser.Input.Keyboard.JustDown(this.clavier.up) ||
                      Phaser.Input.Keyboard.JustDown(this.clavier.space);

    if (this.player.body.blocked.down) {
      this.sautsRestants = this.nbSautsMax;
    }

    const tileEchelle = this.recupererTuileEchelle();
    const surEchelle = tileEchelle !== null;

    if (
      surEchelle &&
      !this.estEnTrainDeGrimper &&
      (this.clavier.up.isDown || this.clavier.down.isDown)
    ) {
      this.estEnTrainDeGrimper = true;
      this.player.body.allowGravity = false;
      this.player.setVelocityX(0);
      this.player.setVelocityY(0);

      const centreTuileX = tileEchelle.getCenterX();
      this.player.x = centreTuileX;
    }

    if (this.estEnTrainDeGrimper) {
      if (surEchelle) {
        const centreTuileX = tileEchelle.getCenterX();
        this.player.x = centreTuileX;
      }

      this.player.body.allowGravity = false;
      this.player.setVelocityX(0);
      this.vitesseHorizontale = 0;
      this.forceVent = 0;

      if (this.clavier.up.isDown) {
        this.player.setVelocityY(-this.vitesseEchelle);
      } else if (this.clavier.down.isDown) {
        this.player.setVelocityY(this.vitesseEchelle);
      } else {
        this.player.setVelocityY(0);
      }

      if (this.clavier.left.isDown) {
        this.player.anims.play("anim_tourne_gauche", true);
      } else if (this.clavier.right.isDown) {
        this.player.anims.play("anim_tourne_droite", true);
      } else {
        this.player.anims.play("anim_face", true);
      }

      if (toucheSaut) {
        this.estEnTrainDeGrimper = false;
        this.player.body.allowGravity = true;
        this.player.setVelocityY(-this.vitesseSaut);
        this.sautsRestants = 1;
        return;
      }

      if (Phaser.Input.Keyboard.JustDown(this.clavier.left)) {
        this.estEnTrainDeGrimper = false;
        this.player.body.allowGravity = true;
        this.player.setVelocityX(-this.vitesseMarche);
        return;
      }

      if (Phaser.Input.Keyboard.JustDown(this.clavier.right)) {
        this.estEnTrainDeGrimper = false;
        this.player.body.allowGravity = true;
        this.player.setVelocityX(this.vitesseMarche);
        return;
      }

      if (!surEchelle) {
        this.estEnTrainDeGrimper = false;
        this.player.body.allowGravity = true;
      }

      if (this.player.y > 600) {
        this.mourir("chute");
      }

      return;
    }

    this.player.body.allowGravity = true;

    const tileGlace = this.recupererTuileGlace();
    const surGlace = tileGlace !== null;

    let vitesseMax = this.vitesseMarcheNormale;
    let acceleration = this.accelerationSol;

    if (surGlace) {
      vitesseMax = this.vitesseMarcheGlace;
      acceleration = this.accelerationGlace;
    }

    if (this.clavier.left.isDown) {
      this.vitesseHorizontale -= acceleration;
      if (this.vitesseHorizontale < -vitesseMax) {
        this.vitesseHorizontale = -vitesseMax;
      }
      this.player.anims.play("anim_tourne_gauche", true);
    } else if (this.clavier.right.isDown) {
      this.vitesseHorizontale += acceleration;
      if (this.vitesseHorizontale > vitesseMax) {
        this.vitesseHorizontale = vitesseMax;
      }
      this.player.anims.play("anim_tourne_droite", true);
    } else {
      if (surGlace) {
        if (this.vitesseHorizontale > 0) {
          this.vitesseHorizontale -= 1;
          if (this.vitesseHorizontale < 0) {
            this.vitesseHorizontale = 0;
          }
        } else if (this.vitesseHorizontale < 0) {
          this.vitesseHorizontale += 1;
          if (this.vitesseHorizontale > 0) {
            this.vitesseHorizontale = 0;
          }
        }
      } else {
        this.vitesseHorizontale = 0;
      }

      this.player.anims.play("anim_face", true);
    }

    if (toucheSaut) {
      if (this.player.body.blocked.down) {
        this.player.setVelocityY(-this.vitesseSaut);
        this.sautsRestants = 1;
      } else if (this.sautsRestants > 0) {
        this.player.setVelocityY(-this.vitesseSaut);
        this.sautsRestants -= 1;
      }
    }

    if (!surGlace && !this.clavier.left.isDown && !this.clavier.right.isDown) {
      this.vitesseHorizontale = 0;
    }

    let vitesseFinaleX = this.vitesseHorizontale;

    if (this.ventActif) {
      vitesseFinaleX += this.forceVent;

      if (vitesseFinaleX > 0) {
        vitesseFinaleX = 0;
      }
    }

    this.player.setVelocityX(vitesseFinaleX);

    this.gererPlateformesFragiles();
    this.nettoyerFlammes();

    if (this.player.y > 600) {
      this.mourir("chute");
    }

    const procheLevier = this.physics.overlap(this.player, levierZone);
    const procheCoffre = this.physics.overlap(this.player, coffreZone);

    if (procheLevier && !levierActive) {
      texteInteraction.setText("Appuie sur E pour actionner le levier");
      texteInteraction.setVisible(true);
    } else if (procheCoffre && levierActive && !coffreOuvert) {
      texteInteraction.setText("Appuie sur E pour ouvrir le coffre");
      texteInteraction.setVisible(true);
    } else {
      texteInteraction.setVisible(false);
    }

    if (procheLevier && Phaser.Input.Keyboard.JustDown(keyE) && !levierActive) {
      activerLevier();
    }

    if (procheCoffre && levierActive && Phaser.Input.Keyboard.JustDown(keyE) && !coffreOuvert) {
      ouvrirCoffreEtDonnerEtoile.call(this);
    }
  }

  mourir(typeMort) {
    if (this.gameOver) return;

    this.gameOver = true;
    this.estEnTrainDeGrimper = false;
    this.ventActif = false;
    this.forceVent = 0;

    if (this.timerChrono) {
      this.timerChrono.paused = true;
    }

    if (this.timerVent) {
      this.timerVent.paused = true;
    }

    if (this.timerFlammes) {
      this.timerFlammes.paused = true;
    }

    if (this.timerFinVent) {
      this.timerFinVent.remove(false);
    }

    if (this.texteVent) {
      this.texteVent.setVisible(false);
    }

    if (this.groupeFlammes) {
      this.groupeFlammes.clear(true, true);
    }

    this.cameras.main.stopFollow();
    this.physics.pause();
    this.player.setTint(0xff0000);

    let ligne1 = "GAME OVER";
    let ligne2 = "Appuie sur ENTREE pour recommencer";

    if (typeMort === "branche") {
      ligne2 = "Ne touche pas les branches !";
    }

    if (typeMort === "flamme") {
      ligne2 = "Évite les flammes qui tombent du ciel !";
    }

    this.fondGameOver = this.add.rectangle(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2,
      700,
      140,
      0x000000,
      0.85
    );
    this.fondGameOver.setScrollFactor(0);
    this.fondGameOver.setDepth(9998);

    this.texteGameOver1 = this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2 - 25,
      ligne1,
      {
        fontSize: "40px",
        color: "#ff0000",
        align: "center"
      }
    );
    this.texteGameOver1.setOrigin(0.5, 0.5);
    this.texteGameOver1.setScrollFactor(0);
    this.texteGameOver1.setDepth(9999);

    this.texteGameOver2 = this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2 + 25,
      ligne2,
      {
        fontSize: "24px",
        color: "#ff0000",
        align: "center",
        wordWrap: { width: 640 }
      }
    );
    this.texteGameOver2.setOrigin(0.5, 0.5);
    this.texteGameOver2.setScrollFactor(0);
    this.texteGameOver2.setDepth(9999);

    this.input.keyboard.once("keydown-ENTER", () => {
      this.scene.restart();
    });
  }
}

function activerLevier() {
  levierActive = true;
  texteInteraction.setVisible(false);

  if (murBloquant) {
    murBloquant.setVisible(false);

    murBloquant.forEachTile((tile) => {
      if (tile) {
        tile.setCollision(false, false, false, false);
      }
    });
  }
}

function ouvrirCoffreEtDonnerEtoile() {
  coffreOuvert = true;

  const star = this.add.image(this.player.x, this.player.y - 20, "star");
  star.setScale(0.8);
  star.setDepth(1001);

  nbEtoiles += 1;
  texteEtoiles.setText("Nombre d'étoiles récupérées : " + nbEtoiles);

  this.tweens.add({
    targets: star,
    y: this.player.y - 60,
    alpha: 0,
    duration: 800,
    onComplete: () => {
      star.destroy();
    }
  });
}