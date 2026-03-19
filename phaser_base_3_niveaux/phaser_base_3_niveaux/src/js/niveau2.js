import * as fct from "./fonctions.js";

// Lit une propriété Tiled sur une tuile
function getProp(tile, nom) {
  if (!tile || !tile.properties) return undefined;
  if (Array.isArray(tile.properties)) {
    const p = tile.properties.find(p => p.name === nom);
    return p ? p.value : undefined;
  }
  return tile.properties[nom];
}

// Pareil mais pour les objets Tiled
function getPropObj(obj, nom) {
  if (!obj || !obj.properties) return undefined;
  if (Array.isArray(obj.properties)) {
    const p = obj.properties.find(p => p.name === nom);
    return p ? p.value : undefined;
  }
  return obj.properties[nom];
}

export default class niveau2 extends Phaser.Scene {
  constructor() {
    super({ key: "niveau2" });

    this.player = null;
    this.clavier = null;
    this.spawnX = 640;
    this.spawnY = 480;

    this.map = null;
    this.layerFond = null;
    this.layerDecor = null;
    this.layerDecor2 = null;
    this.layerDecor3 = null;
    this.layerPlateforme = null;

    this.etoile = null;

    this.nbSautsMax = 2;
    this.sautsRestants = 2;
    this.toucheSautRelachee = true;

    this.estMort = false;
    this.toucheRespawnRelachee = true;

    this.victoire = false;

    this.tuilesFragilesData = [];
    this.tuilesFragilesDeclenchees = new Set();

    this.picFirstGid = -1;
    this.picLastGid = -1;

    this.boutons = [];
    this.mobiles = [];

    this.vitesseChutMax = 600;
  }

  preload() {
    fct.doNothing();
    fct.doAlsoNothing();

    this.load.tilemapTiledJSON("mapkabage2", "src/assets/mapkabage2.0.json");

    this.load.image("niveau2_tileset_redim_img", "src/assets/tileset redim.png");
    this.load.image("niveau2_forteress_redim_img", "src/assets/forteress redim.png");
    this.load.image("niveau2_pic2_img", "src/assets/pic2.0.png");
    this.load.image("niveau2_boutonhaut_img", "src/assets/boutonhaut.png");
    this.load.image("niveau2_background_img", "src/assets/background2.0.png");
    this.load.image("niveau2_star", "src/assets/star.png");

    this.load.spritesheet("niveau2_forteress_sheet", "src/assets/forteress redim.png", {
      frameWidth: 32,
      frameHeight: 32
    });

    this.load.spritesheet("niveau2_img_perso", "src/assets/dude.png", {
      frameWidth: 32,
      frameHeight: 48
    });
  }

  create() {
    this.estMort = false;
    this.victoire = false;
    this.tuilesFragilesData = [];
    this.tuilesFragilesDeclenchees = new Set();
    this.boutons = [];
    this.mobiles = [];

    this.map = this.make.tilemap({ key: "mapkabage2" });

    const tilesets = [];

    const ts1 = this.map.addTilesetImage("tileset redim", "niveau2_tileset_redim_img");
    const ts2 = this.map.addTilesetImage("forteress redim", "niveau2_forteress_redim_img");
    const ts3 = this.map.addTilesetImage("pic2.0", "niveau2_pic2_img");
    const ts4 = this.map.addTilesetImage("boutonhaut", "niveau2_boutonhaut_img");

    if (ts1) tilesets.push(ts1);
    if (ts2) tilesets.push(ts2);
    if (ts3) tilesets.push(ts3);
    if (ts4) tilesets.push(ts4);

    this.map.tilesets.forEach(ts => {
      if (ts.name === "pic2.0") {
        this.picFirstGid = ts.firstgid;
        this.picLastGid = ts.firstgid + ts.total - 1;
      }
    });

    this.add.tileSprite(
      this.map.widthInPixels / 2,
      this.map.heightInPixels / 2,
      this.map.widthInPixels,
      this.map.heightInPixels,
      "niveau2_background_img"
    ).setDepth(-10);

    this.layerFond = this.creerCalque("fondecran", tilesets, 0);
    this.layerDecor2 = this.creerCalque("decor2", tilesets, 1);
    this.layerDecor3 = this.creerCalque("decor3", tilesets, 2);
    this.layerPlateforme = this.creerCalque("plateforme", tilesets, 3);
    this.layerDecor = this.creerCalque("decor", tilesets, 5);

    [this.layerDecor, this.layerDecor2, this.layerDecor3].forEach(layer => {
      if (!layer) return;
      layer.setCollisionByProperty({ estSolide: true });
      layer.setCollisionByProperty({ estFragile: true });
    });

    if (this.layerPlateforme) {
      this.layerPlateforme.forEachTile(tile => {
        if (!tile || tile.index === -1) return;

        if (getProp(tile, "estSemisolide")) {
          tile.setCollision(false, false, false, false);
        } else if (getProp(tile, "estSolide") || getProp(tile, "estFragile")) {
          tile.setCollision(true, true, true, true);
        }
      });
    }

    [this.layerDecor, this.layerDecor2, this.layerDecor3, this.layerPlateforme].forEach(layer => {
      if (!layer) return;

      layer.forEachTile(tile => {
        if (!tile || tile.index === -1) return;
        if (!getProp(tile, "estFragile")) return;

        const props = tile.properties;
        this.tuilesFragilesData.push({
          layer,
          x: tile.x,
          y: tile.y,
          index: tile.index,
          props: Array.isArray(props) ? props.map(p => ({ ...p })) : { ...props },
          collisions: [tile.collideLeft, tile.collideRight, tile.collideUp, tile.collideDown]
        });
      });
    });

    this.supprimerTuilesBouton();

    this.player = this.physics.add.sprite(this.spawnX, this.spawnY, "niveau2_img_perso");
    this.player.setScale(0.8);
    this.player.setBounce(0);
    this.player.setCollideWorldBounds(true);
    this.player.body.setSize(16, 32);
    this.player.body.setOffset(8, 12);
    this.player.setDepth(10);
    this.player.body.setGravityY(500);
    this.player.body.setMaxVelocityY(this.vitesseChutMax);

    this.clavier = this.input.keyboard.createCursorKeys();
    this.creerAnimations();

    if (this.layerDecor) this.physics.add.collider(this.player, this.layerDecor);
    if (this.layerDecor2) this.physics.add.collider(this.player, this.layerDecor2);
    if (this.layerDecor3) this.physics.add.collider(this.player, this.layerDecor3);
    if (this.layerPlateforme) this.physics.add.collider(this.player, this.layerPlateforme);

    this.etoile = this.physics.add.staticSprite(208, 176, "niveau2_star");
    this.etoile.setDepth(10);

    this.tweens.add({
      targets: this.etoile,
      angle: 360,
      duration: 2500,
      repeat: -1
    });

    this.chargerBoutons();
    this.chargerMobiles();

    this.creerEcranMort();
    this.creerTexteVictoire();

    this.physics.world.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);
    this.cameras.main.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
  }

  creerCalque(nom, tilesets, profondeur) {
    if (!this.map.getLayer(nom)) return null;
    const layer = this.map.createLayer(nom, tilesets, 0, 0);
    layer.setDepth(profondeur);
    return layer;
  }

  supprimerTuilesBouton() {
    const ts = this.map.tilesets.find(t => t.name === "boutonhaut");
    if (!ts) return;

    const min = ts.firstgid;
    const max = ts.firstgid + ts.total - 1;

    [this.layerDecor, this.layerDecor2, this.layerDecor3, this.layerPlateforme].forEach(layer => {
      if (!layer) return;
      layer.forEachTile(tile => {
        if (tile && tile.index >= min && tile.index <= max) {
          layer.removeTileAt(tile.x, tile.y);
        }
      });
    });
  }

  chargerBoutons() {
    const couche = this.map.getObjectLayer("bouton");
    if (!couche) return;

    couche.objects.forEach(obj => {
      if (obj.gid) return;
      if (!getPropObj(obj, "estBouton")) return;

      const w = obj.width || 32;
      const h = obj.height || 32;
      const bx = obj.x + w / 2;
      const by = obj.y + h / 2;

      const sprite = this.physics.add.staticSprite(bx, by, "niveau2_boutonhaut_img");
      sprite.setDisplaySize(w, h).refreshBody().setDepth(6);

      this.boutons.push({
        sprite,
        groupeID: getPropObj(obj, "groupeID") || 0,
        active: false
      });
    });
  }

  chargerMobiles() {
    const couche = this.map.getObjectLayer("pics_mobiles");
    if (!couche) return;

    couche.objects.forEach(obj => {
      const groupeID = getPropObj(obj, "groupeID") || 0;
      const hauteur = getPropObj(obj, "hauteurMontee") || 192;
      const type = getPropObj(obj, "type") || "pic";

      const w = obj.width || 32;
      const h = obj.height || 32;
      const bx = obj.x + w / 2;
      const by = obj.gid ? obj.y - h / 2 : obj.y + h / 2;

      let sprite;

      if (obj.gid) {
        for (const ts of this.map.tilesets) {
          if (obj.gid >= ts.firstgid && obj.gid < ts.firstgid + ts.total) {
            const frameLocal = obj.gid - ts.firstgid;
            const texture = ts.name === "forteress redim" ? "niveau2_forteress_sheet" : "niveau2_pic2_img";
            sprite = this.physics.add.staticSprite(bx, by, texture, frameLocal);
            break;
          }
        }
      } else {
        sprite = this.physics.add.staticSprite(
          bx,
          by,
          type === "bloc" ? "niveau2_forteress_sheet" : "niveau2_pic2_img"
        );
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

  activerGroupe(groupeID) {
    this.mobiles.forEach(m => {
      if (m.groupeID !== groupeID || m.active) return;

      m.active = true;
      this.tweens.add({
        targets: m.sprite,
        y: m.targetY,
        duration: 20000,
        ease: "Linear",
        onUpdate: () => m.sprite.refreshBody()
      });
    });
  }

  gererSemiSolides() {
    if (!this.layerPlateforme || this.player.body.velocity.y < 0) return;

    const bas = this.player.body.bottom;
    const basPrev = this.player.body.prev.y + this.player.body.height;
    const pointsX = [
      this.player.body.left + 2,
      this.player.body.center.x,
      this.player.body.right - 2
    ];

    for (const px of pointsX) {
      const tile = this.layerPlateforme.getTileAtWorldXY(px, bas, true);
      if (!tile || tile.index === -1) continue;
      if (!getProp(tile, "estSemisolide")) continue;

      const topTuile = tile.pixelY;

      if (basPrev <= topTuile + 2 && bas >= topTuile) {
        this.player.body.y = topTuile - this.player.body.height;
        this.player.body.velocity.y = 0;
        this.player.body.blocked.down = true;
        this.player.body.touching.down = true;
        return;
      }
    }
  }

  gererFragile(layer) {
    if (!layer) return;

    const tile = layer.getTileAtWorldXY(
      this.player.body.center.x,
      this.player.body.bottom + 2,
      true
    );

    if (!tile || !getProp(tile, "estFragile")) return;

    const id = `${layer.layer.name}_${tile.x}_${tile.y}`;
    if (this.tuilesFragilesDeclenchees.has(id)) return;
    if (this.player.body.velocity.y < 0) return;

    this.tuilesFragilesDeclenchees.add(id);
    this.time.delayedCall(180, () => {
      layer.removeTileAt(tile.x, tile.y);
    });
  }

  toucheUnPic(layer) {
    if (!layer || this.picFirstGid === -1) return false;

    const points = [
      [this.player.body.center.x, this.player.body.center.y],
      [this.player.body.center.x, this.player.body.bottom - 2],
      [this.player.body.left + 2, this.player.body.bottom - 2],
      [this.player.body.right - 2, this.player.body.bottom - 2],
      [this.player.body.left + 2, this.player.body.center.y],
      [this.player.body.right - 2, this.player.body.center.y]
    ];

    for (const [px, py] of points) {
      const tile = layer.getTileAtWorldXY(px, py, true);
      if (tile && tile.index >= this.picFirstGid && tile.index <= this.picLastGid) {
        return true;
      }
    }

    return false;
  }

  toucheUnPicMobile() {
    return this.mobiles.some(m => m.estMortel && this.physics.overlap(this.player, m.sprite));
  }

  mourir() {
    if (this.estMort || this.victoire) return;

    this.estMort = true;
    this.player.setVelocity(0, 0);
    this.player.body.setEnable(false);
    this.player.anims.play("niveau2_anim_face", true);

    this.cameras.main.flash(80, 255, 255, 255);

    this.time.delayedCall(80, () => {
      this.cameras.main.zoomTo(1.04, 800, "Linear");
      this.tweens.add({ targets: this.mortFond, fillAlpha: 0.6, duration: 600, ease: "Power2" });
      this.tweens.add({ targets: this.mortBande, fillAlpha: 0.85, duration: 300, delay: 300, ease: "Power2" });
      this.mortTitre.setScale(1.3).setAlpha(0);
      this.tweens.add({
        targets: this.mortTitre,
        alpha: 1,
        scaleX: 1,
        scaleY: 1,
        duration: 250,
        delay: 400,
        ease: "Power3"
      });
      this.tweens.add({
        targets: this.mortSous,
        alpha: 1,
        duration: 300,
        delay: 900,
        ease: "Power2"
      });
    });
  }

  respawn() {
    this.estMort = false;

    this.cameras.main.zoomTo(1, 200, "Linear");
    this.tweens.killTweensOf([this.mortFond, this.mortBande, this.mortTitre, this.mortSous]);
    this.mortFond.fillAlpha = 0;
    this.mortBande.fillAlpha = 0;
    this.mortTitre.setAlpha(0);
    this.mortSous.setAlpha(0);
    this.cameras.main.flash(200, 255, 255, 255);

    this.player.setPosition(this.spawnX, this.spawnY);
    this.player.setVelocity(0, 0);
    this.player.body.setEnable(true);
    this.player.setAlpha(1);
    this.sautsRestants = this.nbSautsMax;

    this.tuilesFragilesDeclenchees.clear();

    this.tuilesFragilesData.forEach(({ layer, x, y, index, props, collisions }) => {
      const tile = layer.putTileAt(index, x, y);
      if (!tile) return;
      tile.properties = Array.isArray(props) ? props.map(p => ({ ...p })) : { ...props };
      tile.setCollision(...collisions);
    });

    this.boutons.forEach(b => {
      b.active = false;
    });

    this.mobiles.forEach(m => {
      m.active = false;
      this.tweens.killTweensOf(m.sprite);
      m.sprite.y = m.baseY;
      m.sprite.refreshBody();
    });
  }

  creerEcranMort() {
    const W = this.cameras.main.width;
    const H = this.cameras.main.height;

    this.mortFond = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0)
      .setDepth(98)
      .setScrollFactor(0);

    this.mortBande = this.add.rectangle(W / 2, H / 2, W, 90, 0x111111, 0)
      .setDepth(99)
      .setScrollFactor(0);

    this.mortTitre = this.add.text(W / 2, H / 2, "RATÉ", {
      fontSize: "72px",
      fontStyle: "bold",
      fontFamily: "Arial Black, Impact, sans-serif",
      fill: "#cc2200",
      stroke: "#000000",
      strokeThickness: 4
    }).setOrigin(0.5).setDepth(100).setScrollFactor(0).setAlpha(0);

    this.mortSous = this.add.text(W / 2, H / 2 + 56, "[ ESPACE ] pour réapparaître", {
      fontSize: "16px",
      fontFamily: "Arial, sans-serif",
      fill: "#aaaaaa"
    }).setOrigin(0.5).setDepth(100).setScrollFactor(0).setAlpha(0);
  }

  creerTexteVictoire() {
    this.texteVictoire = this.add.text(400, 100, "BRAVO VOUS AVEZ GAGNÉ", {
      fontSize: "32px",
      fill: "#ffff00",
      fontStyle: "bold",
      stroke: "#000000",
      strokeThickness: 4
    })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(200)
      .setAlpha(0);
  }

  creerAnimations() {
    if (!this.anims.exists("niveau2_anim_tourne_gauche")) {
      this.anims.create({
        key: "niveau2_anim_tourne_gauche",
        frames: this.anims.generateFrameNumbers("niveau2_img_perso", { start: 0, end: 3 }),
        frameRate: 10,
        repeat: -1
      });
    }

    if (!this.anims.exists("niveau2_anim_face")) {
      this.anims.create({
        key: "niveau2_anim_face",
        frames: [{ key: "niveau2_img_perso", frame: 4 }],
        frameRate: 20
      });
    }

    if (!this.anims.exists("niveau2_anim_tourne_droite")) {
      this.anims.create({
        key: "niveau2_anim_tourne_droite",
        frames: this.anims.generateFrameNumbers("niveau2_img_perso", { start: 5, end: 8 }),
        frameRate: 10,
        repeat: -1
      });
    }
  }

  update() {
    if (!this.player || !this.clavier) return;

    if (this.victoire) return;

    if (this.estMort) {
      if (this.clavier.space.isDown && this.toucheRespawnRelachee) {
        this.toucheRespawnRelachee = false;
        this.respawn();
      }

      if (this.clavier.space.isUp) {
        this.toucheRespawnRelachee = true;
      }

      return;
    }

    this.gererSemiSolides();

    if (this.player.body.blocked.down) {
      this.sautsRestants = this.nbSautsMax;
    }

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

    if (this.clavier.up.isDown && this.toucheSautRelachee && this.sautsRestants > 0) {
      this.player.setVelocityY(-330);
      this.sautsRestants--;
      this.toucheSautRelachee = false;
    }

    if (this.clavier.up.isUp) {
      this.toucheSautRelachee = true;
    }

    if (this.player.body.velocity.y > this.vitesseChutMax) {
      this.player.body.setVelocityY(this.vitesseChutMax);
    }

    [this.layerDecor, this.layerDecor2, this.layerDecor3, this.layerPlateforme].forEach(layer => {
      this.gererFragile(layer);
    });

    this.boutons.forEach(b => {
      if (b.active) return;
      if (this.physics.overlap(this.player, b.sprite)) {
        b.active = true;
        this.activerGroupe(b.groupeID);
      }
    });

    const touchePic =
      this.toucheUnPic(this.layerPlateforme) ||
      this.toucheUnPic(this.layerDecor) ||
      this.toucheUnPic(this.layerDecor2) ||
      this.toucheUnPic(this.layerDecor3) ||
      this.toucheUnPicMobile();

    if (touchePic) {
      this.mourir();
      return;
    }

    if (this.physics.overlap(this.player, this.etoile)) {
      this.victoire = true;
      this.player.setVelocity(0, 0);
      this.player.body.setEnable(false);
      this.etoile.setVisible(false);
      this.texteVictoire.setAlpha(1);

      this.time.delayedCall(2000, () => {
        this.scene.start("menu");
      });
    }
  }
}