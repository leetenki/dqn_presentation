var LENSFLARE = {
	// function
	lensFlareUpdateCallback: null,
	initFlareTexture: null,
	createLensFlare: null,

	// variable
	textureFlare0: null,
	textureFlare1: null,
	textureFlare2: null
};

(function() {
	/*
	 * This function is to initialize flare's image texture.
	 */
	LENSFLARE.initFlareTexture = function(texture0, texture1, texture2) {
		LENSFLARE.textureFlare0 = texture0;
		LENSFLARE.textureFlare1 = texture1;
		LENSFLARE.textureFlare2 = texture2;
	}

	/*
	 * This function is to create a new lens flare.
	 */
	LENSFLARE.createLensFlare = function(h, s, l, x, y, z, size) {
		var object = new THREE.Object3D();
		object.textures = new Array(
			LENSFLARE.textureFlare0.image.src,
			LENSFLARE.textureFlare1.image.src,
			LENSFLARE.textureFlare2.image.src
		);

		// normal light in the same position with lens flare
		var light = new THREE.PointLight(0xffffff, 1.5, 4500);
		light.color.setHSL(h, s, l);
		light.position.set(x, y, z);
		light.name = "Light";
		object.add(light);

		// flare0
		var flareColor = new THREE.Color(0xffffff);
		flareColor.setHSL(h, s, l + 0.5);
		var lensFlare = new THREE.LensFlare(LENSFLARE.textureFlare0, size, 0.0, THREE.AdditiveBlending, flareColor);

		// flare1
		lensFlare.add(LENSFLARE.textureFlare1, 512, 0.0, THREE.AdditiveBlending);
		lensFlare.add(LENSFLARE.textureFlare1, 512, 0.0, THREE.AdditiveBlending);
		lensFlare.add(LENSFLARE.textureFlare1, 512, 0.0, THREE.AdditiveBlending);

		// flare2
		lensFlare.add(LENSFLARE.textureFlare2, 60, 0.6, THREE.AdditiveBlending);
		lensFlare.add(LENSFLARE.textureFlare2, 70, 0.7, THREE.AdditiveBlending);
		lensFlare.add(LENSFLARE.textureFlare2, 120, 0.9, THREE.AdditiveBlending);
		lensFlare.add(LENSFLARE.textureFlare2, 70, 1.0, THREE.AdditiveBlending);

//		lensFlare.customUpdateCallback = LENSFLARE.lensFlareUpdateCallback;
		lensFlare.position = light.position;
		lensFlare.name = "Flare";
		object.add(lensFlare);


		return object;
	}

	/*
	 * This function will be called when camera move or rotate.
	 * It recalcs shining light view
	 */
	LENSFLARE.lensFlareUpdateCallback = function(object) {
		var f, fl = object.lensFlares.length;
		var flare;
		var vecX = -object.positionScreen.x * 2;
		var vecY = -object.positionScreen.y * 2;
		for(f = 0; f < fl; f++) {
			   flare = object.lensFlares[f];
			   flare.x = object.positionScreen.x + vecX * flare.distance;
			   flare.y = object.positionScreen.y + vecY * flare.distance;
		}
		object.lensFlares[2].y += 0.025;
		object.lensFlares[3].rotation = object.positionScreen.x * 0.5 + THREE.Math.degToRad(45);
	}
})();
