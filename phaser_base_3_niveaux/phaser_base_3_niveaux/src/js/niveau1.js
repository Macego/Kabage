import * as fct from "./fonctions.js";

// ─────────────────────────────────────────────
// VARIABLES GLOBALES — partagées entre la scène et les fonctions externes
// ─────────────────────────────────────────────

let keyE;            // Touche E (interaction)
let levierZone;      // Zone de déclenchement du levier
let coffreZone;      // Zone de déclenchement du coffre
let murBloquant;     // Calque mur supprimé quand le levier est activé
let texteInteraction;// Bulle d'aide contextuelle

let levierActive = false;
let coffreOuvert = false;

// ─────────────────────────────────────────────
// SCÈNE PRINCIPALE — Niveau 1
// ─────────────────────────────────────────────

export default class niveau1 extends Phaser.Scene {
  constructor() {
    super({ key: "niveau1" });

    // Timers
    this.timerChrono   = null;
    this.timerVent     = null;
    this.timerFinVent  = null;
    this.timerFlammes  = null;

    // Chronomètre
    this.tempsEcoule = 0;
    this.texteChrono = null;

    // Vent
    this.texteVent  = null;
    this.ventActif  = false;
    this.forceVent  = 0;

    // Plateformes fragiles déjà déclenchées
    this.tuilesFragilesDeclenchees = [];

    // Double saut
    this.nbSautsMax   = 2;
    this.sautsRestants= 2;

    // Flammes tombantes et sol enflammé
    this.groupeFlammes    = null;
    this.groupeFlammesSol = null;
    this.solsEnflammes    = {};

    this.niveauTermine = false;
  }

  // ───────────────────────────────────────────
  // PRÉCHARGEMENT des ressources
  // ───────────────────────────────────────────

  preload() {
    fct.doNothing();
    fct.doAlsoNothing();

    this.load.spritesheet("img_perso", "src/assets/dude.png", { frameWidth: 32, frameHeight: 48 });
    this.load.tilemapTiledJSON("mapkabage", "src/assets/mapkabage.json");

    // Tilesets de la carte
    for (const [nom, fichier] of [
      ["ts_layer_back",           "src/assets/layer.back.png"],
      ["ts_layer_back01",         "src/assets/layer.back01.png"],
      ["ts_ground_tiles",         "src/assets/Ground Tiles.png"],
      ["ts_game_objects",         "src/assets/Game Objects Tiles.png"],
      ["ts_tileset",              "src/assets/TileSet.png"],
      ["ts_tilesheet_dungeon",    "src/assets/tilesheet_dungeon.png"],
      ["ts_tilesheet_grass",      "src/assets/tilesheet_grass.png"],
      ["ts_tilesheet_grass_bg",   "src/assets/tilesheet_grass-bg.png"],
      ["ts_tilesheet_ice",        "src/assets/tilesheet_ice.png"],
      ["ts_tilesheet_pagoda",     "src/assets/tilesheet_pagoda.png"],
      ["ts_tilesheet_snow",       "src/assets/tilesheet_snow.png"],
    ]) {
      this.load.image(nom, fichier);
    }

    this.load.image("star",   "src/assets/star.png");
    this.load.image("flamme", "src/assets/flamme.png");
  }

  // ───────────────────────────────────────────
  // CRÉATION de la scène
  // ───────────────────────────────────────────

  create() {
    // Réinitialisation des états
    this.gameOver         = false;
    this.niveauTermine    = false;
    this.estEnTrainDeGrimper = false;

    levierActive = false;
    coffreOuvert = false;

    // Vitesses de déplacement
    this.vitesseMarche        = 160;
    this.vitesseSaut          = 225;
    this.vitesseEchelle       = 120;
    this.vitesseMarcheNormale = 160;
    this.vitesseMarcheGlace   = 260;
    this.accelerationSol      = 12;
    this.accelerationGlace    = 3;
    this.vitesseHorizontale   = 0;

    // Remise à zéro du vent, du chrono et des plateformes
    this.ventActif = false;
    this.forceVent = 0;
    this.tempsEcoule = 0;
    this.tuilesFragilesDeclenchees = [];
    this.sautsRestants = this.nbSautsMax;
    this.solsEnflammes = {};

    this.cameras.main.setZoom(1);

    // ── Carte et tilesets ──
    const carte = this.make.tilemap({ key: "mapkabage" });

    const tousLesTilesets = [
      ["layer.back",       "ts_layer_back"],
      ["layer.back01",     "ts_layer_back01"],
      ["Ground Tiles",     "ts_ground_tiles"],
      ["Game Objects Tiles","ts_game_objects"],
      ["TileSet",          "ts_tileset"],
      ["tilesheet_dungeon","ts_tilesheet_dungeon"],
      ["tilesheet_grass",  "ts_tilesheet_grass"],
      ["tilesheet_grass-bg","ts_tilesheet_grass_bg"],
      ["tilesheet_ice",    "ts_tilesheet_ice"],
      ["tilesheet_pagoda", "ts_tilesheet_pagoda"],
      ["tilesheet_snow",   "ts_tilesheet_snow"],
    ]
      .map(([nom, cle]) => carte.addTilesetImage(nom, cle))
      .filter(Boolean);

    // ── Calques Tiled ──
    carte.createLayer("ciel",       tousLesTilesets, 0, 0);
    carte.createLayer("background", tousLesTilesets, 0, 0);
    this.calque_plateforme = carte.createLayer("plateforme",  tousLesTilesets, 0, 0);
    this.calque_mur_coffre = carte.createLayer("mur_coffre",  tousLesTilesets, 0, 0);
    this.calque_deco       = carte.createLayer("déco",        tousLesTilesets, 0, 0);

    // ── Joueur ──
    this.player = this.physics.add.sprite(25, 25, "img_perso");
    this.player.setScale(0.5).setBounce(0.1).setCollideWorldBounds(false);
    this.player.body.setSize(20, 30).setOffset(6, 18);

    // ── Collisions ──
    this.calque_plateforme.setCollisionByProperty({ estSolide: true });

    // Si le joueur touche une tuile mortelle, il meurt
    this.physics.add.collider(this.player, this.calque_plateforme, (player, tile) => {
      if (tile?.properties?.estMortel) this.mourir("branche");
    });

    if (this.calque_mur_coffre) {
      this.calque_mur_coffre.setCollisionByProperty({ estSolide: true });
      murBloquant = this.calque_mur_coffre;
      this.physics.add.collider(this.player, this.calque_mur_coffre);
    }

    // ── Flammes ──
    this.groupeFlammes    = this.physics.add.group();
    this.groupeFlammesSol = this.add.group();

    // Contact joueur + flamme → mort
    this.physics.add.overlap(this.player, this.groupeFlammes, () => this.mourir("flamme"));

    // Flamme qui touche le sol → elle se transforme en flamme au sol
    this.physics.add.collider(this.groupeFlammes, this.calque_plateforme, (flamme, tile) => {
      if (flamme && tile) { this.creerFlammeSol(tile); flamme.destroy(); }
    });

    // Flamme qui touche le mur → détruite
    if (this.calque_mur_coffre) {
      this.physics.add.collider(this.groupeFlammes, this.calque_mur_coffre, (flamme) => {
        flamme?.destroy();
      });
    }

    // ── Caméra et monde ──
    this.physics.world.setBounds(0, 0, 3800, 500);
    this.cameras.main
      .setBounds(0, 0, 3800, 500)
      .startFollow(this.player)
      .setBackgroundColor("#87CEEB");

    // ── Animations du personnage ──
    this.anims.create({ key: "anim_tourne_gauche", frames: this.anims.generateFrameNumbers("img_perso", { start: 0, end: 3 }), frameRate: 10, repeat: -1 });
    this.anims.create({ key: "anim_face",          frames: [{ key: "img_perso", frame: 4 }],                                   frameRate: 20 });
    this.anims.create({ key: "anim_tourne_droite", frames: this.anims.generateFrameNumbers("img_perso", { start: 5, end: 8 }), frameRate: 10, repeat: -1 });

    // ── Contrôles ──
    this.clavier = this.input.keyboard.createCursorKeys();
    keyE = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);

    // ── Zones d'interaction (levier et coffre) ──
    levierZone = this.creerZoneStatique(3475, 452, 50, 50);
    coffreZone = this.creerZoneStatique(3547, 475, 60, 60);

    // ── Interface ──
    texteInteraction = this.add.text(12, 44, "", {
      fontSize: "14px", color: "#ffffff", backgroundColor: "#000000",
      padding: { x: 6, y: 4 }
    }).setScrollFactor(0).setDepth(1000).setVisible(false);

    this.texteChrono = this.add.text(12, 12, "Temps : 00:00", {
      fontSize: "16px", color: "#ffffff", backgroundColor: "#000000",
      padding: { x: 6, y: 4 }
    }).setScrollFactor(0).setDepth(1000);

    this.texteVent = this.add.text(400, 40, "Attention : bourrasque de vent !", {
      fontSize: "24px", color: "#ffffff", backgroundColor: "#b22222",
      padding: { x: 10, y: 6 }
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(1001).setVisible(false);

    // ── Timers répétitifs ──
    this.timerChrono  = this.time.addEvent({ delay: 1000,  callback: this.mettreAJourChrono,   callbackScope: this, repeat: -1 });
    this.timerVent    = this.time.addEvent({ delay: 10000, callback: this.declencherBourrasque, callbackScope: this, repeat: -1 });
    this.timerFlammes = this.time.addEvent({ delay: 15000, callback: this.creerVagueFlammes,    callbackScope: this, repeat: -1 });
  }

  // Crée une zone physique statique (sans gravité, sans mouvement)
  creerZoneStatique(x, y, w, h) {
    const zone = this.add.zone(x, y, w, h);
    this.physics.world.enable(zone);
    zone.body.setAllowGravity(false);
    zone.body.moves = false;
    return zone;
  }

  // ───────────────────────────────────────────
  // CHRONOMÈTRE
  // ───────────────────────────────────────────

  mettreAJourChrono() {
    if (this.gameOver || this.niveauTermine) return;

    this.tempsEcoule++;
    const mm = String(Math.floor(this.tempsEcoule / 60)).padStart(2, "0");
    const ss = String(this.tempsEcoule % 60).padStart(2, "0");
    this.texteChrono.setText(`Temps : ${mm}:${ss}`);
  }

  // ───────────────────────────────────────────
  // FLAMMES
  // ───────────────────────────────────────────

  // Fait tomber une flamme depuis le haut à la position X donnée
  creerFlamme(x) {
    if (this.gameOver || this.niveauTermine) return;

    const flamme = this.groupeFlammes.create(x, -30, "flamme");
    flamme.setScale(0.8).setDepth(900).setImmovable(true);
    flamme.body.setAllowGravity(false);
    flamme.setVelocityY(260).setVelocityX(Phaser.Math.Between(-20, 20));
  }

  // Crée une flamme persistante sur le sol quand une flamme tombante atterrit
  creerFlammeSol(tile) {
    if (!tile || this.gameOver || this.niveauTermine) return;

    const idTuile = `${tile.x}_${tile.y}`;
    if (this.solsEnflammes[idTuile]) return; // déjà enflammé

    const flammeSol = this.add.image(tile.getCenterX(), tile.pixelY + tile.height / 2, "flamme");
    flammeSol.setScale(0.9, 0.5).setDepth(950);
    this.solsEnflammes[idTuile] = { sprite: flammeSol, x: tile.x, y: tile.y };
    this.groupeFlammesSol.add(flammeSol);

    // Clignotement infini
    this.tweens.add({ targets: flammeSol, alpha: 0.6, duration: 250, yoyo: true, repeat: -1 });
  }

  // Vérifie si le joueur marche sur une tuile enflammée
  verifierSolEnflammeSousJoueur() {
    const pointsSous = [
      { x: this.player.x,     y: this.player.y + 18 },
      { x: this.player.x - 6, y: this.player.y + 18 },
      { x: this.player.x + 6, y: this.player.y + 18 },
    ];

    for (const pt of pointsSous) {
      const tuile = this.calque_plateforme.getTileAtWorldXY(pt.x, pt.y, false);
      if (tuile && this.solsEnflammes[`${tuile.x}_${tuile.y}`]) {
        this.mourir("flammeSol");
        return;
      }
    }
  }

  // Lance une vague de flammes autour du joueur
  creerVagueFlammes() {
    if (this.gameOver || this.niveauTermine) return;

    const nb = Phaser.Math.Between(4, 7);
    for (let i = 0; i < nb; i++) {
      // On clampe la position X dans les limites du monde
      const x = Phaser.Math.Clamp(
        Phaser.Math.Between(this.player.x - 250, this.player.x + 250),
        30, 3770
      );
      this.time.delayedCall(i * 120, () => this.creerFlamme(x));
    }
  }

  // Supprime les flammes tombantes qui ont dépassé le bas de l'écran
  nettoyerFlammes() {
    this.groupeFlammes?.children.each(flamme => {
      if (flamme?.y > 700) flamme.destroy();
    });
  }

  // ───────────────────────────────────────────
  // VENT
  // ───────────────────────────────────────────

  declencherBourrasque() {
    if (this.gameOver || this.niveauTermine) return;

    this.texteVent.setVisible(true);
    this.timerFinVent?.remove(false);

    // Le vent n'a aucun effet quand le joueur est sur une échelle
    if (this.estEnTrainDeGrimper) {
      this.forceVent = 0;
      this.ventActif = false;
      this.time.delayedCall(800, () => {
        if (!this.gameOver && !this.niveauTermine) this.texteVent.setVisible(false);
      });
      return;
    }

    // Pousse le joueur vers la gauche pendant 800 ms
    this.ventActif = true;
    this.forceVent = -140;
    this.player.setVelocityY(-20);

    this.timerFinVent = this.time.delayedCall(800, () => {
      this.ventActif = false;
      this.forceVent = 0;
      this.texteVent.setVisible(false);
    });
  }

  // ───────────────────────────────────────────
  // DÉTECTION — Échelles, glace, tuiles fragiles
  // ───────────────────────────────────────────

  // Renvoie true si la tuile est une échelle
  estTuileEchelle(tile) {
    return tile?.properties?.estEchelle === true;
  }

  // Retourne la tuile d'échelle sous le joueur (ou null)
  recupererTuileEchelle() {
    const points = [
      { x: this.player.x, y: this.player.y      },
      { x: this.player.x, y: this.player.y + 8  },
      { x: this.player.x, y: this.player.y + 16 },
      { x: this.player.x, y: this.player.y - 8  },
    ];
    for (const pt of points) {
      const tile = this.calque_deco.getTileAtWorldXY(pt.x, pt.y, false);
      if (this.estTuileEchelle(tile)) return tile;
    }
    return null;
  }

  // Retourne la tuile de glace sous le joueur (ou null)
  recupererTuileGlace() {
    const points = [
      { x: this.player.x,     y: this.player.y + 18 },
      { x: this.player.x - 6, y: this.player.y + 18 },
      { x: this.player.x + 6, y: this.player.y + 18 },
    ];
    for (const pt of points) {
      const tile = this.calque_plateforme.getTileAtWorldXY(pt.x, pt.y, false);
      if (tile?.properties?.estGlace === true) return tile;
    }
    return null;
  }

  // Déclenche l'animation de chute des tuiles fragiles sous le joueur
  gererPlateformesFragiles() {
    const points = [
      { x: this.player.x,     y: this.player.y + 18 },
      { x: this.player.x - 6, y: this.player.y + 18 },
      { x: this.player.x + 6, y: this.player.y + 18 },
    ];

    for (const pt of points) {
      const tile = this.calque_plateforme.getTileAtWorldXY(pt.x, pt.y, false);
      if (!tile?.properties?.estFragile) continue;

      const id = `${tile.x}_${tile.y}`;
      if (this.tuilesFragilesDeclenchees.includes(id)) break;

      this.tuilesFragilesDeclenchees.push(id);

      // Vibration puis disparition
      this.tweens.add({
        targets: tile, alpha: 0.6, x: tile.pixelX + 2,
        duration: 60, yoyo: true, repeat: 5,
        onComplete: () => {
          this.time.delayedCall(150, () => {
            tile.setCollision(false, false, false, false);
            tile.visible = false;
            tile.alpha = 0;
          });
        }
      });
      break;
    }
  }

  // ───────────────────────────────────────────
  // FIN DE NIVEAU — Victoire
  // ───────────────────────────────────────────

  gagnerNiveau() {
    if (this.gameOver || this.niveauTermine) return;

    this.niveauTermine = true;
    this.arreterTimers();
    this.ventActif = false;
    this.forceVent = 0;
    this.texteVent.setVisible(false);
    this.groupeFlammes?.clear(true, true);
    this.groupeFlammesSol?.clear(true, true);

    this.physics.pause();
    this.player.setTint(0x00ff00);

    const mm = String(Math.floor(this.tempsEcoule / 60)).padStart(2, "0");
    this.afficherEcranFin("NIVEAU GAGNÉ", `Terminé en ${mm}:${String(this.tempsEcoule % 60).padStart(2, "0")}`, "#00ff00");

    this.time.delayedCall(2500, () => this.scene.start("menu"));
  }

  // ───────────────────────────────────────────
  // FIN DE NIVEAU — Mort
  // ───────────────────────────────────────────

  mourir(typeMort) {
    if (this.gameOver || this.niveauTermine) return;

    this.gameOver = true;
    this.estEnTrainDeGrimper = false;
    this.ventActif = false;
    this.forceVent = 0;

    this.arreterTimers();
    this.texteVent?.setVisible(false);
    this.groupeFlammes?.clear(true, true);
    this.groupeFlammesSol?.clear(true, true);

    this.cameras.main.stopFollow();
    this.physics.pause();
    this.player.setTint(0xff0000);

    // Message contextuel selon la cause de mort
    const messages = {
      branche:   "Ne touche pas les branches !",
      flamme:    "Évite les flammes qui tombent du ciel !",
      flammeSol: "Ne marche pas sur le sol enflammé !",
    };
    const sous = messages[typeMort] || "Appuie sur ENTREE pour recommencer";

    this.afficherEcranFin("GAME OVER", sous, "#ff0000");

    // Redémarre la scène sur pression d'Entrée
    this.input.keyboard.once("keydown-ENTER", () => this.scene.restart());
  }

  // ── Helper : affiche le panneau de fin (mort ou victoire) ──
  afficherEcranFin(titre, sousTitre, couleur) {
    const [W, H] = [this.cameras.main.width, this.cameras.main.height];

    this.add.rectangle(W / 2, H / 2, 760, 160, 0x000000, 0.85)
      .setScrollFactor(0).setDepth(9998);

    this.add.text(W / 2, H / 2 - 25, titre, { fontSize: "40px", color: couleur, align: "center" })
      .setOrigin(0.5).setScrollFactor(0).setDepth(9999);

    this.add.text(W / 2, H / 2 + 25, sousTitre, { fontSize: "26px", color: couleur, align: "center", wordWrap: { width: 640 } })
      .setOrigin(0.5).setScrollFactor(0).setDepth(9999);
  }

  // ── Helper : met en pause tous les timers actifs ──
  arreterTimers() {
    if (this.timerChrono)  this.timerChrono.paused  = true;
    if (this.timerVent)    this.timerVent.paused     = true;
    if (this.timerFlammes) this.timerFlammes.paused  = true;
    this.timerFinVent?.remove(false);
  }

  // ───────────────────────────────────────────
  // BOUCLE PRINCIPALE
  // ───────────────────────────────────────────

  update() {
    if (this.gameOver || this.niveauTermine) return;

    const toucheSaut =
      Phaser.Input.Keyboard.JustDown(this.clavier.up) ||
      Phaser.Input.Keyboard.JustDown(this.clavier.space);

    // Recharge les sauts quand le joueur touche le sol
    if (this.player.body.blocked.down) this.sautsRestants = this.nbSautsMax;

    const tileEchelle = this.recupererTuileEchelle();
    const surEchelle  = tileEchelle !== null;

    // ── MODE ÉCHELLE ──
    if (surEchelle && !this.estEnTrainDeGrimper && (this.clavier.up.isDown || this.clavier.down.isDown)) {
      this.estEnTrainDeGrimper = true;
      this.player.body.allowGravity = false;
      this.player.setVelocityX(0).setVelocityY(0);
      this.player.x = tileEchelle.getCenterX(); // centrage sur l'échelle
    }

    if (this.estEnTrainDeGrimper) {
      // On reste centré sur l'échelle tant qu'on y est
      if (surEchelle) this.player.x = tileEchelle.getCenterX();

      this.player.body.allowGravity = false;
      this.player.setVelocityX(0);
      this.vitesseHorizontale = 0;
      this.forceVent = 0;

      // Monter / descendre
      if      (this.clavier.up.isDown)   this.player.setVelocityY(-this.vitesseEchelle);
      else if (this.clavier.down.isDown) this.player.setVelocityY(this.vitesseEchelle);
      else                               this.player.setVelocityY(0);

      // Animation selon la direction regardée
      if      (this.clavier.left.isDown)  this.player.anims.play("anim_tourne_gauche", true);
      else if (this.clavier.right.isDown) this.player.anims.play("anim_tourne_droite", true);
      else                                this.player.anims.play("anim_face", true);

      // Saut depuis l'échelle
      if (toucheSaut) {
        this.estEnTrainDeGrimper = false;
        this.player.body.allowGravity = true;
        this.player.setVelocityY(-this.vitesseSaut);
        this.sautsRestants = 1;
        return;
      }

      // Sortie par la gauche ou la droite
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

      // Quitte automatiquement l'échelle si le joueur n'est plus dessus
      if (!surEchelle) {
        this.estEnTrainDeGrimper = false;
        this.player.body.allowGravity = true;
      }

      if (this.player.y > 600) this.mourir("chute");
      return;
    }

    // ── MODE NORMAL ──
    this.player.body.allowGravity = true;

    const surGlace    = this.recupererTuileGlace() !== null;
    const vitesseMax  = surGlace ? this.vitesseMarcheGlace   : this.vitesseMarcheNormale;
    const acceleration= surGlace ? this.accelerationGlace    : this.accelerationSol;

    // Déplacements horizontaux avec inertie (glace) ou arrêt immédiat (sol normal)
    if (this.clavier.left.isDown) {
      this.vitesseHorizontale = Math.max(this.vitesseHorizontale - acceleration, -vitesseMax);
      this.player.anims.play("anim_tourne_gauche", true);
    } else if (this.clavier.right.isDown) {
      this.vitesseHorizontale = Math.min(this.vitesseHorizontale + acceleration,  vitesseMax);
      this.player.anims.play("anim_tourne_droite", true);
    } else {
      // Sur glace : décélération progressive ; sinon : arrêt net
      if (surGlace) {
        this.vitesseHorizontale = Math.sign(this.vitesseHorizontale)
          * Math.max(Math.abs(this.vitesseHorizontale) - 1, 0);
      } else {
        this.vitesseHorizontale = 0;
      }
      this.player.anims.play("anim_face", true);
    }

    // Saut (simple ou double)
    if (toucheSaut) {
      if (this.player.body.blocked.down) {
        this.player.setVelocityY(-this.vitesseSaut);
        this.sautsRestants = 1;
      } else if (this.sautsRestants > 0) {
        this.player.setVelocityY(-this.vitesseSaut);
        this.sautsRestants--;
      }
    }

    // Application du vent (pousse vers la gauche et bloque vers la droite)
    let vitesseFinaleX = this.vitesseHorizontale;
    if (this.ventActif) vitesseFinaleX = Math.min(vitesseFinaleX + this.forceVent, 0);

    this.player.setVelocityX(vitesseFinaleX);

    // ── Vérifications chaque frame ──
    this.gererPlateformesFragiles();
    this.nettoyerFlammes();
    this.verifierSolEnflammeSousJoueur();

    if (this.player.y > 600) { this.mourir("chute"); return; }

    // ── Interactions levier / coffre ──
    const procheLevier = this.physics.overlap(this.player, levierZone);
    const procheCoffre = this.physics.overlap(this.player, coffreZone);

    if      (procheLevier && !levierActive)                    texteInteraction.setText("Appuie sur E pour actionner le levier").setVisible(true);
    else if (procheCoffre && levierActive && !coffreOuvert)    texteInteraction.setText("Appuie sur E pour ouvrir le coffre").setVisible(true);
    else                                                       texteInteraction.setVisible(false);

    if (procheLevier && !levierActive && Phaser.Input.Keyboard.JustDown(keyE))
      activerLevier();

    if (procheCoffre && levierActive && !coffreOuvert && Phaser.Input.Keyboard.JustDown(keyE))
      ouvrirCoffreEtFinirNiveau.call(this);
  }
}

// ─────────────────────────────────────────────
// FONCTIONS EXTERNES — Levier et coffre
// (définies hors de la classe car elles utilisent des variables globales)
// ─────────────────────────────────────────────

// Active le levier : rend le mur invisible et non-solide
function activerLevier() {
  levierActive = true;
  texteInteraction.setVisible(false);

  if (murBloquant) {
    murBloquant.setVisible(false);
    murBloquant.forEachTile(tile => tile?.setCollision(false, false, false, false));
  }
}

// Ouvre le coffre, affiche une étoile puis lance la victoire
function ouvrirCoffreEtFinirNiveau() {
  coffreOuvert = true;

  const star = this.add.image(this.player.x, this.player.y - 20, "star")
    .setScale(0.8).setDepth(1001);

  this.tweens.add({
    targets: star, y: this.player.y - 60, alpha: 0, duration: 800,
    onComplete: () => { star.destroy(); this.gagnerNiveau(); }
  });
}