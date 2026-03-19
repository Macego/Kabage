import * as fct from "./fonctions.js";

// ─────────────────────────────────────────────
// UTILITAIRES — Lecture des propriétés Tiled
// ─────────────────────────────────────────────

// Récupère la valeur d'une propriété sur une tuile Tiled
function getProp(tile, nom) {
  if (!tile?.properties) return undefined;
  if (Array.isArray(tile.properties)) {
    return tile.properties.find(p => p.name === nom)?.value;
  }
  return tile.properties[nom];
}

// Même chose mais pour un objet Tiled (couche d'objets)
function getPropObj(obj, nom) {
  if (!obj?.properties) return undefined;
  if (Array.isArray(obj.properties)) {
    return obj.properties.find(p => p.name === nom)?.value;
  }
  return obj.properties[nom];
}

// ─────────────────────────────────────────────
// SCÈNE PRINCIPALE — Niveau 2
// ─────────────────────────────────────────────

export default class niveau2 extends Phaser.Scene {
  constructor() {
    super({ key: "niveau2" });

    // Joueur et contrôles
    this.player = null;
    this.clavier = null;
    this.toucheEntree = null;

    // Position de départ du joueur
    this.spawnX = 640;
    this.spawnY = 480;

    // Calques de la carte Tiled
    this.map = null;
    this.layerFond = null;
    this.layerDecor = null;
    this.layerDecor2 = null;
    this.layerDecor3 = null;
    this.layerPlateforme = null;

    // Étoile à collecter pour gagner
    this.etoile = null;

    // Système de double saut
    this.nbSautsMax = 2;
    this.sautsRestants = 2;
    this.toucheSautRelachee = true;

    // États de la partie
    this.estMort = false;
    this.toucheRespawnRelachee = true;
    this.victoire = false;

    // Tuiles fragiles : sauvegarde pour le respawn
    this.tuilesFragilesData = [];
    this.tuilesFragilesDeclenchees = new Set();

    // GID (identifiants globaux) du tileset "pics"
    this.picFirstGid = -1;
    this.picLastGid = -1;

    // Boutons et obstacles mobiles
    this.boutons = [];
    this.mobiles = [];

    // Vitesse de chute maximale
    this.vitesseChutMax = 600;
  }

  // ───────────────────────────────────────────
  // PRÉCHARGEMENT des ressources
  // ───────────────────────────────────────────

  preload() {
    fct.doNothing();
    fct.doAlsoNothing();

    // Carte Tiled
    this.load.tilemapTiledJSON("mapkabage2", "src/assets/mapkabage2.0.json");

    // Images statiques (tuilesets et décors)
    this.load.image("niveau2_tileset_redim_img",  "src/assets/tileset redim.png");
    this.load.image("niveau2_forteress_redim_img","src/assets/forteress redim.png");
    this.load.image("niveau2_pic2_img",           "src/assets/pic2.0.png");
    this.load.image("niveau2_boutonhaut_img",     "src/assets/boutonhaut.png");
    this.load.image("niveau2_background_img",     "src/assets/background2.0.png");
    this.load.image("niveau2_star",               "src/assets/star.png");

    // Spritesheets (animations par frames)
    this.load.spritesheet("niveau2_forteress_sheet", "src/assets/forteress redim.png", { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("niveau2_img_perso",       "src/assets/dude.png",            { frameWidth: 32, frameHeight: 48 });
  }

  // ───────────────────────────────────────────
  // CRÉATION de la scène
  // ───────────────────────────────────────────

  create() {
    // Réinitialisation des états à chaque lancement de scène
    this.estMort = false;
    this.victoire = false;
    this.tuilesFragilesData = [];
    this.tuilesFragilesDeclenchees = new Set();
    this.boutons = [];
    this.mobiles = [];

    // ── Carte et tilesets ──
    this.map = this.make.tilemap({ key: "mapkabage2" });

    const tilesets = [];
    for (const [nom, cle] of [
      ["tileset redim",  "niveau2_tileset_redim_img"],
      ["forteress redim","niveau2_forteress_redim_img"],
      ["pic2.0",         "niveau2_pic2_img"],
      ["boutonhaut",     "niveau2_boutonhaut_img"],
    ]) {
      const ts = this.map.addTilesetImage(nom, cle);
      if (ts) tilesets.push(ts);
    }

    // On mémorise les GID du tileset "pics" pour détecter les collisions
    const tsPic = this.map.tilesets.find(ts => ts.name === "pic2.0");
    if (tsPic) {
      this.picFirstGid = tsPic.firstgid;
      this.picLastGid  = tsPic.firstgid + tsPic.total - 1;
    }

    // ── Fond d'écran (image répétée derrière tout) ──
    this.add.tileSprite(
      this.map.widthInPixels / 2,
      this.map.heightInPixels / 2,
      this.map.widthInPixels,
      this.map.heightInPixels,
      "niveau2_background_img"
    ).setDepth(-10);

    // ── Calques Tiled (ordre = profondeur d'affichage) ──
    this.layerFond      = this.creerCalque("fondecran",  tilesets, 0);
    this.layerDecor2    = this.creerCalque("decor2",     tilesets, 1);
    this.layerDecor3    = this.creerCalque("decor3",     tilesets, 2);
    this.layerPlateforme= this.creerCalque("plateforme", tilesets, 3);
    this.layerDecor     = this.creerCalque("decor",      tilesets, 5);

    // Collisions sur les calques de décor (propriétés Tiled)
    [this.layerDecor, this.layerDecor2, this.layerDecor3].forEach(layer => {
      layer?.setCollisionByProperty({ estSolide: true });
      layer?.setCollisionByProperty({ estFragile: true });
    });

    // Collisions manuelles sur "plateforme" (semi-solides traités à part)
    if (this.layerPlateforme) {
      this.layerPlateforme.forEachTile(tile => {
        if (!tile || tile.index === -1) return;
        if (getProp(tile, "estSemisolide")) {
          tile.setCollision(false, false, false, false); // on gère ça dans update()
        } else if (getProp(tile, "estSolide") || getProp(tile, "estFragile")) {
          tile.setCollision(true, true, true, true);
        }
      });
    }

    // Sauvegarde des tuiles fragiles pour pouvoir les restaurer au respawn
    [this.layerDecor, this.layerDecor2, this.layerDecor3, this.layerPlateforme].forEach(layer => {
      layer?.forEachTile(tile => {
        if (!tile || tile.index === -1 || !getProp(tile, "estFragile")) return;
        this.tuilesFragilesData.push({
          layer, x: tile.x, y: tile.y, index: tile.index,
          props: Array.isArray(tile.properties)
            ? tile.properties.map(p => ({ ...p }))
            : { ...tile.properties },
          collisions: [tile.collideLeft, tile.collideRight, tile.collideUp, tile.collideDown]
        });
      });
    });

    // Les tuiles "bouton" de Tiled sont remplacées par des sprites physiques
    this.supprimerTuilesBouton();

    // ── Joueur ──
    this.player = this.physics.add.sprite(this.spawnX, this.spawnY, "niveau2_img_perso");
    this.player.setScale(0.8).setBounce(0).setCollideWorldBounds(true).setDepth(10);
    this.player.body.setSize(16, 32).setOffset(8, 12);
    this.player.body.setGravityY(500).setMaxVelocityY(this.vitesseChutMax);

    // ── Contrôles clavier ──
    this.clavier     = this.input.keyboard.createCursorKeys();
    this.toucheEntree= this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);

    this.creerAnimations();

    // Collisions joueur ↔ calques
    [this.layerDecor, this.layerDecor2, this.layerDecor3, this.layerPlateforme].forEach(layer => {
      if (layer) this.physics.add.collider(this.player, layer);
    });

    // ── Étoile de victoire ──
    this.etoile = this.physics.add.staticSprite(208, 176, "niveau2_star").setDepth(10);
    this.tweens.add({ targets: this.etoile, angle: 360, duration: 2500, repeat: -1 });

    // ── Chargement des objets interactifs depuis Tiled ──
    this.chargerBoutons();
    this.chargerMobiles();

    // ── Interface (écran de mort + texte de victoire) ──
    this.creerEcranMort();
    this.creerTexteVictoire();

    // ── Caméra ──
    this.physics.world.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);
    this.cameras.main
      .setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels)
      .startFollow(this.player, true, 0.08, 0.08);
  }

  // ───────────────────────────────────────────
  // HELPERS de création
  // ───────────────────────────────────────────

  // Crée un calque Tiled s'il existe dans la carte
  creerCalque(nom, tilesets, profondeur) {
    if (!this.map.getLayer(nom)) return null;
    return this.map.createLayer(nom, tilesets, 0, 0).setDepth(profondeur);
  }

  // Retire les tuiles "boutonhaut" des calques (elles seront remplacées par des sprites)
  supprimerTuilesBouton() {
    const ts = this.map.tilesets.find(t => t.name === "boutonhaut");
    if (!ts) return;
    const [min, max] = [ts.firstgid, ts.firstgid + ts.total - 1];

    [this.layerDecor, this.layerDecor2, this.layerDecor3, this.layerPlateforme].forEach(layer => {
      layer?.forEachTile(tile => {
        if (tile && tile.index >= min && tile.index <= max)
          layer.removeTileAt(tile.x, tile.y);
      });
    });
  }

  // Charge les boutons depuis la couche d'objets Tiled "bouton"
  chargerBoutons() {
    const couche = this.map.getObjectLayer("bouton");
    if (!couche) return;

    couche.objects.forEach(obj => {
      if (obj.gid || !getPropObj(obj, "estBouton")) return;

      const [w, h] = [obj.width || 32, obj.height || 32];
      const sprite = this.physics.add
        .staticSprite(obj.x + w / 2, obj.y + h / 2, "niveau2_boutonhaut_img")
        .setDisplaySize(w, h).refreshBody().setDepth(6);

      this.boutons.push({ sprite, groupeID: getPropObj(obj, "groupeID") || 0, active: false });
    });
  }

  // Charge les obstacles mobiles (pics ou blocs) depuis la couche "pics_mobiles"
  chargerMobiles() {
    const couche = this.map.getObjectLayer("pics_mobiles");
    if (!couche) return;

    couche.objects.forEach(obj => {
      const groupeID = getPropObj(obj, "groupeID") || 0;
      const hauteur  = getPropObj(obj, "hauteurMontee") || 192;
      const type     = getPropObj(obj, "type") || "pic";
      const [w, h]   = [obj.width || 32, obj.height || 32];
      const bx       = obj.x + w / 2;
      const by       = obj.gid ? obj.y - h / 2 : obj.y + h / 2;

      let sprite;

      if (obj.gid) {
        // L'objet est une tuile Tiled : on retrouve son tileset pour choisir la bonne texture
        for (const ts of this.map.tilesets) {
          if (obj.gid >= ts.firstgid && obj.gid < ts.firstgid + ts.total) {
            const frame   = obj.gid - ts.firstgid;
            const texture = ts.name === "forteress redim" ? "niveau2_forteress_sheet" : "niveau2_pic2_img";
            sprite = this.physics.add.staticSprite(bx, by, texture, frame);
            break;
          }
        }
      } else {
        const texture = type === "bloc" ? "niveau2_forteress_sheet" : "niveau2_pic2_img";
        sprite = this.physics.add.staticSprite(bx, by, texture);
      }

      if (!sprite) return;
      sprite.setDisplaySize(w, h).refreshBody().setDepth(7);

      this.mobiles.push({
        sprite,
        baseY: by,
        targetY: by - hauteur,
        groupeID,
        active: false,
        estMortel: type === "pic"
      });
    });
  }

  // Active tous les obstacles d'un groupe (déclenché par un bouton)
  activerGroupe(groupeID) {
    this.mobiles
      .filter(m => m.groupeID === groupeID && !m.active)
      .forEach(m => {
        m.active = true;
        this.tweens.add({
          targets: m.sprite, y: m.targetY,
          duration: 20000, ease: "Linear",
          onUpdate: () => m.sprite.refreshBody()
        });
      });
  }

  // ───────────────────────────────────────────
  // LOGIQUE DE JEU — appelée dans update()
  // ───────────────────────────────────────────

  // Gère les plateformes semi-solides (on peut sauter dessus par le bas)
  gererSemiSolides() {
    if (!this.layerPlateforme || this.player.body.velocity.y < 0) return;

    const bas     = this.player.body.bottom;
    const basPrev = this.player.body.prev.y + this.player.body.height;
    const pointsX = [this.player.body.left + 2, this.player.body.center.x, this.player.body.right - 2];

    for (const px of pointsX) {
      const tile = this.layerPlateforme.getTileAtWorldXY(px, bas, true);
      if (!tile || tile.index === -1 || !getProp(tile, "estSemisolide")) continue;

      const topTuile = tile.pixelY;
      if (basPrev <= topTuile + 2 && bas >= topTuile) {
        // On pose le joueur sur la tuile et on simule qu'il touche le sol
        this.player.body.y = topTuile - this.player.body.height;
        this.player.body.velocity.y = 0;
        this.player.body.blocked.down = true;
        this.player.body.touching.down = true;
        return;
      }
    }
  }

  // Déclenche la chute d'une tuile fragile quand le joueur marche dessus
  gererFragile(layer) {
    if (!layer) return;

    const tile = layer.getTileAtWorldXY(this.player.body.center.x, this.player.body.bottom + 2, true);
    if (!tile || !getProp(tile, "estFragile")) return;

    const id = `${layer.layer.name}_${tile.x}_${tile.y}`;
    if (this.tuilesFragilesDeclenchees.has(id) || this.player.body.velocity.y < 0) return;

    this.tuilesFragilesDeclenchees.add(id);
    this.time.delayedCall(180, () => layer.removeTileAt(tile.x, tile.y));
  }

  // Vérifie si le joueur touche un pic dans un calque donné
  toucheUnPic(layer) {
    if (!layer || this.picFirstGid === -1) return false;

    // On teste plusieurs points autour du corps du joueur
    const points = [
      [this.player.body.center.x,  this.player.body.center.y],
      [this.player.body.center.x,  this.player.body.bottom - 2],
      [this.player.body.left  + 2, this.player.body.bottom - 2],
      [this.player.body.right - 2, this.player.body.bottom - 2],
      [this.player.body.left  + 2, this.player.body.center.y],
      [this.player.body.right - 2, this.player.body.center.y],
    ];

    return points.some(([px, py]) => {
      const tile = layer.getTileAtWorldXY(px, py, true);
      return tile && tile.index >= this.picFirstGid && tile.index <= this.picLastGid;
    });
  }

  // Vérifie si le joueur touche un obstacle mobile mortel
  toucheUnPicMobile() {
    return this.mobiles.some(m => m.estMortel && this.physics.overlap(this.player, m.sprite));
  }

  // ───────────────────────────────────────────
  // MORT et RESPAWN
  // ───────────────────────────────────────────

  mourir() {
    if (this.estMort || this.victoire) return;

    this.estMort = true;
    this.player.setVelocity(0, 0);
    this.player.body.setEnable(false);
    this.player.anims.play("niveau2_anim_face", true);

    // Flash blanc puis apparition de l'écran de mort
    this.cameras.main.flash(80, 255, 255, 255);
    this.time.delayedCall(80, () => {
      this.cameras.main.zoomTo(1.04, 800, "Linear");
      this.tweens.add({ targets: this.mortFond,   fillAlpha: 0.6,  duration: 600,               ease: "Power2" });
      this.tweens.add({ targets: this.mortBande,  fillAlpha: 0.85, duration: 300, delay: 300,   ease: "Power2" });
      this.mortTitre.setScale(1.3).setAlpha(0);
      this.tweens.add({ targets: this.mortTitre, alpha: 1, scaleX: 1, scaleY: 1, duration: 250, delay: 400, ease: "Power3" });
      this.tweens.add({ targets: this.mortSous,  alpha: 1,                        duration: 300, delay: 900, ease: "Power2" });
    });
  }

  respawn() {
    this.estMort = false;

    // On efface l'écran de mort
    this.cameras.main.zoomTo(1, 200, "Linear").flash(200, 255, 255, 255);
    this.tweens.killTweensOf([this.mortFond, this.mortBande, this.mortTitre, this.mortSous]);
    this.mortFond.fillAlpha  = 0;
    this.mortBande.fillAlpha = 0;
    this.mortTitre.setAlpha(0);
    this.mortSous.setAlpha(0);

    // Remise à zéro du joueur
    this.player.setPosition(this.spawnX, this.spawnY).setVelocity(0, 0).setAlpha(1);
    this.player.body.setEnable(true);
    this.sautsRestants = this.nbSautsMax;

    // Restauration des tuiles fragiles
    this.tuilesFragilesDeclenchees.clear();
    this.tuilesFragilesData.forEach(({ layer, x, y, index, props, collisions }) => {
      const tile = layer.putTileAt(index, x, y);
      if (!tile) return;
      tile.properties = Array.isArray(props) ? props.map(p => ({ ...p })) : { ...props };
      tile.setCollision(...collisions);
    });

    // Remise à zéro des boutons et obstacles mobiles
    this.boutons.forEach(b => { b.active = false; });
    this.mobiles.forEach(m => {
      m.active = false;
      this.tweens.killTweensOf(m.sprite);
      m.sprite.y = m.baseY;
      m.sprite.refreshBody();
    });
  }

  // ───────────────────────────────────────────
  // INTERFACE UTILISATEUR
  // ───────────────────────────────────────────

  creerEcranMort() {
    const [W, H] = [this.cameras.main.width, this.cameras.main.height];

    // Fondu noir derrière
    this.mortFond  = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0).setDepth(98).setScrollFactor(0);
    // Bande sombre au centre
    this.mortBande = this.add.rectangle(W / 2, H / 2, W, 90, 0x111111, 0).setDepth(99).setScrollFactor(0);

    // Titre "RATÉ"
    this.mortTitre = this.add.text(W / 2, H / 2, "RATÉ", {
      fontSize: "72px", fontStyle: "bold",
      fontFamily: "Arial Black, Impact, sans-serif",
      fill: "#cc2200", stroke: "#000000", strokeThickness: 4
    }).setOrigin(0.5).setDepth(100).setScrollFactor(0).setAlpha(0);

    // Sous-titre (instruction)
    this.mortSous = this.add.text(W / 2, H / 2 + 56, "[ ENTRÉE ] pour réapparaître", {
      fontSize: "16px", fontFamily: "Arial, sans-serif", fill: "#aaaaaa"
    }).setOrigin(0.5).setDepth(100).setScrollFactor(0).setAlpha(0);
  }

  creerTexteVictoire() {
    this.texteVictoire = this.add.text(400, 100, "BRAVO VOUS AVEZ GAGNÉ", {
      fontSize: "32px", fill: "#ffff00", fontStyle: "bold",
      stroke: "#000000", strokeThickness: 4
    }).setOrigin(0.5).setScrollFactor(0).setDepth(200).setAlpha(0);
  }

  creerAnimations() {
    // Marche gauche (frames 0 à 3)
    if (!this.anims.exists("niveau2_anim_tourne_gauche"))
      this.anims.create({ key: "niveau2_anim_tourne_gauche", frames: this.anims.generateFrameNumbers("niveau2_img_perso", { start: 0, end: 3 }), frameRate: 10, repeat: -1 });

    // Idle (frame 4)
    if (!this.anims.exists("niveau2_anim_face"))
      this.anims.create({ key: "niveau2_anim_face", frames: [{ key: "niveau2_img_perso", frame: 4 }], frameRate: 20 });

    // Marche droite (frames 5 à 8)
    if (!this.anims.exists("niveau2_anim_tourne_droite"))
      this.anims.create({ key: "niveau2_anim_tourne_droite", frames: this.anims.generateFrameNumbers("niveau2_img_perso", { start: 5, end: 8 }), frameRate: 10, repeat: -1 });
  }

  // ───────────────────────────────────────────
  // BOUCLE PRINCIPALE
  // ───────────────────────────────────────────

  update() {
    if (!this.player || !this.clavier || !this.toucheEntree) return;
    if (this.victoire) return;

    // ── Gestion de la mort (attente de la touche Entrée pour respawn) ──
    if (this.estMort) {
      if (this.toucheEntree.isDown && this.toucheRespawnRelachee) {
        this.toucheRespawnRelachee = false;
        this.respawn();
      }
      if (this.toucheEntree.isUp) this.toucheRespawnRelachee = true;
      return;
    }

    // ── Plateformes semi-solides ──
    this.gererSemiSolides();

    // ── Double saut : on recharge les sauts quand on touche le sol ──
    if (this.player.body.blocked.down) this.sautsRestants = this.nbSautsMax;

    // ── Déplacements horizontaux ──
    if (this.clavier.left.isDown) {
      this.player.setVelocityX(-160);
      this.player.anims.play("niveau2_anim_tourne_gauche", true);
    } else if (this.clavier.right.isDown) {
      this.player.setVelocityX(160);
      this.player.anims.play("niveau2_anim_tourne_droite", true);
    } else {
      this.player.setVelocityX(0);
      this.player.anims.play("niveau2_anim_face", true);
    }

    // ── Saut (avec anti-répétition : on doit relâcher avant de resauter) ──
    if (this.clavier.up.isDown && this.toucheSautRelachee && this.sautsRestants > 0) {
      this.player.setVelocityY(-330);
      this.sautsRestants--;
      this.toucheSautRelachee = false;
    }
    if (this.clavier.up.isUp) this.toucheSautRelachee = true;

    // ── Plafonnement de la vitesse de chute ──
    if (this.player.body.velocity.y > this.vitesseChutMax)
      this.player.body.setVelocityY(this.vitesseChutMax);

    // ── Tuiles fragiles ──
    [this.layerDecor, this.layerDecor2, this.layerDecor3, this.layerPlateforme]
      .forEach(layer => this.gererFragile(layer));

    // ── Boutons (activation unique au contact) ──
    this.boutons.forEach(b => {
      if (!b.active && this.physics.overlap(this.player, b.sprite)) {
        b.active = true;
        this.activerGroupe(b.groupeID);
      }
    });

    // ── Détection des pics → mort ──
    const touchePic =
      [this.layerPlateforme, this.layerDecor, this.layerDecor2, this.layerDecor3]
        .some(l => this.toucheUnPic(l))
      || this.toucheUnPicMobile();

    if (touchePic) { this.mourir(); return; }

    // ── Étoile → victoire ──
    if (this.physics.overlap(this.player, this.etoile)) {
      this.victoire = true;
      this.player.setVelocity(0, 0);
      this.player.body.setEnable(false);
      this.etoile.setVisible(false);
      this.texteVictoire.setAlpha(1);
      this.time.delayedCall(2000, () => this.scene.start("menu"));
    }
  }
}